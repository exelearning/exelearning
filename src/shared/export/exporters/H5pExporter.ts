/**
 * H5pExporter
 *
 * Exports a document to H5P interactive content format (experimental).
 * Generates an H5P package using H5P.Column as the main library with:
 * - H5P.AdvancedText for rich text content
 * - H5P.Image for standalone images
 *
 * H5P is a ZIP archive with specific structure:
 * - h5p.json (manifest)
 * - content/content.json (H5P.Column structure)
 * - content/images/ (extracted images)
 * - H5P library stubs
 */

import type { ExportPage, ExportMetadata, ExportOptions, ExportResult } from '../interfaces';
import { BaseExporter } from './BaseExporter';

/**
 * H5P Library versions used
 */
const H5P_LIBRARIES = {
    COLUMN: { machineName: 'H5P.Column', majorVersion: 1, minorVersion: 16 },
    ADVANCED_TEXT: { machineName: 'H5P.AdvancedText', majorVersion: 1, minorVersion: 1 },
    IMAGE: { machineName: 'H5P.Image', majorVersion: 1, minorVersion: 1 },
} as const;

/**
 * MIME types for images
 */
const IMAGE_MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
};

/**
 * Extracted image info
 */
interface ExtractedImage {
    id: string;
    filename: string;
    mime: string;
    data: Uint8Array | string;
}

/**
 * H5P Column content item
 */
interface H5PColumnItem {
    content: {
        library: string;
        params: Record<string, unknown>;
        subContentId?: string;
        metadata?: Record<string, unknown>;
    };
    useSeparator?: string;
}

export class H5pExporter extends BaseExporter {
    private extractedImages: Map<string, ExtractedImage> = new Map();
    private imageCounter = 0;

    /**
     * Get file extension for H5P format
     */
    getFileExtension(): string {
        return '.h5p';
    }

    /**
     * Get file suffix for H5P format
     */
    getFileSuffix(): string {
        return '_h5p';
    }

    /**
     * Export to H5P
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const exportFilename = options?.filename || this.buildFilename();

        try {
            // Reset state
            this.extractedImages = new Map();
            this.imageCounter = 0;

            let pages = this.buildPageList();
            const meta = this.getMetadata();

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // Build asset filename map for image extraction
            await this.buildAssetFilenameMap();

            // 1. Generate H5P Column content structure
            const columnContent = await this.generateColumnContent(pages, meta);

            // 2. Generate h5p.json manifest
            const h5pJson = this.generateH5PManifest(meta);
            this.zip.addFile('h5p.json', JSON.stringify(h5pJson, null, 2));

            // 3. Generate content/content.json
            this.zip.addFile('content/content.json', JSON.stringify(columnContent, null, 2));

            // 4. Add extracted images to content/images/
            for (const [, image] of this.extractedImages) {
                this.zip.addFile(`content/images/${image.filename}`, image.data);
            }

            // 5. Add H5P library stubs
            this.addLibraryStubs();

            // 6. Generate ZIP buffer
            const buffer = await this.zip.generateAsync();

            return {
                success: true,
                filename: exportFilename,
                data: buffer,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Generate H5P manifest (h5p.json)
     */
    private generateH5PManifest(meta: ExportMetadata): Record<string, unknown> {
        return {
            title: meta.title || 'eXeLearning Export',
            language: meta.language || 'en',
            mainLibrary: H5P_LIBRARIES.COLUMN.machineName,
            embedTypes: ['iframe'],
            license: 'U', // Undisclosed
            authors: meta.author ? [{ name: meta.author, role: 'Author' }] : [],
            preloadedDependencies: [H5P_LIBRARIES.COLUMN, H5P_LIBRARIES.ADVANCED_TEXT, H5P_LIBRARIES.IMAGE],
        };
    }

    /**
     * Generate H5P.Column content structure
     */
    private async generateColumnContent(pages: ExportPage[], meta: ExportMetadata): Promise<Record<string, unknown>> {
        const items: H5PColumnItem[] = [];

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const page = pages[pageIndex];

            // Add page title as separator/header
            items.push(this.createAdvancedTextItem(`<h2>${this.escapeHtml(page.title)}</h2>`, true));

            // Process each block
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.content) {
                        // Process content: extract images and convert HTML
                        const processedItems = await this.processComponentContent(component.content);
                        items.push(...processedItems);
                    }
                }
            }
        }

        return {
            content: items,
        };
    }

    /**
     * Process component content: extract images and create H5P items
     */
    private async processComponentContent(htmlContent: string): Promise<H5PColumnItem[]> {
        const items: H5PColumnItem[] = [];

        // Extract and replace asset:// URLs with relative image paths
        const processedHtml = await this.extractAndReplaceImages(htmlContent);

        // Create AdvancedText item with processed content
        if (processedHtml.trim()) {
            items.push(this.createAdvancedTextItem(processedHtml));
        }

        return items;
    }

    /**
     * Extract images from HTML content and replace URLs
     */
    private async extractAndReplaceImages(html: string): Promise<string> {
        let result = html;

        // Find all asset:// URLs in img src attributes
        const assetPattern = /src=["']asset:\/\/([a-f0-9-]+)(?:\/([^"']+))?["']/gi;
        const matches = [...html.matchAll(assetPattern)];

        for (const match of matches) {
            const [fullMatch, assetId, filename] = match;

            try {
                // Try to get the asset
                const assets = await this.assets.getAllAssets();
                const asset = assets.find(a => a.id === assetId);

                if (asset?.data) {
                    const ext = this.getExtensionFromFilename(filename || asset.filename || '');
                    const imageName = `image-${++this.imageCounter}${ext}`;
                    const mime = IMAGE_MIME_TYPES[ext] || 'image/png';

                    // Store extracted image
                    this.extractedImages.set(assetId, {
                        id: assetId,
                        filename: imageName,
                        mime,
                        data: asset.data,
                    });

                    // Replace URL in HTML
                    result = result.replace(fullMatch, `src="images/${imageName}"`);
                }
            } catch {
                // Asset not found, remove the image tag or leave as-is
                console.warn(`[H5pExporter] Could not extract asset: ${assetId}`);
            }
        }

        // Also handle resources/ path pattern (for already resolved assets)
        const resourcePattern = /src=["'](?:\.\.\/)?(?:content\/)?resources\/([^"']+)["']/gi;
        const resourceMatches = [...result.matchAll(resourcePattern)];

        for (const match of resourceMatches) {
            const [fullMatch, resourcePath] = match;
            const filename = resourcePath.split('/').pop() || '';
            const ext = this.getExtensionFromFilename(filename);

            if (IMAGE_MIME_TYPES[ext]) {
                // It's an image, try to get it from assets
                try {
                    const assets = await this.assets.getAllAssets();
                    // Find by path or filename
                    const asset = assets.find(a => a.originalPath?.includes(resourcePath) || a.filename === filename);

                    if (asset?.data) {
                        const imageName = `image-${++this.imageCounter}${ext}`;

                        this.extractedImages.set(asset.id, {
                            id: asset.id,
                            filename: imageName,
                            mime: IMAGE_MIME_TYPES[ext] || 'image/png',
                            data: asset.data,
                        });

                        result = result.replace(fullMatch, `src="images/${imageName}"`);
                    }
                } catch {
                    // Continue without this image
                }
            }
        }

        return result;
    }

    /**
     * Create an H5P.AdvancedText item
     */
    private createAdvancedTextItem(text: string, useSeparator = false): H5PColumnItem {
        const item: H5PColumnItem = {
            content: {
                library: `${H5P_LIBRARIES.ADVANCED_TEXT.machineName} ${H5P_LIBRARIES.ADVANCED_TEXT.majorVersion}.${H5P_LIBRARIES.ADVANCED_TEXT.minorVersion}`,
                params: {
                    text: text,
                },
                subContentId: this.generateSubContentId(),
                metadata: {
                    contentType: 'Text',
                    license: 'U',
                    title: 'Untitled Text',
                },
            },
        };

        if (useSeparator) {
            item.useSeparator = 'auto';
        }

        return item;
    }

    /**
     * Generate unique subContentId
     */
    private generateSubContentId(): string {
        return crypto.randomUUID();
    }

    /**
     * Get file extension from filename
     */
    private getExtensionFromFilename(filename: string): string {
        const lastDot = filename.lastIndexOf('.');
        return lastDot > 0 ? filename.substring(lastDot).toLowerCase() : '.png';
    }

    /**
     * Add H5P libraries with real implementations
     * Source: https://github.com/h5p (MIT License)
     */
    private addLibraryStubs(): void {
        // H5P.Column library
        this.zip.addFile(
            'H5P.Column-1.16/library.json',
            JSON.stringify(
                {
                    title: 'Column',
                    machineName: 'H5P.Column',
                    majorVersion: 1,
                    minorVersion: 16,
                    patchVersion: 0,
                    runnable: 1,
                    license: 'MIT',
                    author: 'Joubel',
                    preloadedJs: [{ path: 'scripts/h5p-column.js' }],
                    preloadedCss: [{ path: 'styles/h5p-column.css' }],
                    preloadedDependencies: [
                        { machineName: 'H5P.AdvancedText', majorVersion: 1, minorVersion: 1 },
                        { machineName: 'H5P.Image', majorVersion: 1, minorVersion: 1 },
                    ],
                },
                null,
                2,
            ),
        );
        this.zip.addFile(
            'H5P.Column-1.16/semantics.json',
            JSON.stringify(
                [
                    {
                        name: 'content',
                        type: 'list',
                        label: 'Content items',
                        entity: 'content item',
                        field: {
                            name: 'content',
                            type: 'library',
                        },
                    },
                ],
                null,
                2,
            ),
        );
        // Real H5P.Column implementation (MIT License - https://github.com/h5p/h5p-column)
        this.zip.addFile('H5P.Column-1.16/scripts/h5p-column.js', H5P_COLUMN_JS);
        this.zip.addFile('H5P.Column-1.16/styles/h5p-column.css', H5P_COLUMN_CSS);

        // H5P.AdvancedText library
        this.zip.addFile(
            'H5P.AdvancedText-1.1/library.json',
            JSON.stringify(
                {
                    title: 'Advanced Text',
                    machineName: 'H5P.AdvancedText',
                    majorVersion: 1,
                    minorVersion: 1,
                    patchVersion: 0,
                    runnable: 0,
                    license: 'MIT',
                    author: 'Joubel',
                    preloadedJs: [{ path: 'text.js' }],
                    preloadedCss: [{ path: 'text.css' }],
                },
                null,
                2,
            ),
        );
        this.zip.addFile(
            'H5P.AdvancedText-1.1/semantics.json',
            JSON.stringify(
                [
                    {
                        name: 'text',
                        type: 'text',
                        widget: 'html',
                        label: 'Text',
                    },
                ],
                null,
                2,
            ),
        );
        // Real H5P.AdvancedText implementation (MIT License - https://github.com/h5p/h5p-advanced-text)
        this.zip.addFile('H5P.AdvancedText-1.1/text.js', H5P_ADVANCED_TEXT_JS);
        this.zip.addFile('H5P.AdvancedText-1.1/text.css', H5P_ADVANCED_TEXT_CSS);

        // H5P.Image library
        this.zip.addFile(
            'H5P.Image-1.1/library.json',
            JSON.stringify(
                {
                    title: 'Image',
                    machineName: 'H5P.Image',
                    majorVersion: 1,
                    minorVersion: 1,
                    patchVersion: 0,
                    runnable: 0,
                    license: 'MIT',
                    author: 'Joubel',
                    preloadedJs: [{ path: 'image.js' }],
                    preloadedCss: [{ path: 'image.css' }],
                },
                null,
                2,
            ),
        );
        this.zip.addFile(
            'H5P.Image-1.1/semantics.json',
            JSON.stringify(
                [
                    {
                        name: 'file',
                        type: 'file',
                        label: 'Image file',
                    },
                    {
                        name: 'alt',
                        type: 'text',
                        label: 'Alternative text',
                    },
                ],
                null,
                2,
            ),
        );
        // Real H5P.Image implementation (MIT License - https://github.com/h5p/h5p-image)
        this.zip.addFile('H5P.Image-1.1/image.js', H5P_IMAGE_JS);
        this.zip.addFile('H5P.Image-1.1/image.css', H5P_IMAGE_CSS);
    }
}

/**
 * H5P Library Implementations
 * Source: https://github.com/h5p (MIT License)
 */

// H5P.Column JavaScript (https://github.com/h5p/h5p-column)
const H5P_COLUMN_JS = `H5P.Column = (function (EventDispatcher) {
  function Column(params, id, data) {
    var self = this;
    EventDispatcher.call(self);
    params = params || {};
    if (params.useSeparators === undefined) params.useSeparators = true;
    if (params.content === undefined) params.content = [];
    this.contentData = data;
    var wrapper;
    var instances = [];
    var instanceContainers = [];
    var numTasks = 0;
    var numTasksCompleted = 0;
    var tasksResultEvent = [];
    var previousHasMargin;

    var completed = function () {
      var raw = 0, max = 0;
      for (var i = 0; i < tasksResultEvent.length; i++) {
        var event = tasksResultEvent[i];
        raw += event.getScore();
        max += event.getMaxScore();
      }
      self.triggerXAPIScored(raw, max, 'completed');
    };

    var trackScoring = function (taskIndex) {
      return function (event) {
        if (event.getScore() === null) return;
        if (tasksResultEvent[taskIndex] === undefined) numTasksCompleted++;
        tasksResultEvent[taskIndex] = event;
        var progressed = self.createXAPIEventTemplate('progressed');
        progressed.data.statement.object.definition.extensions['http://id.tincanapi.com/extension/ending-point'] = taskIndex + 1;
        self.trigger(progressed);
        if (numTasksCompleted === numTasks) {
          setTimeout(function () { completed(); }, 0);
        }
      };
    };

    var taskDoneListener = function (taskIndex) {
      return function (event) {
        if (!event.getVerifiedStatementValue(['context', 'contextActivities', 'parent'])) {
          trackScoring(taskIndex)(event);
        }
      };
    };

    var isTask = function (library) {
      var dominated = ['H5P.MultiChoice', 'H5P.Essay', 'H5P.DragText', 'H5P.Blanks', 'H5P.MarkTheWords', 'H5P.DragQuestion', 'H5P.TrueFalse', 'H5P.MemoryGame', 'H5P.QuestionSet', 'H5P.InteractiveVideo', 'H5P.CoursePresentation', 'H5P.Summary', 'H5P.ImageHotspots', 'H5P.ImageHotspotQuestion', 'H5P.ImageMultipleHotspotQuestion', 'H5P.ImageSequencing', 'H5P.Flashcards', 'H5P.Questionnaire', 'H5P.Dictation', 'H5P.FindTheWords', 'H5P.GuessTheAnswer', 'H5P.SpeakTheWords', 'H5P.SpeakTheWordsSet', 'H5P.Agamotto', 'H5P.ImageSlider', 'H5P.Cornell', 'H5P.Crossword', 'H5P.SortParagraphs'];
      return dominated.indexOf(library.split(' ')[0]) > -1;
    };

    var addSeparator = function (container, singleContent, first) {
      if (first && singleContent.useSeparator === 'auto') return false;
      if (!params.useSeparators) return false;
      if (singleContent.useSeparator === 'disabled') return false;
      if (singleContent.useSeparator !== 'enabled' && singleContent.useSeparator !== 'auto') return false;
      var sep = document.createElement('div');
      sep.classList.add('h5p-column-separator');
      container.appendChild(sep);
      return true;
    };

    self.attach = function ($container) {
      $container[0].classList.add('h5p-column');
      wrapper = $container[0];
      if (!wrapper.querySelector('.h5p-column-content')) {
        for (var i = 0; i < params.content.length; i++) {
          var singleContent = params.content[i];
          if (singleContent.content) {
            var divContent = document.createElement('div');
            divContent.classList.add('h5p-column-content');
            addSeparator(wrapper, singleContent, i === 0);
            wrapper.appendChild(divContent);
            var instance = H5P.newRunnable(singleContent.content, id, H5P.jQuery(divContent), true, { previousState: (data && data.children) ? data.children[i] : undefined });
            if (instance) {
              instances.push(instance);
              instanceContainers.push(divContent);
              if (isTask(singleContent.content.library)) {
                instance.on('xAPI', taskDoneListener(numTasks));
                numTasks++;
              }
              instance.on('resize', function () { self.trigger('resize'); });
            }
          }
        }
      }
    };

    self.getCurrentState = function () {
      var children = [];
      for (var i = 0; i < instances.length; i++) {
        if (instances[i].getCurrentState) children.push(instances[i].getCurrentState());
        else children.push({});
      }
      return { children: children };
    };
  }
  Column.prototype = Object.create(EventDispatcher.prototype);
  Column.prototype.constructor = Column;
  return Column;
})(H5P.EventDispatcher);`;

// H5P.Column CSS
const H5P_COLUMN_CSS = `.h5p-column {
  max-width: 100%;
  overflow: hidden;
}
.h5p-column-content {
  margin: 0 0 1em 0;
}
.h5p-column-content:last-child {
  margin-bottom: 0;
}
.h5p-column-separator {
  border-top: 1px solid #ccc;
  margin: 1.5em 0;
}`;

// H5P.AdvancedText JavaScript (https://github.com/h5p/h5p-advanced-text)
const H5P_ADVANCED_TEXT_JS = `H5P.AdvancedText = (function ($, EventDispatcher) {
  function AdvancedText(parameters, id) {
    var self = this;
    EventDispatcher.call(this);
    var html = (parameters.text === undefined ? '<em>New text</em>' : parameters.text);
    self.attach = function ($container) {
      $container.addClass('h5p-advanced-text').html(html);
    };
  }
  AdvancedText.prototype = Object.create(EventDispatcher.prototype);
  AdvancedText.prototype.constructor = AdvancedText;
  return AdvancedText;
})(H5P.jQuery, H5P.EventDispatcher);`;

// H5P.AdvancedText CSS
const H5P_ADVANCED_TEXT_CSS = `.h5p-advanced-text {
  overflow: auto;
}
.h5p-advanced-text img {
  max-width: 100%;
  height: auto;
}`;

// H5P.Image JavaScript (https://github.com/h5p/h5p-image)
const H5P_IMAGE_JS = `H5P.Image = (function ($, EventDispatcher) {
  function Image(params, id, extras) {
    var self = this;
    EventDispatcher.call(this);
    this.params = params;
    this.id = id;
    this.extras = extras;

    self.attach = function ($wrapper) {
      var source = H5P.getPath(params.file.path, id);
      var alt = params.alt || '';
      var title = params.title || '';
      var img = document.createElement('img');
      img.src = source;
      img.alt = alt;
      if (title) img.title = title;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      $wrapper.addClass('h5p-image').html('').append(img);
      img.onload = function() { self.trigger('resize'); };
    };
  }
  Image.prototype = Object.create(EventDispatcher.prototype);
  Image.prototype.constructor = Image;
  return Image;
})(H5P.jQuery, H5P.EventDispatcher);`;

// H5P.Image CSS
const H5P_IMAGE_CSS = `.h5p-image {
  text-align: center;
}
.h5p-image img {
  max-width: 100%;
  height: auto;
}`;
