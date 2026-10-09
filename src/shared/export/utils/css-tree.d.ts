// css-tree publishes browser-friendly subpaths, but @types/css-tree only describes the root.
// Reuse its definitions without importing the root's lexer and syntax data at runtime.
declare module 'css-tree/parser' {
    import { parse } from 'css-tree';
    export default parse;
}

declare module 'css-tree/walker' {
    import { walk } from 'css-tree';
    export default walk;
}

declare module 'css-tree/utils' {
    export { string, url } from 'css-tree';
}
