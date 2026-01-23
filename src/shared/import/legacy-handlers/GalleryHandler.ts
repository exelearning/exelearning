/**
 * GalleryHandler
 *
 * Handles legacy ImageGalleryIdevice and GalleryIdevice.
 * Converts to modern 'image-gallery' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.imagegalleryldevice.ImageGalleryIdevice
 * - exe.engine.galleryidevice.GalleryIdevice
 *
 * Extracts:
 * - images list with src, alt, caption
 * - gallery settings
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Image structure for gallery
 */
interface GalleryImage {
    src: string;
    alt: string;
    caption: string;
    thumbnail?: string;
}

/**
 * Modern gallery image format (indexed properties)
 */
interface GalleryImageProperty {
    img: string;
    thumbnail: string;
    title: string;
    linktitle: string;
    author: string;
    linkauthor: string;
    license: string;
}

export class GalleryHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('ImageGalleryIdevice') || className.includes('GalleryIdevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'image-gallery';
    }

    /**
     * Extract any intro/description content
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Look for description or intro text
        const descriptionArea = this.findDictInstance(dict, 'descriptionTextArea');
        if (descriptionArea) {
            return this.extractTextAreaFieldContent(descriptionArea);
        }

        return '';
    }

    /**
     * No feedback for gallery iDevice
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties in format expected by modern image-gallery iDevice
     *
     * Modern format uses indexed keys (img_0, img_1, etc.) with fields:
     * - img: image path with resources/ prefix
     * - thumbnail: thumbnail path with resources/ prefix (optional)
     * - title: caption text
     * - linktitle, author, linkauthor, license: attribution fields
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, GalleryImageProperty> {
        const images = this.extractImages(dict);
        const props: Record<string, GalleryImageProperty> = {};

        // Convert to indexed format expected by modern iDevice
        // The image-gallery edition code uses Object.entries() and expects img_N keys
        // Paths need resources/ prefix as that's where assets are stored
        images.forEach((image, index) => {
            props[`img_${index}`] = {
                img: `resources/${image.src}`, // Add resources/ prefix
                thumbnail: image.thumbnail ? `resources/${image.thumbnail}` : '', // Include thumbnail with prefix
                title: image.caption || '', // caption -> title
                linktitle: '', // Not available in legacy format
                author: '', // Not available in legacy format
                linkauthor: '', // Not available in legacy format
                license: '', // Not available in legacy format
            };
        });

        return props;
    }

    /**
     * Extract images from the legacy format
     *
     * Legacy XML structure:
     * - "images" key points to a GalleryImages wrapper instance
     * - The actual list is inside that wrapper under ".listitems" key
     * - Each GalleryImage has: _imageResource, _caption (TextField), _thumbnailResource
     *
     * @param dict - Dictionary element of the GalleryIdevice
     * @returns Array of image objects
     */
    private extractImages(dict: Element): GalleryImage[] {
        const images: GalleryImage[] = [];
        let imagesList: Element | null = null;

        // STEP 1: Find the images list
        // The "images" key points to a GalleryImages instance wrapper
        // The actual list is inside that instance under ".listitems"
        const imagesInstance = this.findDictInstance(dict, 'images') || this.findDictInstance(dict, '_images');

        if (imagesInstance) {
            const imagesDict = this.getDirectChildByTagName(imagesInstance, 'dictionary');
            if (imagesDict) {
                // The actual list is under ".listitems" inside the wrapper
                imagesList = this.findDictList(imagesDict, '.listitems');
            }
        }

        // Fallback: direct list containing GalleryImage instances (some formats)
        if (!imagesList) {
            const lists = this.getDirectChildrenByTagName(dict, 'list');
            for (const list of lists) {
                const firstInst = this.getDirectChildByTagName(list, 'instance');
                if (firstInst) {
                    const className = firstInst.getAttribute('class') || '';
                    if (className.includes('GalleryImage')) {
                        imagesList = list;
                        break;
                    }
                }
            }
        }

        // Fallback: try direct list keys
        if (!imagesList) {
            imagesList =
                this.findDictList(dict, '_images') ||
                this.findDictList(dict, 'images') ||
                this.findDictList(dict, '_userResources');
        }

        if (!imagesList) return images;

        // STEP 2: Extract each GalleryImage
        const imageInstances = this.getDirectChildrenByTagName(imagesList, 'instance');
        for (const imageInst of imageInstances) {
            const iDict = this.getDirectChildByTagName(imageInst, 'dictionary');
            if (!iDict) continue;

            // Extract image resource path
            const imageResource =
                this.extractResourcePath(iDict, '_imageResource') || this.extractResourcePath(iDict, 'imageResource');

            // Extract caption from TextField instance
            // Legacy format stores caption as TextField instance, not direct string
            let caption = '';
            const captionInstance = this.findDictInstance(iDict, '_caption') || this.findDictInstance(iDict, 'caption');
            if (captionInstance) {
                caption = this.extractTextAreaFieldContent(captionInstance);
            }
            // Fallback: try direct string value (some legacy formats)
            if (!caption) {
                caption =
                    this.findDictStringValue(iDict, 'caption') || this.findDictStringValue(iDict, '_caption') || '';
            }

            // Extract alt text
            let alt = '';
            const altInstance = this.findDictInstance(iDict, '_alt') || this.findDictInstance(iDict, 'alt');
            if (altInstance) {
                alt = this.extractTextAreaFieldContent(altInstance);
            }
            if (!alt) {
                alt = this.findDictStringValue(iDict, 'alt') || this.findDictStringValue(iDict, '_alt') || caption;
            }

            // Extract thumbnail (optional)
            const thumbnail =
                this.extractResourcePath(iDict, '_thumbnailResource') ||
                this.extractResourcePath(iDict, 'thumbnailResource');

            if (imageResource) {
                const image: GalleryImage = {
                    src: imageResource,
                    alt: alt,
                    caption: caption,
                };

                if (thumbnail) {
                    image.thumbnail = thumbnail;
                }

                images.push(image);
            }
        }

        return images;
    }
}
