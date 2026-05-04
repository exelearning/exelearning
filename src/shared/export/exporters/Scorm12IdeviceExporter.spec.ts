import { describe, expect, it } from 'bun:test';
import type { AssetProvider, ExportDocument, ResourceProvider } from '../interfaces';
import { FflateZipProvider } from '../providers/FflateZipProvider';
import { Scorm12IdeviceExporter } from './Scorm12IdeviceExporter';

function makeExporter(): Scorm12IdeviceExporter {
    return new Scorm12IdeviceExporter(
        null as unknown as ExportDocument,
        null as unknown as ResourceProvider,
        null as unknown as AssetProvider,
        new FflateZipProvider(),
    );
}

describe('Scorm12IdeviceExporter', () => {
    it('uses the iDevice SCORM filename suffix', () => {
        expect(makeExporter().getFileSuffix()).toBe('_idevice_scorm12');
    });

    it('requires a block id', async () => {
        const result = await makeExporter().export();

        expect(result.success).toBe(false);
        expect(result.error).toBe('blockId is required');
    });

    it('requires an iDevice id', async () => {
        const result = await makeExporter().export({ blockId: 'block-1' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('ideviceId is required');
    });
});
