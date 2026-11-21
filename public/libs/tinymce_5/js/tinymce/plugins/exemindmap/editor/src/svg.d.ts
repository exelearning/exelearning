/** SVG files imported as text (the `.svg` loader of scripts/build-mindmap-editor.ts). */
declare module '*.svg' {
    const svg: string;
    export default svg;
}

/** Stylesheets imported for their side effect (bundled into the editor CSS by the build). */
declare module '*.css';
