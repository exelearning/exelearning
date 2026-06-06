/**
 * ProseMirror Image tools
 *
 * Phase B of the editor-dialogs effort: a contextual image mini-toolbar (modern
 * mode) shown when an image node is selected, plus an image-properties dialog
 * (source via Media Library, alt, title, width, height, alignment) built on the
 * shared ProseMirrorDialog. Replaces the old prompt()-based image insert.
 *
 * Alignment maps to the canonical eXe export classes (`position-left`,
 * `position-center`, `position-right`) so images line up the same way in the
 * editor and in exported content.
 */
(function () {
	'use strict';

	const t = (s) => (typeof _ === 'function' ? _(s) : s);
	const PM = window.ProseMirrorBundle || {};
	const { Plugin, PluginKey, NodeSelection } = PM;
	const imageToolbarPluginKey = PluginKey ? new PluginKey('exeImageToolbar') : { key: 'exeImageToolbar' };

	// Every alignment token the editor may attach to an image's class attribute.
	// `float-*` is recognised on read (legacy/in-column images) but the dialog
	// only ever writes the block-level `position-*` variants.
	const ALIGN_CLASSES = ['position-left', 'position-center', 'position-right', 'float-left', 'float-right'];

	function icon(name) {
		return (window.ProseMirrorIcons && window.ProseMirrorIcons.getIcon && window.ProseMirrorIcons.getIcon(name)) || '';
	}

	/** Return { node, pos } when a NodeSelection on an image is active, else null. */
	function getSelectedImage(view) {
		if (!view || !view.state) return null;
		const { schema, selection } = view.state;
		const imageType = schema && schema.nodes && schema.nodes.image;
		if (!imageType) return null;
		const isNodeSel = NodeSelection ? selection instanceof NodeSelection : !!selection.node;
		if (isNodeSel && selection.node && selection.node.type === imageType) {
			return { node: selection.node, pos: selection.from };
		}
		return null;
	}

	/** Find the alignment token present in a class string, or '' if none. */
	function alignFromClass(cls) {
		if (!cls) return '';
		const tokens = String(cls).split(/\s+/);
		return ALIGN_CLASSES.find((a) => tokens.includes(a)) || '';
	}

	/** Map a logical alignment ('left'|'center'|'right') to its class token. */
	function alignToClassToken(align) {
		switch (align) {
			case 'left':
				return 'position-left';
			case 'center':
				return 'position-center';
			case 'right':
				return 'position-right';
			default:
				return '';
		}
	}

	/** Map a class token back to a logical alignment ('' when not an align token). */
	function classTokenToAlign(token) {
		switch (token) {
			case 'position-left':
			case 'float-left':
				return 'left';
			case 'position-center':
				return 'center';
			case 'position-right':
			case 'float-right':
				return 'right';
			default:
				return '';
		}
	}

	/** Swap any alignment token in a class string for the new one (or remove it). */
	function setAlignClass(cls, align) {
		const token = alignToClassToken(align);
		const tokens = String(cls || '')
			.split(/\s+/)
			.filter((x) => x && !ALIGN_CLASSES.includes(x));
		if (token) tokens.push(token);
		return tokens.join(' ') || null;
	}

	/** Apply new attrs to the image node at pos, preserving the others. */
	function applyImageAttrs(editor, pos, attrs) {
		const view = editor.view;
		const { state } = view;
		const node = state.doc.nodeAt(pos);
		if (!node) return false;
		const tr = state.tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs });
		view.dispatch(tr.scrollIntoView());
		if (typeof editor.focus === 'function') editor.focus();
		return true;
	}

	/** Set alignment on the currently-selected image. */
	function setAlign(editor, align) {
		const selected = getSelectedImage(editor.view);
		if (!selected) return false;
		const cls = setAlignClass(selected.node.attrs.class, align);
		return applyImageAttrs(editor, selected.pos, { class: cls });
	}

	/** Build the declarative dialog field list from the current image attrs. */
	function buildFields(attrs) {
		attrs = attrs || {};
		return [
			{ name: 'src', type: 'media', label: t('Source'), accept: 'image', value: attrs.src || '', placeholder: 'https://' },
			{ name: 'alt', type: 'text', label: t('Alternative text'), value: attrs.alt || '' },
			{ name: 'title', type: 'text', label: t('Title'), value: attrs.title || '' },
			{ name: 'width', type: 'number', label: t('Width'), value: attrs.width != null ? attrs.width : '', min: 0 },
			{ name: 'height', type: 'number', label: t('Height'), value: attrs.height != null ? attrs.height : '', min: 0 },
			{
				name: 'align',
				type: 'select',
				label: t('Alignment'),
				value: classTokenToAlign(alignFromClass(attrs.class)),
				options: [
					{ value: '', label: t('None') },
					{ value: 'left', label: t('Left') },
					{ value: 'center', label: t('Center') },
					{ value: 'right', label: t('Right') },
				],
			},
		];
	}

	/** Map collected dialog values onto image-node attributes. */
	function valuesToAttrs(values, existingClass) {
		return {
			src: (values.src || '').trim(),
			alt: values.alt ? values.alt : null,
			title: values.title ? values.title : null,
			width: values.width != null && values.width !== '' ? values.width : null,
			height: values.height != null && values.height !== '' ? values.height : null,
			class: setAlignClass(existingClass, values.align),
		};
	}

	/** Insert a brand-new image node at the current selection. */
	function insertImage(editor, attrs) {
		const view = editor.view;
		const { state } = view;
		const imageType = state.schema.nodes.image;
		if (!imageType || !attrs.src) return false;
		const node = imageType.create(attrs);
		view.dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
		if (typeof editor.focus === 'function') editor.focus();
		return true;
	}

	/** Apply dialog values: update the selected image, or insert a new one. */
	function applyImage(editor, values, selected) {
		if (!values) return false;
		const src = (values.src || '').trim();
		if (!src) return false;
		if (selected) {
			return applyImageAttrs(editor, selected.pos, valuesToAttrs(values, selected.node.attrs.class));
		}
		return insertImage(editor, valuesToAttrs(values, null));
	}

	/** Open the image-properties dialog to insert or edit an image. */
	async function openProperties(editor) {
		if (!editor || !window.ProseMirrorDialog) return;
		const imageType = editor.schema && editor.schema.nodes && editor.schema.nodes.image;
		if (!imageType) return;
		const selected = getSelectedImage(editor.view);
		const values = await window.ProseMirrorDialog.openForm({
			title: t('Image'),
			submitLabel: t('OK'),
			fields: buildFields(selected ? selected.node.attrs : null),
		});
		if (values == null) {
			if (typeof editor.focus === 'function') editor.focus();
			return;
		}
		applyImage(editor, values, selected);
	}

	/** Run a contextual-toolbar action against the editor. */
	function runAction(editor, cmd) {
		if (cmd === 'edit') {
			openProperties(editor);
			return;
		}
		setAlign(editor, cmd);
	}

	// Buttons shown on the contextual image toolbar.
	const TOOLBAR_BUTTONS = [
		{ cmd: 'edit', icon: 'image', label: t('Image properties') },
		{ cmd: 'left', icon: 'alignleft', label: t('Align left') },
		{ cmd: 'center', icon: 'aligncenter', label: t('Align center') },
		{ cmd: 'right', icon: 'alignright', label: t('Align right') },
	];

	/**
	 * Contextual image toolbar plugin (modern mode). Mirrors the floating-toolbar
	 * plugin: a small bar that appears above a selected image with edit + align
	 * actions, repositions on scroll/resize, and tears itself down on destroy.
	 */
	function proseMirrorImageToolbarPlugin(options) {
		options = options || {};
		const passedEditor = options.editor || null;

		return new Plugin({
			key: imageToolbarPluginKey,
			view(editorView) {
				const host = editorView.dom.parentNode;
				if (host && getComputedStyle(host).position === 'static') {
					host.style.position = 'relative';
				}

				const editor = passedEditor || {
					view: editorView,
					schema: editorView.state.schema,
					focus: () => editorView.focus(),
				};

				const bar = document.createElement('div');
				bar.className = 'prosemirror-image-toolbar';
				bar.style.display = 'none';

				TOOLBAR_BUTTONS.forEach((b) => {
					const btn = document.createElement('button');
					btn.type = 'button';
					btn.className = 'prosemirror-image-btn';
					btn.setAttribute('data-cmd', b.cmd);
					btn.setAttribute('title', b.label);
					const svg = icon(b.icon);
					btn.innerHTML = svg || `<span>${b.label}</span>`;
					btn.addEventListener('mousedown', (e) => {
						// Keep the image NodeSelection while the button is pressed.
						e.preventDefault();
						runAction(editor, b.cmd);
					});
					bar.appendChild(btn);
				});

				host.appendChild(bar);

				function hide() {
					bar.style.display = 'none';
				}

				function reposition() {
					const selected = getSelectedImage(editorView);
					if (!selected) {
						hide();
						return;
					}
					const coords = editorView.coordsAtPos(selected.pos);
					const hostRect = host.getBoundingClientRect();
					bar.style.display = 'flex';
					const barRect = bar.getBoundingClientRect();
					let left = coords.left - hostRect.left;
					left = Math.max(2, left);
					let top = coords.top - hostRect.top - barRect.height - 8;
					if (top < 0) top = coords.bottom - hostRect.top + 8; // flip below if no room above
					bar.style.left = `${left}px`;
					bar.style.top = `${top}px`;
					updateActive(selected);
				}

				function updateActive(selected) {
					const current = classTokenToAlign(alignFromClass(selected.node.attrs.class));
					bar.querySelectorAll('[data-cmd]').forEach((btn) => {
						const cmd = btn.getAttribute('data-cmd');
						if (cmd === 'edit') return;
						btn.classList.toggle('is-active', cmd === current);
					});
				}

				const onScroll = () => {
					if (bar.style.display !== 'none') reposition();
				};
				window.addEventListener('scroll', onScroll, true);
				window.addEventListener('resize', onScroll);

				reposition();

				return {
					update() {
						reposition();
					},
					destroy() {
						window.removeEventListener('scroll', onScroll, true);
						window.removeEventListener('resize', onScroll);
						if (bar.parentNode) bar.parentNode.removeChild(bar);
					},
				};
			},
		});
	}

	// Smallest size (px) an image may be dragged down to.
	const MIN_IMAGE_SIZE = 24;

	/**
	 * Compute a new width/height while dragging a corner handle. By default width
	 * and height move independently (free resize); when `keepRatio` is set (Shift
	 * held) the height follows the width to preserve the aspect ratio. Pure + testable.
	 * @param {{startW:number,startH:number,dx:number,dy?:number,corner:string,keepRatio?:boolean,minSize?:number}} opts
	 * @returns {{width:number,height:number}}
	 */
	function computeResize(opts) {
		const { startW, startH, dx, corner } = opts;
		const dy = opts.dy || 0;
		const minSize = opts.minSize != null ? opts.minSize : MIN_IMAGE_SIZE;
		// East corners grow with +dx, west corners with -dx.
		const growX = corner === 'ne' || corner === 'se' ? dx : -dx;
		let width = Math.round(startW + growX);
		if (width < minSize) width = minSize;
		let height;
		if (opts.keepRatio) {
			const ratio = startW > 0 ? startH / startW : 1;
			height = Math.max(minSize, Math.round(width * ratio));
		} else {
			// South corners grow with +dy, north corners with -dy.
			const growY = corner === 'sw' || corner === 'se' ? dy : -dy;
			height = Math.round(startH + growY);
			if (height < minSize) height = minSize;
		}
		return { width, height };
	}

	/** Sync an <img> (and mirror alignment onto its wrapper) from node attrs. */
	function applyImgAttrs(img, wrap, attrs) {
		img.setAttribute('src', attrs.src || '');
		setOrRemove(img, 'alt', attrs.alt);
		setOrRemove(img, 'title', attrs.title);
		setOrRemove(img, 'class', attrs.class);
		setOrRemove(img, 'width', attrs.width);
		setOrRemove(img, 'height', attrs.height);
		// The block-level alignment classes only take effect on a block element,
		// so mirror the alignment token onto the inline-block wrapper.
		const alignToken = alignFromClass(attrs.class);
		wrap.className = 'pm-image-wrap' + (alignToken ? ' ' + alignToken : '');
	}

	function setOrRemove(el, name, value) {
		if (value == null || value === '') el.removeAttribute(name);
		else el.setAttribute(name, value);
	}

	/** Resolve a ProseMirror getPos (function in current versions) to a number. */
	function resolvePos(getPos) {
		const pos = typeof getPos === 'function' ? getPos() : getPos;
		return typeof pos === 'number' ? pos : null;
	}

	/** Wire a corner handle to live-resize the image and commit on mouseup. */
	function attachResizeHandle(handle, corner, img, view, getPos) {
		handle.addEventListener('mousedown', (e) => {
			// Don't let ProseMirror start a node-drag or move the selection.
			e.preventDefault();
			e.stopPropagation();
			const startX = e.clientX;
			const startY = e.clientY;
			const startW = img.offsetWidth || Number(img.getAttribute('width')) || 0;
			const startH = img.offsetHeight || Number(img.getAttribute('height')) || 0;
			// Free resize by default; hold Shift to preserve the aspect ratio.
			const sizeFor = (ev) =>
				computeResize({ startW, startH, dx: ev.clientX - startX, dy: ev.clientY - startY, corner, keepRatio: ev.shiftKey });

			const onMove = (ev) => {
				const { width, height } = sizeFor(ev);
				img.style.width = `${width}px`;
				img.style.height = `${height}px`;
			};
			const onUp = (ev) => {
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onUp);
				img.style.width = '';
				img.style.height = '';
				const { width, height } = sizeFor(ev);
				const pos = resolvePos(getPos);
				if (pos == null) return;
				const node = view.state.doc.nodeAt(pos);
				if (!node) return;
				view.dispatch(view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, width, height }));
			};
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
		});
	}

	// Corner handles, in DOM order.
	const RESIZE_CORNERS = ['nw', 'ne', 'sw', 'se'];

	/**
	 * ProseMirror NodeView for `image`: renders the <img> wrapped so it can carry
	 * corner resize handles. Dragging a handle live-previews the new size and
	 * commits width/height (aspect-ratio preserved) as a single transaction —
	 * which round-trips through HTML export and the Yjs binding like any other
	 * attribute change. Works in both classic and modern editor modes.
	 */
	function createImageNodeView(node, view, getPos) {
		const wrap = document.createElement('span');
		const img = document.createElement('img');
		applyImgAttrs(img, wrap, node.attrs);
		wrap.appendChild(img);

		RESIZE_CORNERS.forEach((corner) => {
			const handle = document.createElement('span');
			handle.className = `pm-image-handle pm-image-handle-${corner}`;
			handle.setAttribute('data-corner', corner);
			attachResizeHandle(handle, corner, img, view, getPos);
			wrap.appendChild(handle);
		});

		// Clicking the image selects the node so the resize handles (and the
		// contextual toolbar) appear — ProseMirror doesn't reliably make a
		// NodeSelection for a NodeView-wrapped inline image on its own.
		wrap.addEventListener('mousedown', (e) => {
			if (e.target && e.target.classList && e.target.classList.contains('pm-image-handle')) return;
			if (!NodeSelection) return;
			const pos = resolvePos(getPos);
			if (pos == null) return;
			e.preventDefault();
			view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
			view.focus();
		});

		return {
			dom: wrap,
			selectNode() {
				wrap.classList.add('pm-image-selected');
			},
			deselectNode() {
				wrap.classList.remove('pm-image-selected');
			},
			update(newNode) {
				if (newNode.type !== node.type) return false;
				node = newNode;
				applyImgAttrs(img, wrap, newNode.attrs);
				return true;
			},
			// Our own style/attribute mutations (live resize) aren't document edits.
			ignoreMutation(m) {
				return m.type !== 'selection';
			},
			// Let handle drags through without ProseMirror hijacking them.
			stopEvent(e) {
				return !!(e.target && e.target.classList && e.target.classList.contains('pm-image-handle'));
			},
		};
	}

	window.ProseMirrorImageTools = {
		openProperties,
		applyImage,
		setAlign,
		getSelectedImage,
		insertImage,
		createImageNodeView,
	};
	window.proseMirrorImageToolbarPlugin = proseMirrorImageToolbarPlugin;
	window.imageToolbarPluginKey = imageToolbarPluginKey;
	window.ProseMirrorImageToolsInternals = {
		alignFromClass,
		alignToClassToken,
		classTokenToAlign,
		setAlignClass,
		buildFields,
		valuesToAttrs,
		applyImageAttrs,
		runAction,
		computeResize,
		applyImgAttrs,
		attachResizeHandle,
		resolvePos,
	};
})();
