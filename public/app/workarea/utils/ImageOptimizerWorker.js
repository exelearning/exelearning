/**
 * ImageOptimizerWorker
 *
 * Web Worker for image optimization using pixo WASM library.
 * Offloads image processing from the main thread to keep the UI responsive.
 *
 * Supported operations:
 * - estimate: Quick compression to estimate output size
 * - optimize: Full optimization returning the compressed blob
 *
 * Uses pixo library for PNG/JPEG compression:
 * @see https://github.com/leerob/pixo
 * @license MIT - Copyright (c) Lee Robinson
 */

// Preset configurations
// pixo preset values: 0=fast, 1=balanced, 2=max
const PRESETS = {
    light: { pixoPreset: 0, jpegQuality: 90, lossy: false },
    medium: { pixoPreset: 1, jpegQuality: 85, lossy: false },
    strong: { pixoPreset: 2, jpegQuality: 75, lossy: true },
};

/**
 * Convert RGBA pixel data to RGB by removing alpha channel
 * @param {Uint8Array} rgba - RGBA pixel data
 * @returns {Uint8Array} - RGB pixel data
 */
function rgbaToRgb(rgba) {
    const pixelCount = rgba.length / 4;
    const rgb = new Uint8Array(pixelCount * 3);

    for (let i = 0; i < pixelCount; i++) {
        rgb[i * 3] = rgba[i * 4];
        rgb[i * 3 + 1] = rgba[i * 4 + 1];
        rgb[i * 3 + 2] = rgba[i * 4 + 2];
    }

    return rgb;
}

/**
 * Normalize quality value to 1-100 range
 * @param {number} quality - Quality value (0-1 or 1-100)
 * @returns {number} - Quality in 1-100 range
 */
function normalizeQuality(quality) {
    const scaled = quality > 0 && quality <= 1 ? Math.round(quality * 100) : quality;
    return Math.max(1, Math.min(100, Math.round(scaled)));
}

/**
 * Calculate savings information
 * @param {number} originalSize - Original file size in bytes
 * @param {number} compressedSize - Compressed file size in bytes
 * @returns {{savings: number, savingsPercent: string}}
 */
function calculateSavings(originalSize, compressedSize) {
    const savings = originalSize - compressedSize;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
    return { savings, savingsPercent };
}

/**
 * Build a result object with common fields
 * @param {Object} decoded - Decoded image info
 * @param {Object} compressed - Compression result
 * @param {number} originalSize - Original file size
 * @returns {Object}
 */
function buildResultBase(decoded, compressed, originalSize) {
    const { savings, savingsPercent } = calculateSavings(originalSize, compressed.data.length);
    return {
        success: true,
        hasAlpha: decoded.hasAlpha,
        outputFormat: compressed.format,
        originalSize,
        savings,
        savingsPercent,
    };
}

/**
 * Get preset configuration by name
 * @param {string} presetName - Preset name (light, medium, strong)
 * @returns {Object} - Preset configuration
 */
function getPreset(presetName) {
    return PRESETS[presetName] || PRESETS.medium;
}

/**
 * Check if pixel data has meaningful alpha (any pixel with alpha < 255)
 * @param {Uint8ClampedArray|Uint8Array} pixels - RGBA pixel data
 * @returns {boolean} - True if image has alpha transparency
 */
function detectAlpha(pixels) {
    for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < 255) {
            return true;
        }
    }
    return false;
}

// Export for testing
/* istanbul ignore else */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PRESETS,
        rgbaToRgb,
        normalizeQuality,
        calculateSavings,
        buildResultBase,
        getPreset,
        detectAlpha,
    };
}

// Web Worker runtime code (only runs in Worker context)
/* istanbul ignore next */
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof self.onmessage !== 'undefined') {
    // Pixo WASM module
    let pixo = null;
    let pixoReady = false;

    /**
     * Initialize pixo WASM module
     */
    async function initPixo() {
        if (pixoReady) return;

        try {
            // Dynamic import of pixo - path relative to worker location
            const basePath = self.location.href.replace(/\/[^/]*$/, '');
            const pixoUrl = `${basePath}/../../../libs/pixo/pixo.js`;

            const module = await import(pixoUrl);

            // Initialize WASM
            const wasmUrl = `${basePath}/../../../libs/pixo/pixo_bg.wasm`;
            await module.default(wasmUrl);

            pixo = module;
            pixoReady = true;
            // eslint-disable-next-line no-console
            console.log('[ImageOptimizerWorker] Pixo WASM initialized');
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[ImageOptimizerWorker] Failed to initialize pixo:', error);
            throw error;
        }
    }

    /**
     * Decode image blob to raw pixel data using OffscreenCanvas
     * @param {Blob} blob - Image blob
     * @returns {Promise<{data: Uint8Array, width: number, height: number, hasAlpha: boolean}>}
     */
    async function decodeImage(blob) {
        const bitmap = await createImageBitmap(blob);
        const { width, height } = bitmap;

        // Create OffscreenCanvas to extract pixel data
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data; // RGBA Uint8ClampedArray

        return {
            data: new Uint8Array(pixels.buffer),
            width,
            height,
            hasAlpha: detectAlpha(pixels),
        };
    }

    /**
     * Compress image using pixo WASM
     * @param {Uint8Array} data - Raw RGBA pixel data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {boolean} hasAlpha - Whether image has alpha channel
     * @param {Object} settings - Compression settings
     * @returns {{data: Uint8Array, format: string}}
     */
    function compressImage(data, width, height, hasAlpha, settings) {
        const presetConfig = getPreset(settings.preset);
        const pixoPreset = presetConfig.pixoPreset;

        if (hasAlpha) {
            // PNG for images with alpha - color_type 3 = RGBA
            const compressed = pixo.encodePng(data, width, height, 3, pixoPreset, presetConfig.lossy);
            return { data: compressed, format: 'image/png' };
        }

        // JPEG for images without alpha - need RGB data (no alpha channel)
        const rgbData = rgbaToRgb(data);
        const quality = normalizeQuality(settings.jpegQuality ?? presetConfig.jpegQuality);
        // color_type 2 = RGB, subsampling_420 = true for smaller files
        const compressed = pixo.encodeJpeg(rgbData, width, height, 2, quality, pixoPreset, true);
        return { data: compressed, format: 'image/jpeg' };
    }

    /**
     * Estimate compression result
     * @param {Blob} blob - Original image blob
     * @param {Object} settings - Compression settings
     * @returns {Promise<Object>}
     */
    async function estimateCompression(blob, settings) {
        const decoded = await decodeImage(blob);
        const compressed = compressImage(decoded.data, decoded.width, decoded.height, decoded.hasAlpha, settings);

        return {
            ...buildResultBase(decoded, compressed, blob.size),
            estimatedSize: compressed.data.length,
        };
    }

    /**
     * Optimize image and return the compressed blob
     * @param {Blob} blob - Original image blob
     * @param {Object} settings - Compression settings
     * @returns {Promise<Object>}
     */
    async function optimizeImage(blob, settings) {
        const decoded = await decodeImage(blob);
        const compressed = compressImage(decoded.data, decoded.width, decoded.height, decoded.hasAlpha, settings);

        return {
            ...buildResultBase(decoded, compressed, blob.size),
            optimizedBlob: new Blob([compressed.data], { type: compressed.format }),
            optimizedSize: compressed.data.length,
        };
    }

    /**
     * Handle incoming messages from the main thread
     */
    self.onmessage = async event => {
        const { type, assetId, blob, settings } = event.data;

        try {
            // Initialize pixo on first use
            if (!pixoReady) {
                await initPixo();
            }

            switch (type) {
                case 'estimate': {
                    const result = await estimateCompression(blob, settings);
                    self.postMessage({
                        type: 'estimated',
                        assetId,
                        ...result,
                    });
                    break;
                }

                case 'optimize': {
                    const result = await optimizeImage(blob, settings);
                    self.postMessage({
                        type: 'optimized',
                        assetId,
                        ...result,
                    });
                    break;
                }

                default:
                    self.postMessage({
                        type: 'error',
                        assetId,
                        error: `Unknown message type: ${type}`,
                    });
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[ImageOptimizerWorker] Error:', error);
            self.postMessage({
                type: 'error',
                assetId,
                error: error.message,
            });
        }
    };

    // Signal that worker is ready
    self.postMessage({ type: 'ready' });
}
