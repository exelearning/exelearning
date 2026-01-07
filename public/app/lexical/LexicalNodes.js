/**
 * Lexical Custom Nodes
 *
 * Custom node implementations for the collaborative editor.
 * Includes media nodes (image, video, audio, iframe) with asset:// URL support.
 */
(function () {
    'use strict';

    const Logger = window.Logger || console;
    const {
        DecoratorNode,
        $applyNodeReplacement,
        $isNodeSelection,
        $getNodeByKey,
        $getSelection,
        COMMAND_PRIORITY_LOW,
        KEY_DELETE_COMMAND,
        KEY_BACKSPACE_COMMAND,
        CLICK_COMMAND,
    } = window.LexicalBundle;

    // ========================================================================
    // HorizontalRuleNode
    // ========================================================================

    class HorizontalRuleNode extends DecoratorNode {
        static getType() {
            return 'horizontal-rule';
        }

        static clone(node) {
            return new HorizontalRuleNode(node.__key);
        }

        constructor(key) {
            super(key);
        }

        createDOM() {
            const dom = document.createElement('hr');
            return dom;
        }

        updateDOM() {
            return false;
        }

        static importDOM() {
            return {
                hr: () => ({
                    conversion: () => ({ node: $createHorizontalRuleNode() }),
                    priority: 0,
                }),
            };
        }

        static importJSON() {
            return $createHorizontalRuleNode();
        }

        exportJSON() {
            return {
                type: 'horizontal-rule',
                version: 1,
            };
        }

        exportDOM() {
            return { element: document.createElement('hr') };
        }

        decorate() {
            return null;
        }

        isInline() {
            return false;
        }

        isKeyboardSelectable() {
            return true;
        }
    }

    function $createHorizontalRuleNode() {
        return $applyNodeReplacement(new HorizontalRuleNode());
    }

    function $isHorizontalRuleNode(node) {
        return node instanceof HorizontalRuleNode;
    }

    // ========================================================================
    // ImageNode
    // ========================================================================

    class ImageNode extends DecoratorNode {
        static getType() {
            return 'image';
        }

        static clone(node) {
            return new ImageNode(
                node.__src,
                node.__altText,
                node.__title,
                node.__width,
                node.__height,
                node.__dataAssetSrc,
                node.__dataAssetId,
                node.__className,
                node.__key
            );
        }

        constructor(src, altText, title, width, height, dataAssetSrc, dataAssetId, className, key) {
            super(key);
            this.__src = src;
            this.__altText = altText || '';
            this.__title = title || null;
            this.__width = width || null;
            this.__height = height || null;
            this.__dataAssetSrc = dataAssetSrc || null;
            this.__dataAssetId = dataAssetId || null;
            this.__className = className || null;
        }

        getSrc() {
            return this.__src;
        }

        getAltText() {
            return this.__altText;
        }

        getDataAssetSrc() {
            return this.__dataAssetSrc;
        }

        getDataAssetId() {
            return this.__dataAssetId;
        }

        getWidth() {
            return this.__width;
        }

        getHeight() {
            return this.__height;
        }

        /**
         * Set width and height (used by ImageResizer)
         * @param {number|string|null} width
         * @param {number|string|null} height
         */
        setWidthAndHeight(width, height) {
            const writable = this.getWritable();
            writable.__width = width;
            writable.__height = height;
        }

        createDOM(config) {
            const img = document.createElement('img');

            // Determine the correct src to use
            let srcToUse = this.__src;

            // If we have an asset:// URL, use that as the source of truth
            if (this.__dataAssetSrc && this.__dataAssetSrc.startsWith('asset://')) {
                // Set the asset src for resolution
                img.setAttribute('data-asset-src', this.__dataAssetSrc);

                // If the current src is a blob: from another client, it won't work
                // Use a placeholder or let the asset resolver handle it
                if (this.__src && this.__src.startsWith('blob:')) {
                    // Use asset:// URL - the AssetUrlResolver will convert it to blob:
                    srcToUse = this.__dataAssetSrc;
                }
            } else if (this.__dataAssetSrc) {
                img.setAttribute('data-asset-src', this.__dataAssetSrc);
            }

            img.src = srcToUse;
            img.alt = this.__altText;
            if (this.__title) img.title = this.__title;
            if (this.__width) img.width = this.__width;
            if (this.__height) img.height = this.__height;
            if (this.__dataAssetId) img.setAttribute('data-asset-id', this.__dataAssetId);
            if (this.__className) img.className = this.__className;
            // Add node key for easy lookup by ImageResizer
            img.setAttribute('data-lexical-key', this.__key);
            return img;
        }

        updateDOM(prevNode, dom) {
            // Handle src updates carefully for cross-client sync
            if (prevNode.__src !== this.__src) {
                let srcToUse = this.__src;
                // If we have asset:// URL and src is blob:, prefer asset://
                if (this.__dataAssetSrc && this.__dataAssetSrc.startsWith('asset://')) {
                    if (this.__src && this.__src.startsWith('blob:')) {
                        srcToUse = this.__dataAssetSrc;
                    }
                }
                dom.src = srcToUse;
            }
            if (prevNode.__altText !== this.__altText) dom.alt = this.__altText;
            if (prevNode.__title !== this.__title) {
                if (this.__title) dom.title = this.__title;
                else dom.removeAttribute('title');
            }
            if (prevNode.__width !== this.__width) {
                if (this.__width) dom.width = this.__width;
                else dom.removeAttribute('width');
            }
            if (prevNode.__height !== this.__height) {
                if (this.__height) dom.height = this.__height;
                else dom.removeAttribute('height');
            }
            if (prevNode.__dataAssetSrc !== this.__dataAssetSrc) {
                if (this.__dataAssetSrc) dom.setAttribute('data-asset-src', this.__dataAssetSrc);
                else dom.removeAttribute('data-asset-src');
            }
            if (prevNode.__dataAssetId !== this.__dataAssetId) {
                if (this.__dataAssetId) dom.setAttribute('data-asset-id', this.__dataAssetId);
                else dom.removeAttribute('data-asset-id');
            }
            if (prevNode.__className !== this.__className) {
                if (this.__className) dom.className = this.__className;
                else dom.removeAttribute('class');
            }
            return false;
        }

        static importDOM() {
            return {
                img: () => ({
                    conversion: (element) => {
                        const src = element.getAttribute('src');
                        if (!src) return null;
                        const node = $createImageNode({
                            src,
                            altText: element.getAttribute('alt') || '',
                            title: element.getAttribute('title'),
                            width: element.getAttribute('width'),
                            height: element.getAttribute('height'),
                            dataAssetSrc: element.getAttribute('data-asset-src'),
                            dataAssetId: element.getAttribute('data-asset-id'),
                            className: element.getAttribute('class'),
                        });
                        return { node };
                    },
                    priority: 0,
                }),
            };
        }

        static importJSON(serializedNode) {
            return $createImageNode({
                src: serializedNode.src,
                altText: serializedNode.altText,
                title: serializedNode.title,
                width: serializedNode.width,
                height: serializedNode.height,
                dataAssetSrc: serializedNode.dataAssetSrc,
                dataAssetId: serializedNode.dataAssetId,
                className: serializedNode.className,
            });
        }

        exportJSON() {
            return {
                type: 'image',
                version: 1,
                src: this.__src,
                altText: this.__altText,
                title: this.__title,
                width: this.__width,
                height: this.__height,
                dataAssetSrc: this.__dataAssetSrc,
                dataAssetId: this.__dataAssetId,
                className: this.__className,
            };
        }

        exportDOM() {
            const img = document.createElement('img');
            img.src = this.__src;
            img.alt = this.__altText;
            if (this.__title) img.title = this.__title;
            if (this.__width) img.width = this.__width;
            if (this.__height) img.height = this.__height;
            if (this.__dataAssetSrc) img.setAttribute('data-asset-src', this.__dataAssetSrc);
            if (this.__dataAssetId) img.setAttribute('data-asset-id', this.__dataAssetId);
            if (this.__className) img.className = this.__className;
            return { element: img };
        }

        decorate() {
            return null;
        }

        isInline() {
            return true;
        }

        isKeyboardSelectable() {
            return true;
        }
    }

    function $createImageNode(options) {
        const { src, altText, title, width, height, dataAssetSrc, dataAssetId, className } = options;
        return $applyNodeReplacement(
            new ImageNode(src, altText, title, width, height, dataAssetSrc, dataAssetId, className)
        );
    }

    function $isImageNode(node) {
        return node instanceof ImageNode;
    }

    // ========================================================================
    // VideoNode
    // ========================================================================

    class VideoNode extends DecoratorNode {
        static getType() {
            return 'video';
        }

        static clone(node) {
            return new VideoNode(
                node.__src,
                node.__dataAssetSrc,
                node.__dataAssetId,
                node.__controls,
                node.__width,
                node.__height,
                node.__poster,
                node.__key
            );
        }

        constructor(src, dataAssetSrc, dataAssetId, controls, width, height, poster, key) {
            super(key);
            this.__src = src;
            this.__dataAssetSrc = dataAssetSrc || null;
            this.__dataAssetId = dataAssetId || null;
            this.__controls = controls !== false;
            this.__width = width || null;
            this.__height = height || null;
            this.__poster = poster || null;
        }

        getSrc() {
            return this.__src;
        }

        getDataAssetSrc() {
            return this.__dataAssetSrc;
        }

        createDOM() {
            const video = document.createElement('video');
            video.src = this.__src;
            if (this.__controls) video.controls = true;
            if (this.__width) video.width = this.__width;
            if (this.__height) video.height = this.__height;
            if (this.__poster) video.poster = this.__poster;
            if (this.__dataAssetSrc) video.setAttribute('data-asset-src', this.__dataAssetSrc);
            if (this.__dataAssetId) video.setAttribute('data-asset-id', this.__dataAssetId);
            return video;
        }

        updateDOM(prevNode, dom) {
            if (prevNode.__src !== this.__src) dom.src = this.__src;
            if (prevNode.__controls !== this.__controls) dom.controls = this.__controls;
            if (prevNode.__width !== this.__width) {
                if (this.__width) dom.width = this.__width;
                else dom.removeAttribute('width');
            }
            if (prevNode.__height !== this.__height) {
                if (this.__height) dom.height = this.__height;
                else dom.removeAttribute('height');
            }
            if (prevNode.__poster !== this.__poster) {
                if (this.__poster) dom.poster = this.__poster;
                else dom.removeAttribute('poster');
            }
            if (prevNode.__dataAssetSrc !== this.__dataAssetSrc) {
                if (this.__dataAssetSrc) dom.setAttribute('data-asset-src', this.__dataAssetSrc);
                else dom.removeAttribute('data-asset-src');
            }
            if (prevNode.__dataAssetId !== this.__dataAssetId) {
                if (this.__dataAssetId) dom.setAttribute('data-asset-id', this.__dataAssetId);
                else dom.removeAttribute('data-asset-id');
            }
            return false;
        }

        static importDOM() {
            return {
                video: () => ({
                    conversion: (element) => {
                        const src = element.getAttribute('src');
                        if (!src) return null;
                        const node = $createVideoNode({
                            src,
                            dataAssetSrc: element.getAttribute('data-asset-src'),
                            dataAssetId: element.getAttribute('data-asset-id'),
                            controls: element.hasAttribute('controls'),
                            width: element.getAttribute('width'),
                            height: element.getAttribute('height'),
                            poster: element.getAttribute('poster'),
                        });
                        return { node };
                    },
                    priority: 0,
                }),
            };
        }

        static importJSON(serializedNode) {
            return $createVideoNode({
                src: serializedNode.src,
                dataAssetSrc: serializedNode.dataAssetSrc,
                dataAssetId: serializedNode.dataAssetId,
                controls: serializedNode.controls,
                width: serializedNode.width,
                height: serializedNode.height,
                poster: serializedNode.poster,
            });
        }

        exportJSON() {
            return {
                type: 'video',
                version: 1,
                src: this.__src,
                dataAssetSrc: this.__dataAssetSrc,
                dataAssetId: this.__dataAssetId,
                controls: this.__controls,
                width: this.__width,
                height: this.__height,
                poster: this.__poster,
            };
        }

        exportDOM() {
            const video = document.createElement('video');
            video.src = this.__src;
            if (this.__controls) video.controls = true;
            if (this.__width) video.width = this.__width;
            if (this.__height) video.height = this.__height;
            if (this.__poster) video.poster = this.__poster;
            if (this.__dataAssetSrc) video.setAttribute('data-asset-src', this.__dataAssetSrc);
            if (this.__dataAssetId) video.setAttribute('data-asset-id', this.__dataAssetId);
            return { element: video };
        }

        decorate() {
            return null;
        }

        isInline() {
            return false;
        }

        isKeyboardSelectable() {
            return true;
        }
    }

    function $createVideoNode(options) {
        const { src, dataAssetSrc, dataAssetId, controls, width, height, poster } = options;
        return $applyNodeReplacement(
            new VideoNode(src, dataAssetSrc, dataAssetId, controls, width, height, poster)
        );
    }

    function $isVideoNode(node) {
        return node instanceof VideoNode;
    }

    // ========================================================================
    // AudioNode
    // ========================================================================

    class AudioNode extends DecoratorNode {
        static getType() {
            return 'audio';
        }

        static clone(node) {
            return new AudioNode(
                node.__src,
                node.__dataAssetSrc,
                node.__dataAssetId,
                node.__controls,
                node.__key
            );
        }

        constructor(src, dataAssetSrc, dataAssetId, controls, key) {
            super(key);
            this.__src = src;
            this.__dataAssetSrc = dataAssetSrc || null;
            this.__dataAssetId = dataAssetId || null;
            this.__controls = controls !== false;
        }

        getSrc() {
            return this.__src;
        }

        getDataAssetSrc() {
            return this.__dataAssetSrc;
        }

        createDOM() {
            const audio = document.createElement('audio');
            audio.src = this.__src;
            if (this.__controls) audio.controls = true;
            if (this.__dataAssetSrc) audio.setAttribute('data-asset-src', this.__dataAssetSrc);
            if (this.__dataAssetId) audio.setAttribute('data-asset-id', this.__dataAssetId);
            return audio;
        }

        updateDOM(prevNode, dom) {
            if (prevNode.__src !== this.__src) dom.src = this.__src;
            if (prevNode.__controls !== this.__controls) dom.controls = this.__controls;
            if (prevNode.__dataAssetSrc !== this.__dataAssetSrc) {
                if (this.__dataAssetSrc) dom.setAttribute('data-asset-src', this.__dataAssetSrc);
                else dom.removeAttribute('data-asset-src');
            }
            if (prevNode.__dataAssetId !== this.__dataAssetId) {
                if (this.__dataAssetId) dom.setAttribute('data-asset-id', this.__dataAssetId);
                else dom.removeAttribute('data-asset-id');
            }
            return false;
        }

        static importDOM() {
            return {
                audio: () => ({
                    conversion: (element) => {
                        const src = element.getAttribute('src');
                        if (!src) return null;
                        const node = $createAudioNode({
                            src,
                            dataAssetSrc: element.getAttribute('data-asset-src'),
                            dataAssetId: element.getAttribute('data-asset-id'),
                            controls: element.hasAttribute('controls'),
                        });
                        return { node };
                    },
                    priority: 0,
                }),
            };
        }

        static importJSON(serializedNode) {
            return $createAudioNode({
                src: serializedNode.src,
                dataAssetSrc: serializedNode.dataAssetSrc,
                dataAssetId: serializedNode.dataAssetId,
                controls: serializedNode.controls,
            });
        }

        exportJSON() {
            return {
                type: 'audio',
                version: 1,
                src: this.__src,
                dataAssetSrc: this.__dataAssetSrc,
                dataAssetId: this.__dataAssetId,
                controls: this.__controls,
            };
        }

        exportDOM() {
            const audio = document.createElement('audio');
            audio.src = this.__src;
            if (this.__controls) audio.controls = true;
            if (this.__dataAssetSrc) audio.setAttribute('data-asset-src', this.__dataAssetSrc);
            if (this.__dataAssetId) audio.setAttribute('data-asset-id', this.__dataAssetId);
            return { element: audio };
        }

        decorate() {
            return null;
        }

        isInline() {
            return false;
        }

        isKeyboardSelectable() {
            return true;
        }
    }

    function $createAudioNode(options) {
        const { src, dataAssetSrc, dataAssetId, controls } = options;
        return $applyNodeReplacement(new AudioNode(src, dataAssetSrc, dataAssetId, controls));
    }

    function $isAudioNode(node) {
        return node instanceof AudioNode;
    }

    // ========================================================================
    // IframeNode
    // ========================================================================

    class IframeNode extends DecoratorNode {
        static getType() {
            return 'iframe';
        }

        static clone(node) {
            return new IframeNode(
                node.__src,
                node.__dataAssetId,
                node.__width,
                node.__height,
                node.__frameborder,
                node.__allowfullscreen,
                node.__key
            );
        }

        constructor(src, dataAssetId, width, height, frameborder, allowfullscreen, key) {
            super(key);
            this.__src = src;
            this.__dataAssetId = dataAssetId || null;
            this.__width = width || '100%';
            this.__height = height || '400';
            this.__frameborder = frameborder || '0';
            this.__allowfullscreen = allowfullscreen !== false;
        }

        getSrc() {
            return this.__src;
        }

        createDOM() {
            const wrapper = document.createElement('div');
            wrapper.className = 'lexical-iframe-wrapper';

            const iframe = document.createElement('iframe');
            iframe.src = this.__src;
            iframe.width = this.__width;
            iframe.height = this.__height;
            iframe.frameBorder = this.__frameborder;
            if (this.__allowfullscreen) iframe.allowFullscreen = true;
            if (this.__dataAssetId) iframe.setAttribute('data-asset-id', this.__dataAssetId);

            wrapper.appendChild(iframe);
            return wrapper;
        }

        updateDOM(prevNode, dom) {
            const iframe = dom.querySelector('iframe');
            if (!iframe) return true;

            if (prevNode.__src !== this.__src) iframe.src = this.__src;
            if (prevNode.__width !== this.__width) iframe.width = this.__width;
            if (prevNode.__height !== this.__height) iframe.height = this.__height;
            if (prevNode.__frameborder !== this.__frameborder) iframe.frameBorder = this.__frameborder;
            if (prevNode.__allowfullscreen !== this.__allowfullscreen) {
                iframe.allowFullscreen = this.__allowfullscreen;
            }
            if (prevNode.__dataAssetId !== this.__dataAssetId) {
                if (this.__dataAssetId) iframe.setAttribute('data-asset-id', this.__dataAssetId);
                else iframe.removeAttribute('data-asset-id');
            }
            return false;
        }

        static importDOM() {
            return {
                iframe: () => ({
                    conversion: (element) => {
                        const src = element.getAttribute('src');
                        if (!src) return null;
                        const node = $createIframeNode({
                            src,
                            dataAssetId: element.getAttribute('data-asset-id'),
                            width: element.getAttribute('width') || '100%',
                            height: element.getAttribute('height') || '400',
                            frameborder: element.getAttribute('frameborder') || '0',
                            allowfullscreen: element.hasAttribute('allowfullscreen'),
                        });
                        return { node };
                    },
                    priority: 0,
                }),
            };
        }

        static importJSON(serializedNode) {
            return $createIframeNode({
                src: serializedNode.src,
                dataAssetId: serializedNode.dataAssetId,
                width: serializedNode.width,
                height: serializedNode.height,
                frameborder: serializedNode.frameborder,
                allowfullscreen: serializedNode.allowfullscreen,
            });
        }

        exportJSON() {
            return {
                type: 'iframe',
                version: 1,
                src: this.__src,
                dataAssetId: this.__dataAssetId,
                width: this.__width,
                height: this.__height,
                frameborder: this.__frameborder,
                allowfullscreen: this.__allowfullscreen,
            };
        }

        exportDOM() {
            const iframe = document.createElement('iframe');
            iframe.src = this.__src;
            iframe.width = this.__width;
            iframe.height = this.__height;
            iframe.frameBorder = this.__frameborder;
            if (this.__allowfullscreen) iframe.allowFullscreen = true;
            if (this.__dataAssetId) iframe.setAttribute('data-asset-id', this.__dataAssetId);
            return { element: iframe };
        }

        decorate() {
            return null;
        }

        isInline() {
            return false;
        }

        isKeyboardSelectable() {
            return true;
        }
    }

    function $createIframeNode(options) {
        const { src, dataAssetId, width, height, frameborder, allowfullscreen } = options;
        return $applyNodeReplacement(
            new IframeNode(src, dataAssetId, width, height, frameborder, allowfullscreen)
        );
    }

    function $isIframeNode(node) {
        return node instanceof IframeNode;
    }

    // ========================================================================
    // Get all custom node classes (for editor registration)
    // ========================================================================

    function getCustomNodes() {
        return [HorizontalRuleNode, ImageNode, VideoNode, AudioNode, IframeNode];
    }

    // ========================================================================
    // Export
    // ========================================================================

    window.LexicalNodes = {
        // Node classes
        HorizontalRuleNode,
        ImageNode,
        VideoNode,
        AudioNode,
        IframeNode,

        // Factory functions
        $createHorizontalRuleNode,
        $createImageNode,
        $createVideoNode,
        $createAudioNode,
        $createIframeNode,

        // Type check functions
        $isHorizontalRuleNode,
        $isImageNode,
        $isVideoNode,
        $isAudioNode,
        $isIframeNode,

        // Helper to get all custom node classes
        getCustomNodes,
    };

    Logger.log('[LexicalNodes] Custom nodes registered');
})();
