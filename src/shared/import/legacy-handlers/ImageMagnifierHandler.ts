/**
 * ImageMagnifierHandler
 *
 * Handles legacy ImageMagnifierIdevice.
 * Converts to modern 'magnifier' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.imagemagnifieridevice.ImageMagnifierIdevice
 *
 * Extracts:
 * - imageSrc - the main image path
 * - zoomSize - magnifier zoom level
 * - glassSize - magnifier glass size
 * - caption/description
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class ImageMagnifierHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('ImageMagnifierIdevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'magnifier';
    }

    /**
     * Extract any description/intro HTML
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Look for caption or description text
        const captionArea =
            this.findDictInstance(dict, 'captionTextArea') || this.findDictInstance(dict, 'descriptionTextArea');
        if (captionArea) {
            return this.extractTextAreaFieldContent(captionArea);
        }

        // Try direct caption value
        const caption = this.findDictStringValue(dict, 'caption') || this.findDictStringValue(dict, '_caption');
        if (caption) {
            return `<p>${caption}</p>`;
        }

        return '';
    }

    /**
     * No feedback for magnifier iDevice
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties including image and magnifier settings
     * Property names MUST match what the modern magnifier editor expects
     *
     * Based on Symfony OdeOldXmlImageMagnifierIdevice.php (lines 240-254):
     * - textTextarea, defaultImage, glassSize, initialZSize, maxZSize
     * - width, height, imageResource, isDefaultImage, message, align
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        // Default structure matching modern magnifier editor expectations
        const defaultProperties = {
            textTextarea: '', // Instructions (from htmlView/caption)
            imageResource: '', // Image path
            isDefaultImage: '1', // '0' = custom image, '1' = default
            width: '', // Image width
            height: '', // Image height
            align: 'left', // Alignment
            initialZSize: '100', // Initial zoom (100, 150, 200, etc.)
            maxZSize: '150', // Max zoom
            glassSize: '2', // Magnifier size (1-6 range)
        };

        if (!dict) return defaultProperties;

        const props = { ...defaultProperties };

        // Get MagnifierField dictionary for property extraction
        const magnifierDict = this.getMagnifierFieldDict(dict);

        // Extract textTextarea from TextAreaField (content_w_resourcePaths)
        const textArea = this.findDictInstance(dict, 'text');
        if (textArea) {
            props.textTextarea = this.extractTextAreaFieldContent(textArea);
        }

        // Extract align from float field (Symfony: 'align' => $floatValue)
        const floatValue = this.findDictStringValue(dict, 'float');
        if (floatValue) {
            props.align = floatValue;
        }

        // Extract from MagnifierField if found
        if (magnifierDict) {
            // glassSize (Symfony passes directly)
            const glassSize = this.findDictStringValue(magnifierDict, 'glassSize');
            if (glassSize) {
                props.glassSize = glassSize;
            }

            // initialZSize
            const initialZSize = this.findDictStringValue(magnifierDict, 'initialZSize');
            if (initialZSize) {
                props.initialZSize = initialZSize;
            }

            // maxZSize
            const maxZSize = this.findDictStringValue(magnifierDict, 'maxZSize');
            if (maxZSize) {
                props.maxZSize = maxZSize;
            }

            // width
            const width = this.findDictStringValue(magnifierDict, 'width');
            if (width) {
                props.width = width;
            }

            // height
            const height = this.findDictStringValue(magnifierDict, 'height');
            if (height) {
                props.height = height;
            }
        }

        // Extract image source -> imageResource
        // If there's an imageResource, it's a custom image (isDefaultImage = '0')
        const imagePath = this.extractImagePath(dict);
        if (imagePath) {
            props.imageResource = imagePath;
            props.isDefaultImage = '0'; // Has custom image - override any XML value
        }

        return props;
    }

    /**
     * Get the MagnifierField dictionary element
     */
    private getMagnifierFieldDict(dict: Element): Element | null {
        // Try by key 'imageMagnifier'
        const magnifierInst =
            this.findDictInstance(dict, 'imageMagnifier') ||
            this.findDictInstance(dict, '_magnifierField') ||
            this.findDictInstance(dict, 'magnifierField');
        if (magnifierInst) {
            return this.getDirectChildByTagName(magnifierInst, 'dictionary');
        }

        // Try by class directly
        const magnifierByClass = this.getDirectChildrenByTagName(dict, 'instance').find(inst =>
            (inst.getAttribute('class') || '').includes('MagnifierField'),
        );
        if (magnifierByClass) {
            return this.getDirectChildByTagName(magnifierByClass, 'dictionary');
        }

        return null;
    }

    /**
     * Extract image path from the legacy format
     *
     * Based on Symfony OdeOldXmlImageMagnifierIdevice.php:
     * - imageMagnifier -> exe.engine.field.MagnifierField
     * - imageResource -> exe.engine.resource.Resource
     * - _storageName -> filename
     *
     * @param dict - Dictionary element of the ImageMagnifierIdevice
     * @returns The image path or null
     */
    private extractImagePath(dict: Element): string | null {
        // Try MagnifierField instance first (key: imageMagnifier)
        const magnifierInst =
            this.findDictInstance(dict, 'imageMagnifier') ||
            this.findDictInstance(dict, '_magnifierField') ||
            this.findDictInstance(dict, 'magnifierField');
        if (magnifierInst) {
            const mDict = this.getDirectChildByTagName(magnifierInst, 'dictionary');
            if (mDict) {
                // Symfony extracts from imageResource -> _storageName
                const path =
                    this.extractResourcePath(mDict, 'imageResource') ||
                    this.extractResourcePath(mDict, '_imageResource');
                if (path) return `resources/${path}`;
            }
        }

        // Alternative: try by class directly (Symfony approach)
        const magnifierByClass = this.getDirectChildrenByTagName(dict, 'instance').find(inst =>
            (inst.getAttribute('class') || '').includes('MagnifierField'),
        );
        if (magnifierByClass) {
            const mDict = this.getDirectChildByTagName(magnifierByClass, 'dictionary');
            if (mDict) {
                const path =
                    this.extractResourcePath(mDict, 'imageResource') ||
                    this.extractResourcePath(mDict, '_imageResource');
                if (path) return `resources/${path}`;
            }
        }

        // Try direct image resource
        const path =
            this.extractResourcePath(dict, '_imageResource') ||
            this.extractResourcePath(dict, 'imageResource') ||
            this.extractResourcePath(dict, '_imagePath');

        return path ? `resources/${path}` : null;
    }
}
