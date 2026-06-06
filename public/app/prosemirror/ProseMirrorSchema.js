/**
 * ProseMirror Custom Schema
 *
 * Defines the document structure for the collaborative editor.
 * Supports full TinyMCE-like formatting features.
 */
(function () {
	'use strict';

	const { Schema, DOMParser, DOMSerializer } = window.ProseMirrorBundle;
	const { addListNodes } = window.ProseMirrorBundle;
	const { tableNodes } = window.ProseMirrorBundle;

	/**
	 * Helper to build block attributes (alignment, class)
	 */
	function getBlockAttrs(node) {
		const attrs = {};
		if (node.attrs.textAlign) {
			attrs.style = `text-align: ${node.attrs.textAlign}`;
		}
		if (node.attrs.class) {
			attrs.class = node.attrs.class;
		}
		return attrs;
	}

	/**
	 * Parse text alignment from DOM element
	 */
	function getAlignmentFromDOM(dom) {
		const style = dom.getAttribute('style') || '';
		const match = style.match(/text-align:\s*(left|center|right|justify)/i);
		return match ? match[1] : null;
	}

	/**
	 * Base node specifications
	 */
	const baseNodes = {
		doc: {
			content: 'block+',
		},

		paragraph: {
			content: 'inline*',
			group: 'block',
			attrs: {
				textAlign: { default: null },
				class: { default: null },
			},
			parseDOM: [
				{
					tag: 'p',
					getAttrs: (dom) => ({
						textAlign: getAlignmentFromDOM(dom),
						class: dom.getAttribute('class'),
					}),
				},
			],
			toDOM: (node) => ['p', getBlockAttrs(node), 0],
		},

		heading: {
			attrs: {
				level: { default: 1 },
				textAlign: { default: null },
			},
			content: 'inline*',
			group: 'block',
			defining: true,
			parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
				tag: `h${level}`,
				attrs: { level },
				getAttrs: (dom) => ({
					level,
					textAlign: getAlignmentFromDOM(dom),
				}),
			})),
			toDOM: (node) => [`h${node.attrs.level}`, getBlockAttrs(node), 0],
		},

		blockquote: {
			content: 'block+',
			group: 'block',
			defining: true,
			parseDOM: [{ tag: 'blockquote' }],
			toDOM: () => ['blockquote', 0],
		},

		horizontal_rule: {
			group: 'block',
			parseDOM: [{ tag: 'hr' }],
			toDOM: () => ['hr'],
		},

		code_block: {
			content: 'text*',
			marks: '',
			group: 'block',
			code: true,
			defining: true,
			attrs: {
				language: { default: '' },
			},
			parseDOM: [
				{
					tag: 'pre',
					preserveWhitespace: 'full',
					getAttrs: (dom) => ({
						language: dom.getAttribute('data-language') || '',
					}),
				},
			],
			toDOM: (node) => {
				const attrs = node.attrs.language ? { 'data-language': node.attrs.language } : {};
				return ['pre', attrs, ['code', 0]];
			},
		},

		// Image with asset:// URL support
		image: {
			inline: true,
			attrs: {
				src: {},
				alt: { default: null },
				title: { default: null },
				'data-asset-src': { default: null },
				'data-asset-id': { default: null },
				class: { default: null },
				width: { default: null },
				height: { default: null },
			},
			group: 'inline',
			draggable: true,
			parseDOM: [
				{
					tag: 'img[src]',
					getAttrs: (dom) => ({
						src: dom.getAttribute('src'),
						alt: dom.getAttribute('alt'),
						title: dom.getAttribute('title'),
						'data-asset-src': dom.getAttribute('data-asset-src'),
						'data-asset-id': dom.getAttribute('data-asset-id'),
						class: dom.getAttribute('class'),
						width: dom.getAttribute('width'),
						height: dom.getAttribute('height'),
					}),
				},
			],
			toDOM: (node) => {
				const attrs = { src: node.attrs.src };
				if (node.attrs.alt) attrs.alt = node.attrs.alt;
				if (node.attrs.title) attrs.title = node.attrs.title;
				if (node.attrs['data-asset-src']) attrs['data-asset-src'] = node.attrs['data-asset-src'];
				if (node.attrs['data-asset-id']) attrs['data-asset-id'] = node.attrs['data-asset-id'];
				if (node.attrs.class) attrs.class = node.attrs.class;
				if (node.attrs.width) attrs.width = node.attrs.width;
				if (node.attrs.height) attrs.height = node.attrs.height;
				return ['img', attrs];
			},
		},

		// Math node (LaTeX equation rendered by MathJax). Serializes to the
		// `exe-math-rendered` convention shared with the exporter / LatexPreRenderer:
		// inline `\( … \)`, block `\[ … \]`.
		math: {
			inline: true,
			group: 'inline',
			atom: true,
			selectable: true,
			draggable: true,
			attrs: {
				latex: { default: '' },
				display: { default: 'inline' },
			},
			parseDOM: [
				{
					tag: 'span.exe-math-rendered',
					getAttrs: (dom) => ({
						latex: dom.getAttribute('data-latex') || '',
						display: dom.getAttribute('data-display') === 'block' ? 'block' : 'inline',
					}),
				},
			],
			toDOM: (node) => {
				const latex = node.attrs.latex || '';
				const display = node.attrs.display === 'block' ? 'block' : 'inline';
				const wrapped = display === 'block' ? `\\[${latex}\\]` : `\\(${latex}\\)`;
				return ['span', { class: 'exe-math-rendered', 'data-latex': latex, 'data-display': display }, wrapped];
			},
		},

		// Video node
		video: {
			group: 'block',
			attrs: {
				src: {},
				'data-asset-src': { default: null },
				'data-asset-id': { default: null },
				controls: { default: true },
				width: { default: null },
				height: { default: null },
				poster: { default: null },
			},
			parseDOM: [
				{
					tag: 'video',
					getAttrs: (dom) => ({
						src: dom.getAttribute('src'),
						'data-asset-src': dom.getAttribute('data-asset-src'),
						'data-asset-id': dom.getAttribute('data-asset-id'),
						controls: dom.hasAttribute('controls'),
						width: dom.getAttribute('width'),
						height: dom.getAttribute('height'),
						poster: dom.getAttribute('poster'),
					}),
				},
			],
			toDOM: (node) => {
				const attrs = { src: node.attrs.src };
				if (node.attrs.controls) attrs.controls = 'controls';
				if (node.attrs['data-asset-src']) attrs['data-asset-src'] = node.attrs['data-asset-src'];
				if (node.attrs['data-asset-id']) attrs['data-asset-id'] = node.attrs['data-asset-id'];
				if (node.attrs.width) attrs.width = node.attrs.width;
				if (node.attrs.height) attrs.height = node.attrs.height;
				if (node.attrs.poster) attrs.poster = node.attrs.poster;
				return ['video', attrs];
			},
		},

		// Audio node
		audio: {
			group: 'block',
			attrs: {
				src: {},
				'data-asset-src': { default: null },
				'data-asset-id': { default: null },
				controls: { default: true },
			},
			parseDOM: [
				{
					tag: 'audio',
					getAttrs: (dom) => ({
						src: dom.getAttribute('src'),
						'data-asset-src': dom.getAttribute('data-asset-src'),
						'data-asset-id': dom.getAttribute('data-asset-id'),
						controls: dom.hasAttribute('controls'),
					}),
				},
			],
			toDOM: (node) => {
				const attrs = { src: node.attrs.src };
				if (node.attrs.controls) attrs.controls = 'controls';
				if (node.attrs['data-asset-src']) attrs['data-asset-src'] = node.attrs['data-asset-src'];
				if (node.attrs['data-asset-id']) attrs['data-asset-id'] = node.attrs['data-asset-id'];
				return ['audio', attrs];
			},
		},

		// Iframe for embeds (YouTube, etc.)
		iframe: {
			group: 'block',
			attrs: {
				src: {},
				'data-asset-id': { default: null },
				width: { default: '100%' },
				height: { default: '400' },
				frameborder: { default: '0' },
				allowfullscreen: { default: true },
			},
			parseDOM: [
				{
					tag: 'iframe',
					getAttrs: (dom) => ({
						src: dom.getAttribute('src'),
						'data-asset-id': dom.getAttribute('data-asset-id'),
						width: dom.getAttribute('width') || '100%',
						height: dom.getAttribute('height') || '400',
						frameborder: dom.getAttribute('frameborder') || '0',
						allowfullscreen: dom.hasAttribute('allowfullscreen'),
					}),
				},
			],
			toDOM: (node) => {
				const attrs = {
					src: node.attrs.src,
					width: node.attrs.width,
					height: node.attrs.height,
					frameborder: node.attrs.frameborder,
				};
				if (node.attrs['data-asset-id']) attrs['data-asset-id'] = node.attrs['data-asset-id'];
				if (node.attrs.allowfullscreen) attrs.allowfullscreen = 'allowfullscreen';
				return ['iframe', attrs];
			},
		},

		hard_break: {
			inline: true,
			group: 'inline',
			selectable: false,
			parseDOM: [{ tag: 'br' }],
			toDOM: () => ['br'],
		},

		text: {
			group: 'inline',
		},
	};

	/**
	 * Mark specifications
	 */
	const marks = {
		link: {
			attrs: {
				href: {},
				target: { default: null },
				rel: { default: null },
				title: { default: null },
			},
			inclusive: false,
			parseDOM: [
				{
					tag: 'a[href]',
					getAttrs: (dom) => ({
						href: dom.getAttribute('href'),
						target: dom.getAttribute('target'),
						rel: dom.getAttribute('rel'),
						title: dom.getAttribute('title'),
					}),
				},
			],
			toDOM: (node) => {
				const attrs = { href: node.attrs.href };
				if (node.attrs.target) attrs.target = node.attrs.target;
				if (node.attrs.rel) attrs.rel = node.attrs.rel;
				if (node.attrs.title) attrs.title = node.attrs.title;
				return ['a', attrs, 0];
			},
		},

		em: {
			parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
			toDOM: () => ['em', 0],
		},

		strong: {
			parseDOM: [
				{ tag: 'strong' },
				{ tag: 'b' },
				{
					style: 'font-weight',
					getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
				},
			],
			toDOM: () => ['strong', 0],
		},

		underline: {
			parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
			toDOM: () => ['u', 0],
		},

		strike: {
			parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }, { style: 'text-decoration=line-through' }],
			toDOM: () => ['s', 0],
		},

		code: {
			parseDOM: [{ tag: 'code' }],
			toDOM: () => ['code', 0],
		},

		subscript: {
			parseDOM: [{ tag: 'sub' }],
			toDOM: () => ['sub', 0],
		},

		superscript: {
			parseDOM: [{ tag: 'sup' }],
			toDOM: () => ['sup', 0],
		},

		textColor: {
			attrs: { color: {} },
			parseDOM: [
				{
					style: 'color',
					getAttrs: (value) => (value ? { color: value } : false),
				},
			],
			toDOM: (mark) => ['span', { style: `color: ${mark.attrs.color}` }, 0],
		},

		backgroundColor: {
			attrs: { color: {} },
			parseDOM: [
				{
					style: 'background-color',
					getAttrs: (value) => (value ? { color: value } : false),
				},
			],
			toDOM: (mark) => ['span', { style: `background-color: ${mark.attrs.color}` }, 0],
		},

		fontSize: {
			attrs: { size: {} },
			parseDOM: [
				{
					style: 'font-size',
					getAttrs: (value) => (value ? { size: value } : false),
				},
			],
			toDOM: (mark) => ['span', { style: `font-size: ${mark.attrs.size}` }, 0],
		},

		fontFamily: {
			attrs: { family: {} },
			parseDOM: [
				{
					style: 'font-family',
					getAttrs: (value) => (value ? { family: value } : false),
				},
			],
			toDOM: (mark) => ['span', { style: `font-family: ${mark.attrs.family}` }, 0],
		},
	};

	/**
	 * Create the complete schema
	 */
	function createSchema() {
		// Start with base nodes
		let nodes = { ...baseNodes };

		// Add list nodes (ordered_list, bullet_list, list_item)
		const listNodes = addListNodes(
			// Create an OrderedMap-like object
			{
				size: Object.keys(nodes).length,
				get: (key) => nodes[key],
				forEach: (fn) => {
					for (const [key, value] of Object.entries(nodes)) {
						fn(key, value);
					}
				},
				append: function (newNodes) {
					const result = { ...nodes };
					if (typeof newNodes.forEach === 'function') {
						newNodes.forEach((key, value) => {
							result[key] = value;
						});
					} else {
						for (const [key, value] of Object.entries(newNodes)) {
							result[key] = value;
						}
					}
					return result;
				},
			},
			'paragraph block*',
			'block'
		);

		// Merge list nodes back
		if (typeof listNodes.forEach === 'function') {
			listNodes.forEach((key, value) => {
				nodes[key] = value;
			});
		} else {
			nodes = { ...nodes, ...listNodes };
		}

		// Add table nodes
		const tableNodeSpecs = tableNodes({
			tableGroup: 'block',
			cellContent: 'block+',
			cellAttributes: {
				background: {
					default: null,
					getFromDOM: (dom) => dom.style.backgroundColor || null,
					setDOMAttr: (value, attrs) => {
						if (value) {
							attrs.style = (attrs.style || '') + `background-color: ${value};`;
						}
					},
				},
				borderColor: {
					default: null,
					getFromDOM: (dom) => dom.style.borderColor || null,
					setDOMAttr: (value, attrs) => {
						if (value) {
							attrs.style = (attrs.style || '') + `border-color: ${value};`;
						}
					},
				},
			},
		});

		// Merge table nodes
		nodes = { ...nodes, ...tableNodeSpecs };

		return new Schema({ nodes, marks });
	}

	/**
	 * ProseMirrorSchema singleton
	 */
	const ProseMirrorSchema = {
		/**
		 * Get the schema instance (creates lazily)
		 */
		_schema: null,
		getSchema: function () {
			if (!this._schema) {
				this._schema = createSchema();
			}
			return this._schema;
		},

		/**
		 * Create a fresh schema instance
		 */
		createSchema: createSchema,

		/**
		 * Parse HTML string to ProseMirror document
		 */
		parseHTML: function (html) {
			const schema = this.getSchema();
			const div = document.createElement('div');
			div.innerHTML = html;
			return DOMParser.fromSchema(schema).parse(div);
		},

		/**
		 * Serialize ProseMirror document to HTML string
		 */
		serializeHTML: function (doc) {
			const schema = this.getSchema();
			const fragment = DOMSerializer.fromSchema(schema).serializeFragment(doc.content);
			const div = document.createElement('div');
			div.appendChild(fragment);
			return div.innerHTML;
		},
	};

	// Export globally
	window.ProseMirrorSchema = ProseMirrorSchema;
})();
