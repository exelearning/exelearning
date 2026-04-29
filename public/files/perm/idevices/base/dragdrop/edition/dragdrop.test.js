/**
 * Unit tests for Drag and drop iDevice export helpers.
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('dragdrop iDevice export helpers', () => {
    let $exeDevice;
    let downloadBlob;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'dragdrop.js'));
        downloadBlob = vi.fn(() => true);
        global.$exeDevicesEdition.iDevice.gamification.share = { downloadBlob };
    });

    it('exports question text with the dragdrop filename and container', () => {
        vi.spyOn($exeDevice, 'validateData').mockReturnValue({
            wordsGame: [{ word: 'Source', definition: 'Target' }],
        });

        expect($exeDevice.exportQuestions()).toBe(true);
        expect(downloadBlob).toHaveBeenCalledTimes(1);
        expect(downloadBlob.mock.calls[0][1]).toBe('words-dragdrop.txt');
        expect(downloadBlob.mock.calls[0][2]).toBe('dragdropQIdeviceForm');
    });

    it('exports game JSON with the dragdrop filename and container', () => {
        const dataGame = { wordsGame: [{ word: 'Source', definition: 'Target' }] };
        vi.spyOn($exeDevice, 'validateData').mockReturnValue(dataGame);

        expect($exeDevice.exportGame()).toBe(true);
        expect(downloadBlob).toHaveBeenCalledTimes(1);
        expect(downloadBlob.mock.calls[0][1]).toBe('Activity-DragDrop.json');
        expect(downloadBlob.mock.calls[0][2]).toBe('dragdropQIdeviceForm');
    });
});
