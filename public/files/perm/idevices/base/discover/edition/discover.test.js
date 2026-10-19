/**
 * Unit tests for Discover iDevice Edition
 * Tests the core functions used in the discover edition interface
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

    describe('loadPreviousValues regression', () => {
        it('should call showQuestion(0) when previous data is empty', () => {
            const realExeDevice = global.loadIdevice(join(__dirname, 'discover.js'));
            const showQuestionSpy = vi.fn();

            realExeDevice.showQuestion = showQuestionSpy;
            realExeDevice.idevicePreviousData = '';

            realExeDevice.loadPreviousValues();

            expect(showQuestionSpy).toHaveBeenCalledTimes(1);
            expect(showQuestionSpy).toHaveBeenCalledWith(0);
        });
    });

    describe('real exportQuestions regression', () => {
        it('downloads question text with the discover filename and container', () => {
            const realExeDevice = global.loadIdevice(join(__dirname, 'discover.js'));
            const downloadBlob = vi.fn(() => true);
            const prevShare = global.$exeIDevicesEdition?.iDevice?.gamification?.share;
            const prevLegacyShare = global.$exeDevicesEdition?.iDevice?.gamification?.share;

            try {
                if (global.$exeIDevicesEdition?.iDevice?.gamification) {
                    global.$exeIDevicesEdition.iDevice.gamification.share = { ...prevShare, downloadBlob };
                }
                if (global.$exeDevicesEdition?.iDevice?.gamification) {
                    global.$exeDevicesEdition.iDevice.gamification.share = { ...prevLegacyShare, downloadBlob };
                }
                vi.spyOn(realExeDevice, 'validateData').mockReturnValue({
                    wordsGame: [{ word: 'Card', definition: 'Pair' }],
                });

                expect(realExeDevice.exportQuestions()).toBe(true);
                expect(downloadBlob).toHaveBeenCalledTimes(1);
                expect(downloadBlob.mock.calls[0][1]).toBe('words-descubre.txt');
                expect(downloadBlob.mock.calls[0][2]).toBe('descubreQEIdeviceForm');
            } finally {
                if (global.$exeIDevicesEdition?.iDevice?.gamification && prevShare) {
                    global.$exeIDevicesEdition.iDevice.gamification.share = prevShare;
                }
                if (global.$exeDevicesEdition?.iDevice?.gamification && prevLegacyShare) {
                    global.$exeDevicesEdition.iDevice.gamification.share = prevLegacyShare;
                }
            }
        });
    });

  /**
   * The pass-score control is a shared block in common_edition.js, exercised by
   * its own tests. What is specific to this iDevice -- and what silently breaks
   * if someone edits the form -- is the wiring: all four call sites have to be
   * present, and the two saved fields have to reach the stored data. Reading
   * the source is how that is checked without standing up the whole edition
   * form.
   */
  describe('pass score wiring', () => {
      let source;

      beforeEach(() => {
          source = readFileSync(join(__dirname, 'discover.js'), 'utf-8');
      });

      it('delegates the evaluation controls to the shared tab', () => {
          // The pass score and the progress report used to be rendered here,
          // loose in the general options. They now live in the Grading tab,
          // so rendering them again would show each control twice.
          expect(source).not.toContain('passScore.getContents(');
          expect(source).not.toContain('progressBar.getContents(');
          expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading:\s*true/);
      });

      it('restores the control when the iDevice is reopened', () => {
          expect(source).toContain('gamification.passScore.setValues(');
          expect(source).toContain('passScoreMode: game.passScoreMode');
          expect(source).toContain('passScoreCustom: game.passScoreCustom');
      });

      it('saves the mode and the customised mark, and nothing else', () => {
          expect(source).toContain('gamification.passScore.getValues()');
          expect(source).toContain('passScoreMode: passScore.passScoreMode');
          expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
          // The project value is never copied into the iDevice: it is read
          // live, so an iDevice on the global mode follows the project.
          expect(source).not.toContain('passScoreGlobal');
      });

      it('wires the radio and input handlers', () => {
          expect(source).toContain('gamification.passScore.addEvents()');
      });
  });

    describe('edition lifecycle', () => {
        // This file stubs the global `$` for the pure-function tests, but the
        // lifecycle tests drive real DOM events, so real jQuery is restored
        // while they run.
        const jq = window.jQuery;
        let device;
        let savedGlobals;

        beforeEach(() => {
            savedGlobals = {
                $: global.$,
                jQuery: global.jQuery,
                gamification: global.$exeDevicesEdition.iDevice.gamification,
                iGamification: global.$exeIDevicesEdition?.iDevice?.gamification,
                media: global.$exeDevices.iDevice.gamification.media,
            };
            global.$ = jq;
            global.jQuery = jq;
            const gamificationMock = {
                ...savedGlobals.gamification,
                progressBar: { addEvents: vi.fn() },
                itinerary: { addEvents: vi.fn() },
                feedback: { addEvents: vi.fn(), setValues: vi.fn() },
                share: { addEvents: vi.fn(), downloadBlob: vi.fn(() => true) },
                helpers: { stopSound: vi.fn(), playSound: vi.fn() },
            };
            global.$exeDevicesEdition.iDevice.gamification = gamificationMock;
            if (global.$exeIDevicesEdition?.iDevice) {
                global.$exeIDevicesEdition.iDevice.gamification = {
                    ...savedGlobals.iGamification,
                    ...gamificationMock,
                };
            }
            global.$exeDevices.iDevice.gamification.media = {
                extractURLGD: url => url,
            };

            document.body.innerHTML = `
                <div id="descubreQEIdeviceForm">
                    <span class="toggle-item">
                        <input id="tgl" class="toggle-input" type="checkbox" data-target="#tgt">
                    </span>
                    <div id="tgt"></div>
                    <input id="eXeGameImportGame" type="file">
                </div>
            `;

            device = global.loadIdevice(join(__dirname, 'discover.js'));
            device.addEvents();
        });

        afterEach(() => {
            // Close the edition the test opened, so its document handlers
            // cannot leak into the next one.
            device.$lifecycle.destroy();
            document.body.innerHTML = '';
            global.$ = savedGlobals.$;
            global.jQuery = savedGlobals.jQuery;
            global.$exeDevicesEdition.iDevice.gamification = savedGlobals.gamification;
            if (global.$exeIDevicesEdition?.iDevice && savedGlobals.iGamification) {
                global.$exeIDevicesEdition.iDevice.gamification = savedGlobals.iGamification;
            }
            global.$exeDevices.iDevice.gamification.media = savedGlobals.media;
        });

        describe('delegated .toggle-input handler on document', () => {
            it('reacts to a change while the edition is open', () => {
                jq('#tgl').prop('checked', true).trigger('change');

                expect(jq('#tgt').css('display')).toBe('flex');
            });

            it('stops reacting once the edition is closed', () => {
                jq('#tgl').prop('checked', true).trigger('change');
                expect(jq('#tgt').css('display')).toBe('flex');

                device.$lifecycle.destroy();
                jq('#tgl').prop('checked', false).trigger('change');

                expect(jq('#tgt').css('display')).toBe('flex');
            });

            it('leaves unrelated document handlers registered', () => {
                const unrelated = vi.fn();
                jq(document).on('change.discoverUnrelated', '.toggle-input', unrelated);

                device.$lifecycle.destroy();
                jq('#tgl').trigger('change');

                expect(unrelated).toHaveBeenCalledTimes(1);
                jq(document).off('change.discoverUnrelated');
            });
        });

        describe('import FileReader', () => {
            /**
             * Drive the file input the way a user picking a file does, and hand
             * back the FileReader the edition created for it.
             *
             * @returns {FileReader}
             */
            function pickFile() {
                const readers = [];
                const RealFileReader = global.FileReader;
                class TrackedFileReader extends RealFileReader {
                    constructor() {
                        super();
                        readers.push(this);
                    }
                }
                global.FileReader = TrackedFileReader;
                try {
                    const input = document.getElementById('eXeGameImportGame');
                    Object.defineProperty(input, 'files', {
                        configurable: true,
                        value: [new File(['card'], 'game.txt', { type: 'text/plain' })],
                    });
                    jq(input).trigger('change');
                } finally {
                    global.FileReader = RealFileReader;
                }
                return readers[0];
            }

            it('aborts a read that is still in flight when the edition closes', () => {
                const reader = pickFile();
                expect(reader).toBeDefined();
                const abort = vi.spyOn(reader, 'abort');

                expect(reader.readyState).toBe(1);
                device.$lifecycle.destroy();

                expect(abort).toHaveBeenCalledTimes(1);
                abort.mockRestore();
            });

            it('discards a load that resolves after the edition closed', () => {
                const reader = pickFile();
                const importGame = vi.fn();
                device.importGame = importGame;

                device.$lifecycle.destroy();
                reader.onload({ target: { result: 'card' } });

                expect(importGame).not.toHaveBeenCalled();
            });

            it('imports a load that resolves while the edition is open', () => {
                const reader = pickFile();
                const importGame = vi.fn();
                device.importGame = importGame;

                reader.onload({ target: { result: 'card' } });

                expect(importGame).toHaveBeenCalledWith('card', 'text/plain');
            });
        });

        describe('preview audio', () => {
            it('stops playback and releases the stream when the edition closes', () => {
                device.playSound('files/beep.mp3');
                const player = device.playerAudio;
                const pause = vi.spyOn(player, 'pause');

                device.$lifecycle.destroy();

                expect(pause).toHaveBeenCalledTimes(1);
                expect(player.hasAttribute('src')).toBe(false);
                pause.mockRestore();
            });

            it('plays on canplaythrough while open, and stays silent afterwards', () => {
                device.playSound('files/beep.mp3');
                const player = device.playerAudio;
                const play = vi.spyOn(player, 'play').mockReturnValue(undefined);

                player.dispatchEvent(new Event('canplaythrough'));
                expect(play).toHaveBeenCalledTimes(1);

                device.$lifecycle.destroy();
                player.dispatchEvent(new Event('canplaythrough'));

                expect(play).toHaveBeenCalledTimes(1);
                play.mockRestore();
            });
        });
    });
});

describe('discover minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'discover.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('discover edition: shared form tabs, options tooltips, and feedback', () => {
    const PATH = 'files/perm/idevices/base/discover/edition/';
    const jq = window.jQuery;
    let savedGlobals;
    let device;
    let previousApp;
    let tooltips;

    function panel(tab) {
        return document.getElementById(`descubreQEIdeviceForm-panel-${tab}`);
    }

    function tabNames() {
        return [...document.querySelectorAll('#descubreQEIdeviceForm-tabs [data-exe-tab]')].map(
            (tab) => tab.getAttribute('data-exe-tab')
        );
    }

    beforeEach(() => {
        savedGlobals = {
            $: global.$,
            jQuery: global.jQuery,
            exeDevices: global.$exeDevices,
        };
        global.$ = jq;
        global.jQuery = jq;
        global.$exeDevices = {
            ...global.$exeDevices,
            iDevice: {
                ...global.$exeDevices?.iDevice,
                gamification: {
                    ...global.$exeDevices?.iDevice?.gamification,
                    helpers: {
                        ...global.$exeDevices?.iDevice?.gamification?.helpers,
                        encrypt: (t) => t,
                        decrypt: (t) => t,
                        isJsonString: (t) => {
                            try {
                                return JSON.parse(t);
                            } catch {
                                return false;
                            }
                        },
                    },
                    media: {
                        extractURLGD: (url) => url,
                    },
                },
            },
        };
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning?.app;
        tooltips = new Map();
        global.eXeLearning = {
            ...global.eXeLearning,
            app: {
                ...previousApp,
                common: {
                    initTooltips: vi.fn((scope) => {
                        scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                            tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                        });
                    }),
                },
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });

        device = global.loadIdevice(join(__dirname, 'discover.js'));
        document.body.innerHTML = '<div id="discoverBody"></div>';
        device.init(document.getElementById('discoverBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        document.body.innerHTML = '';
        global.$ = savedGlobals.$;
        global.jQuery = savedGlobals.jQuery;
        global.$exeDevices = savedGlobals.exeDevices;
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('organises the edition form into shared WAI-ARIA tabs', () => {
        expect(tabNames()).toEqual([
            'instructions',
            'options',
            'contents',
            'passwords',
            'feedback',
            'after',
            'grading',
            'texts',
        ]);

        expect(panel('instructions').querySelector('#eXeGameInstructions')).not.toBeNull();
        expect(panel('options').querySelector('#descubreEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('.Descubre-EPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('provides accessible help tooltips for option rows', () => {
        const optionHelps = [...panel('options').querySelectorAll('#descubreEOptions .exe-idevice-help')];
        expect(optionHelps.length).toBe(11);

        for (const help of optionHelps) {
            expect(help.tagName).toBe('BUTTON');
            expect(help.type).toBe('button');
            expect(help.title).toBe('Information');
            const targetId = help.getAttribute('aria-controls');
            expect(targetId).toBeTruthy();
            expect(document.getElementById(targetId)?.textContent.length).toBeGreaterThan(10);
        }
    });

    it('does not toggle switches when clicking help icons inside toggle-items', () => {
        const minimizeInput = document.getElementById('descubreEShowMinimize');
        const minimizeHelp = minimizeInput.closest('div').querySelector('.exe-idevice-help');
        expect(minimizeHelp).not.toBeNull();
        expect(minimizeInput.checked).toBe(false);
        minimizeHelp.click();
        expect(minimizeInput.checked).toBe(false);
    });

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBeGreaterThanOrEqual(11);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('switches tabs when one is clicked', () => {
        document.getElementById('descubreQEIdeviceForm-tab-options').click();

        expect(panel('options').classList.contains('active')).toBe(true);
        expect(panel('instructions').classList.contains('active')).toBe(false);
    });

    it('restores form values and updates gamification modules on updateFieldGame', () => {
        device.updateFieldGame({
            showMinimize: true,
            customMessages: true,
            showCards: true,
            percentajeQuestions: 80,
            timeShowSolution: 10,
            gameMode: 0,
            gameLevels: 1,
            time: 60,
            attempts: 5,
            itinerary: {},
            evaluation: true,
            evaluationID: 'eval-1',
            passScoreMode: 1,
            passScoreCustom: 6,
            isScorm: 1,
            textButtonScorm: 'Send',
            repeatActivity: true,
            weighted: false,
            feedBack: true,
            percentajeFB: 75,
            imgCard: '',
            wordsGame: [],
        });

        expect(document.getElementById('descubreEShowMinimize').checked).toBe(true);
        expect(document.getElementById('descubreECustomMessages').checked).toBe(true);
        expect(document.getElementById('descubreEShowCards').checked).toBe(true);
        expect(document.getElementById('descubreEPercentajeQuestions').value).toBe('80');
        expect(document.getElementById('descubreETimeShowSolution').value).toBe('10');
        expect(document.getElementById('descubreETime').value).toBe('60');
        expect(document.getElementById('descubreEAttempts').value).toBe('5');
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('75');
    });

    it('imports the cards of a text file', () => {
        device.importGame('Heart#Organ that pumps blood\r\nLung#Organ for breathing\r\n', 'text/plain');

        expect(device.wordsGame.map((card) => card.data.slice(0, 2).map((side) => side.eText))).toEqual([
            ['Heart', 'Organ that pumps blood'],
            ['Lung', 'Organ for breathing'],
        ]);
        expect(document.querySelector('input[name="qtxgamemode"][value="0"]').checked).toBe(true);
    });

    describe('saving and validation', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Discover pairs or cards</p>',
                eXeIdeviceTextAfter: '<p>Extra discover info</p>',
                eXeGameFeedBackEditor: '<p>Feedback message</p>',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                          hide: vi.fn(),
                          show: vi.fn(),
                      }
                    : null
            );
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        const game = (overrides = {}) => ({
            showMinimize: true,
            caseSensitive: true,
            customMessages: false,
            showCards: true,
            percentajeQuestions: 100,
            timeShowSolution: 5,
            gameMode: 0,
            gameLevels: 0,
            time: 0,
            attempts: 0,
            itinerary: {},
            evaluation: false,
            evaluationID: '',
            passScoreMode: 0,
            passScoreCustom: 5,
            isScorm: 0,
            textButtonScorm: '',
            repeatActivity: false,
            weighted: false,
            feedBack: true,
            percentajeFB: 80,
            imgCard: '',
            wordsGame: [
                {
                    data: [
                        { type: 0, url: 'img1.png', audio: '', x: 0, y: 0, author: '', alt: '', eText: 'One', color: '#000', backcolor: '#fff' },
                        { type: 0, url: 'img2.png', audio: '', x: 0, y: 0, author: '', alt: '', eText: 'Two', color: '#000', backcolor: '#fff' },
                        { type: 0, url: '', audio: '', x: 0, y: 0, author: '', alt: '', eText: '', color: '#000', backcolor: '#fff' },
                        { type: 0, url: '', audio: '', x: 0, y: 0, author: '', alt: '', eText: '', color: '#000', backcolor: '#fff' },
                    ],
                    msgError: '',
                    msgHit: '',
                },
            ],
            ...overrides,
        });

        it('saves form data with feedback and extra content', () => {
            device.updateFieldGame(game());
            device.showQuestion(0);
            $exeIDevicesEdition.iDevice.gamification.feedback.setText('<p>Feedback message</p>');
            const data = device.validateData();

            expect(data.showMinimize).toBe(true);
            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(80);
            expect(unescape(data.textFeedBack)).toBe('<p>Feedback message</p>');
            expect(unescape(data.textAfter)).toBe('<p>Extra discover info</p>');

            const savedHtml = device.save();
            expect(savedHtml).toContain('descubre-feedback-game');
            expect(savedHtml).toContain('descubre-extra-content');
        });

        it('keeps the access code and the clue when saving', () => {
            const itinerary = {
                showClue: true,
                clueGame: 'Next key: river',
                percentageClue: 60,
                showCodeAccess: true,
                codeAccess: '1234',
                messageCodeAccess: 'Code of the previous activity?',
            };
            device.updateFieldGame(game({ itinerary }));
            device.showQuestion(0);
            $exeIDevicesEdition.iDevice.gamification.feedback.setText('<p>Feedback message</p>');

            expect(device.validateData().itinerary).toEqual(itinerary);
        });
    });
});
