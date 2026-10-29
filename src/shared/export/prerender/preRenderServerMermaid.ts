import { ServerMermaidPreRenderer } from './ServerMermaidPreRenderer';
import type { MermaidPreRenderResult } from './interfaces';

// Mermaid holds process-wide DOM state. Serialize only rendering, so concurrent HTTP exports
// cannot replace or remove each other's globals while the rest of each export runs independently.
let pending: Promise<void> = Promise.resolve();

/** Server export hook with scoped DOM globals and cleanup on success or failure. */
export function preRenderServerMermaid(html: string): Promise<MermaidPreRenderResult> {
    const result = pending.then(async () => {
        const renderer = new ServerMermaidPreRenderer();
        try {
            return await renderer.preRender(html);
        } finally {
            renderer.destroy();
        }
    });
    pending = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
}
