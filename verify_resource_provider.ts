
import { FileSystemResourceProvider } from './src/shared/export/providers/FileSystemResourceProvider';
import * as path from 'path';

async function verify() {
    const publicDir = path.resolve(process.cwd(), 'public');
    const provider = new FileSystemResourceProvider(publicDir);

    console.log('Fetching exe_math...');
    const patterns = [{
        name: 'exe_math',
        type: 'regex',
        pattern: new RegExp('\\(|\\['),
        files: ['exe_math'],
        isDirectory: true,
    }];

    // Pattern uses string type 'regex' just for interface match, logic inside provider uses name/files/isDirectory
    // Actually provider expects LibraryPattern type.
    // Let's just pass ['exe_math'] as filePaths which triggers the directory logic in fetchLibraryFiles if pattern matches.

    // Wait, fetchLibraryFiles takes (filePaths, patterns). 
    // files: ['exe_math'].

    const files = await provider.fetchLibraryFiles(['exe_math'], patterns as any);

    console.log(`Fetched ${files.size} files.`);
    const amscd = Array.from(files.keys()).find(k => k.includes('amscd.js'));
    console.log('amscd.js found:', amscd);

    const tooltip = await provider.fetchLibraryFiles(['exe_tooltips/exe_tooltips.js']);
    console.log('exe_tooltips.js found:', tooltip.has('exe_tooltips/exe_tooltips.js'));
}

verify().catch(console.error);
