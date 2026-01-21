/**
 * Unit tests for Discover iDevice Edition
 * Tests the core functions used in the discover edition interface
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock global objects
global.$ = vi.fn(() => ({
    val: vi.fn(),
    text: vi.fn(),
    css: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    width: vi.fn(() => 100),
    height: vi.fn(() => 100),
    parent: vi.fn(() => ({
        width: vi.fn(() => 100),
        height: vi.fn(() => 100)
    })),
    offset: vi.fn(() => ({ left: 0, top: 0 })),
    position: vi.fn(() => ({ left: 0, top: 0 }))
}));

global.c_ = vi.fn((str) => str);
global._ = vi.fn((str) => str);

// Mock the discover device object with only the functions we want to test
const $exeDevice = {
    NUMMAXCARD: 4,
    
    /**
     * Convert hex color to rgba with 0.7 opacity
     */
    hexToRgba: function (hex) {
        hex = hex.replace(/^#/, '');
        if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(hex))
            throw new Error('Color hexadecimal inválido');
        if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
        const [r, g, b] = [
            hex.slice(0, 2),
            hex.slice(2, 4),
            hex.slice(4, 6),
        ].map((v) => parseInt(v, 16));
        return `rgba(${r}, ${g}, ${b}, 0.7)`;
    },

    /**
     * Get default question structure
     */
    getQuestionDefault: function() {
        const data = [];
        for (let i = 0; i < this.NUMMAXCARD; i++) {
            data.push({
                type: 0,
                url: '',
                audio: '',
                x: 0,
                y: 0,
                author: '',
                alt: '',
                eText: '',
                color: '#000000',
                backcolor: '#ffffff',
            });
        }
        return {
            data,
            msgError: '',
            msgHit: '',
        };
    },

    /**
     * Remove HTML tags from string
     */
    removeTags: function (str) {
        const wrapper = { 
            html: function(content) { this.content = content; },
            text: function() { 
                if (!this.content) return '';
                return this.content.replace(/<[^>]*>/g, '');
            }
        };
        wrapper.html(str);
        return wrapper.text();
    },

    /**
     * Escape quotes in text
     */
    escapeQuotes: function(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Calculate image placement within container
     */
    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        // Mock image parent dimensions
        const wDiv = 100;
        const hDiv = 100;
        
        const varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;
        
        if (varW > varH) {
            wImage = parseInt(wDiv);
            hImage = parseInt(naturalHeight / varW);
            yImagen = parseInt((hDiv - hImage) / 2);
        } else {
            wImage = parseInt(naturalWidth / varH);
            hImage = parseInt(hDiv);
            xImagen = parseInt((wDiv - wImage) / 2);
        }

        return {
            w: wImage,
            h: hImage,
            x: xImagen,
            y: yImagen,
        };
    },

    /**
     * Create links for images in game data
     */
    createlinksImage: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            const q = wordsGame[i];
            for (let k = 0; k < this.NUMMAXCARD; k++) {
                const p = q.data[k];
                let linkImage = '';
                if (
                    typeof p.url != 'undefined' &&
                    p.url.length > 0 &&
                    p.url.indexOf('http') != 0
                ) {
                    linkImage =
                        '<a href="' +
                        p.url +
                        '" class="js-hidden descubre-LinkImages-' +
                        k +
                        '">' +
                        i +
                        '</a>';
                }
                html += linkImage;
            }
        }
        return html;
    },

    /**
     * Create links for audio in game data
     */
    createlinksAudio: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            const q = wordsGame[i];
            for (let k = 0; k < this.NUMMAXCARD; k++) {
                const p = q.data[k];
                let linkImage = '';
                if (
                    p.audio &&
                    typeof p.audio === 'string' &&
                    p.audio.indexOf('http') != 0 &&
                    p.audio.length > 4
                ) {
                    linkImage =
                        '<a href="' +
                        p.audio +
                        '" class="js-hidden descubre-LinkAudios-' +
                        k +
                        '">' +
                        i +
                        '</a>';
                }
                html += linkImage;
            }
        }
        return html;
    }
};

describe('Discover Edition Functions', () => {
    describe('hexToRgba', () => {
        it('should convert 6-digit hex to rgba', () => {
            expect($exeDevice.hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 0.7)');
            expect($exeDevice.hexToRgba('#00ff00')).toBe('rgba(0, 255, 0, 0.7)');
            expect($exeDevice.hexToRgba('#0000ff')).toBe('rgba(0, 0, 255, 0.7)');
        });

        it('should convert 3-digit hex to rgba', () => {
            expect($exeDevice.hexToRgba('#f00')).toBe('rgba(255, 0, 0, 0.7)');
            expect($exeDevice.hexToRgba('#0f0')).toBe('rgba(0, 255, 0, 0.7)');
            expect($exeDevice.hexToRgba('#00f')).toBe('rgba(0, 0, 255, 0.7)');
        });

        it('should handle hex without # prefix', () => {
            expect($exeDevice.hexToRgba('ff0000')).toBe('rgba(255, 0, 0, 0.7)');
            expect($exeDevice.hexToRgba('fff')).toBe('rgba(255, 255, 255, 0.7)');
        });

        it('should throw error for invalid hex', () => {
            expect(() => $exeDevice.hexToRgba('invalid')).toThrow('Color hexadecimal inválido');
            expect(() => $exeDevice.hexToRgba('#gg0000')).toThrow('Color hexadecimal inválido');
            expect(() => $exeDevice.hexToRgba('#ff')).toThrow('Color hexadecimal inválido');
        });

        it('should handle black and white', () => {
            expect($exeDevice.hexToRgba('#000000')).toBe('rgba(0, 0, 0, 0.7)');
            expect($exeDevice.hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 0.7)');
            expect($exeDevice.hexToRgba('#000')).toBe('rgba(0, 0, 0, 0.7)');
            expect($exeDevice.hexToRgba('#fff')).toBe('rgba(255, 255, 255, 0.7)');
        });
    });

    describe('getQuestionDefault', () => {
        it('should create default question with 4 cards', () => {
            const question = $exeDevice.getQuestionDefault();
            
            expect(question).toHaveProperty('data');
            expect(question).toHaveProperty('msgError');
            expect(question).toHaveProperty('msgHit');
            expect(question.data).toHaveLength(4);
            expect(question.msgError).toBe('');
            expect(question.msgHit).toBe('');
        });

        it('should have correct default card structure', () => {
            const question = $exeDevice.getQuestionDefault();
            const card = question.data[0];
            
            expect(card).toEqual({
                type: 0,
                url: '',
                audio: '',
                x: 0,
                y: 0,
                author: '',
                alt: '',
                eText: '',
                color: '#000000',
                backcolor: '#ffffff',
            });
        });

        it('should create independent card objects', () => {
            const question = $exeDevice.getQuestionDefault();
            question.data[0].url = 'test.jpg';
            
            expect(question.data[1].url).toBe('');
            expect(question.data[2].url).toBe('');
            expect(question.data[3].url).toBe('');
        });
    });

    describe('removeTags', () => {
        it('should remove simple HTML tags', () => {
            expect($exeDevice.removeTags('<p>Hello</p>')).toBe('Hello');
            expect($exeDevice.removeTags('<div>World</div>')).toBe('World');
            expect($exeDevice.removeTags('<span>Test</span>')).toBe('Test');
        });

        it('should remove nested HTML tags', () => {
            expect($exeDevice.removeTags('<div><p>Hello <strong>World</strong></p></div>')).toBe('Hello World');
            expect($exeDevice.removeTags('<ul><li>Item 1</li><li>Item 2</li></ul>')).toBe('Item 1Item 2');
        });

        it('should handle empty string', () => {
            expect($exeDevice.removeTags('')).toBe('');
        });

        it('should handle text without tags', () => {
            expect($exeDevice.removeTags('Plain text')).toBe('Plain text');
        });

        it('should handle attributes in tags', () => {
            expect($exeDevice.removeTags('<div class="test" id="myDiv">Content</div>')).toBe('Content');
            expect($exeDevice.removeTags('<a href="http://example.com" target="_blank">Link</a>')).toBe('Link');
        });
    });

    describe('escapeQuotes', () => {
        it('should escape quotes and ampersands', () => {
            expect($exeDevice.escapeQuotes('Hello "World"')).toBe('Hello &quot;World&quot;');
            expect($exeDevice.escapeQuotes("Hello 'World'")).toBe('Hello &#39;World&#39;');
            expect($exeDevice.escapeQuotes('Hello & World')).toBe('Hello &amp; World');
        });

        it('should handle mixed quotes and ampersands', () => {
            expect($exeDevice.escapeQuotes('A "test" & \'example\'')).toBe('A &quot;test&quot; &amp; &#39;example&#39;');
        });

        it('should handle empty string', () => {
            expect($exeDevice.escapeQuotes('')).toBe('');
        });

        it('should handle strings without special characters', () => {
            expect($exeDevice.escapeQuotes('Plain text')).toBe('Plain text');
        });
    });

    describe('placeImageWindows', () => {
        it('should scale wide image to fit container', () => {
            const result = $exeDevice.placeImageWindows(null, 200, 100);
            
            expect(result.w).toBe(100);
            expect(result.h).toBe(50);
            expect(result.x).toBe(0);
            expect(result.y).toBe(25);
        });

        it('should scale tall image to fit container', () => {
            const result = $exeDevice.placeImageWindows(null, 100, 200);
            
            expect(result.w).toBe(50);
            expect(result.h).toBe(100);
            expect(result.x).toBe(25);
            expect(result.y).toBe(0);
        });

        it('should handle square image', () => {
            const result = $exeDevice.placeImageWindows(null, 100, 100);
            
            expect(result.w).toBe(100);
            expect(result.h).toBe(100);
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        it('should handle very wide image', () => {
            const result = $exeDevice.placeImageWindows(null, 400, 100);
            
            expect(result.w).toBe(100);
            expect(result.h).toBe(25);
            expect(result.x).toBe(0);
            expect(result.y).toBe(37); // (100 - 25) / 2 = 37.5 -> 37
        });

        it('should handle very tall image', () => {
            const result = $exeDevice.placeImageWindows(null, 100, 400);
            
            expect(result.w).toBe(25);
            expect(result.h).toBe(100);
            expect(result.x).toBe(37); // (100 - 25) / 2 = 37.5 -> 37
            expect(result.y).toBe(0);
        });
    });

    describe('createlinksImage', () => {
        it('should create image links for local files only', () => {
            const wordsGame = [{
                data: [
                    { url: 'image1.jpg' },
                    { url: 'http://example.com/image2.jpg' },
                    { url: 'image3.png' },
                    { url: '' }
                ]
            }];
            
            const result = $exeDevice.createlinksImage(wordsGame);
            
            expect(result).toContain('href="image1.jpg"');
            expect(result).toContain('href="image3.png"');
            expect(result).not.toContain('href="http://example.com/image2.jpg"');
            expect(result).toContain('descubre-LinkImages-0');
            expect(result).toContain('descubre-LinkImages-2');
        });

        it('should handle multiple questions', () => {
            const wordsGame = [
                { data: [{ url: 'q1_image1.jpg' }, { url: '' }, { url: '' }, { url: '' }] },
                { data: [{ url: 'q2_image1.jpg' }, { url: 'q2_image2.jpg' }, { url: '' }, { url: '' }] }
            ];
            
            const result = $exeDevice.createlinksImage(wordsGame);
            
            expect(result).toContain('href="q1_image1.jpg"');
            expect(result).toContain('href="q2_image1.jpg"');
            expect(result).toContain('href="q2_image2.jpg"');
            expect(result).toContain('>0</a>'); // Question index 0
            expect(result).toContain('>1</a>'); // Question index 1
        });

        it('should return empty string for no images', () => {
            const wordsGame = [{
                data: [
                    { url: '' },
                    { url: 'http://example.com/image.jpg' },
                    { url: '' },
                    { url: '' }
                ]
            }];
            
            const result = $exeDevice.createlinksImage(wordsGame);
            expect(result).toBe('');
        });
    });

    describe('createlinksAudio', () => {
        it('should create audio links for local files only', () => {
            const wordsGame = [{
                data: [
                    { audio: 'audio1.mp3' },
                    { audio: 'http://example.com/audio2.mp3' },
                    { audio: 'audio3.wav' },
                    { audio: 'mp3' } // Too short (length <= 4)
                ]
            }];
            
            const result = $exeDevice.createlinksAudio(wordsGame);
            
            expect(result).toContain('href="audio1.mp3"');
            expect(result).toContain('href="audio3.wav"');
            expect(result).not.toContain('href="http://example.com/audio2.mp3"');
            expect(result).not.toContain('href="mp3"');
            expect(result).toContain('descubre-LinkAudios-0');
            expect(result).toContain('descubre-LinkAudios-2');
        });

        it('should handle multiple questions with audio', () => {
            const wordsGame = [
                { data: [{ audio: 'q1_audio1.mp3' }, { audio: '' }, { audio: '' }, { audio: '' }] },
                { data: [{ audio: 'q2_audio1.wav' }, { audio: 'q2_audio2.ogg' }, { audio: '' }, { audio: '' }] }
            ];
            
            const result = $exeDevice.createlinksAudio(wordsGame);
            
            expect(result).toContain('href="q1_audio1.mp3"');
            expect(result).toContain('href="q2_audio1.wav"');
            expect(result).toContain('href="q2_audio2.ogg"');
            expect(result).toContain('>0</a>'); // Question index 0
            expect(result).toContain('>1</a>'); // Question index 1
        });

        it('should return empty string for no valid audio', () => {
            const wordsGame = [{
                data: [
                    { audio: '' },
                    { audio: 'http://example.com/audio.mp3' },
                    { audio: 'mp3' },
                    { audio: 'wav' }
                ]
            }];
            
            const result = $exeDevice.createlinksAudio(wordsGame);
            expect(result).toBe('');
        });

        it('should handle undefined audio properties', () => {
            const wordsGame = [{
                data: [
                    {},
                    { audio: undefined },
                    { audio: null },
                    { audio: 'valid_audio.mp3' }
                ]
            }];
            
            const result = $exeDevice.createlinksAudio(wordsGame);
            expect(result).toContain('href="valid_audio.mp3"');
            expect(result).toContain('descubre-LinkAudios-3');
        });
    });
});