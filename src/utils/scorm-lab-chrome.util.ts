/**
 * Style Lab — SCORM chrome generator.
 *
 * Builds a self-contained HTML wrapper around a generated SCORM 1.2 export
 * that mimics the look of the mod_exescorm Moodle player: a blue topbar with
 * 5 navigation buttons (skipprev / prev / up / next / skipnext) plus a
 * collapsible TOC sidebar. Each navigation action swaps the `src` of the
 * inner iframe so the SCO HTML files render exactly as they would inside
 * a real LMS, minus the SCORM API.
 */
import { XMLParser } from 'fast-xml-parser';

export interface ManifestItem {
    id: string;
    title: string;
    href: string | null;
    children: ManifestItem[];
}

export interface ScormManifest {
    title: string;
    items: ManifestItem[];
}

export interface FlatManifestEntry {
    id: string;
    title: string;
    href: string;
    depth: number;
    parentId: string | null;
}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    isArray: name => name === 'item' || name === 'organization' || name === 'resource',
});

function readTitle(raw: unknown): string {
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && '#text' in raw) {
        return String((raw as Record<string, unknown>)['#text'] ?? '');
    }
    return '';
}

export function parseScormManifest(xml: string): ScormManifest {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const manifest = (parsed.manifest ?? {}) as Record<string, unknown>;
    const organizations = (manifest.organizations ?? {}) as Record<string, unknown>;
    const defaultOrgId = (organizations['@_default'] as string) ?? '';
    const orgs = (organizations.organization as Array<Record<string, unknown>> | undefined) ?? [];
    const org = orgs.find(o => o['@_identifier'] === defaultOrgId) ?? orgs[0] ?? {};

    const resourcesNode = (manifest.resources ?? {}) as Record<string, unknown>;
    const resources = (resourcesNode.resource as Array<Record<string, unknown>> | undefined) ?? [];
    const hrefMap = new Map<string, string>();
    for (const r of resources) {
        const id = r['@_identifier'] as string | undefined;
        const href = r['@_href'] as string | undefined;
        if (id && href) hrefMap.set(id, href);
    }

    function convert(item: Record<string, unknown>): ManifestItem {
        const childRaw = (item.item as Array<Record<string, unknown>> | undefined) ?? [];
        const ref = item['@_identifierref'] as string | undefined;
        return {
            id: String(item['@_identifier'] ?? ''),
            title: readTitle(item.title),
            href: ref ? (hrefMap.get(ref) ?? null) : null,
            children: childRaw.map(convert),
        };
    }

    const items = ((org.item as Array<Record<string, unknown>> | undefined) ?? []).map(convert);
    return { title: readTitle(org.title) || 'SCORM Content', items };
}

export function flattenManifest(manifest: ScormManifest): FlatManifestEntry[] {
    const out: FlatManifestEntry[] = [];
    function walk(items: ManifestItem[], depth: number, parentId: string | null) {
        for (const it of items) {
            if (it.href) out.push({ id: it.id, title: it.title, href: it.href, depth, parentId });
            walk(it.children, depth + 1, it.id);
        }
    }
    walk(manifest.items, 0, null);
    return out;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderTocTree(items: ManifestItem[]): string {
    if (items.length === 0) return '';
    const lis = items
        .map(it => {
            const label = escapeHtml(it.title || '(untitled)');
            const href = it.href ? escapeHtml(it.href) : '';
            const node = href
                ? `<a data-href="${href}" href="${href}">${label}</a>`
                : `<span class="lab-toc-folder">${label}</span>`;
            const sub = it.children.length ? renderTocTree(it.children) : '';
            return `<li>${node}${sub}</li>`;
        })
        .join('');
    return `<ul>${lis}</ul>`;
}

const ICONS = {
    skipprev:
        '<svg viewBox="0 96 960 960"><path d="M453 815 213 575l240-240 42 42-198 198 198 198-42 42Zm253 0L466 575l240-240 42 42-198 198 198 198-42 42Z"/></svg>',
    prev: '<svg viewBox="0 96 960 960"><path d="M561 816 320 575l241-241 43 43-198 198 198 198-43 43Z"/></svg>',
    up: '<svg viewBox="0 96 960 960"><path d="m283 699-43-43 240-240 240 240-43 43-197-197-197 197Z"/></svg>',
    next: '<svg viewBox="0 96 960 960"><path d="m375 816-43-43 198-198-198-198 43-43 241 241-241 241Z"/></svg>',
    skipnext:
        '<svg viewBox="0 96 960 960"><path d="m255 815-42-42 198-198-198-198 42-42 240 240-240 240Zm253 0-42-42 198-198-198-198 42-42 240 240-240 240Z"/></svg>',
};

const STRINGS = {
    es: { first: 'Primero', prev: 'Anterior', up: 'Subir', next: 'Siguiente', last: 'Último', menu: 'Menú' },
    en: { first: 'First', prev: 'Previous', up: 'Up', next: 'Next', last: 'Last', menu: 'Menu' },
    fr: { first: 'Premier', prev: 'Précédent', up: 'Haut', next: 'Suivant', last: 'Dernier', menu: 'Menu' },
} as const;

export function renderScormLabChrome(manifest: ScormManifest, locale: 'es' | 'en' | 'fr' = 'en'): string {
    const flat = flattenManifest(manifest);
    const first = flat[0];
    const title = escapeHtml(manifest.title);
    const toc = renderTocTree(manifest.items);
    const strings = STRINGS[locale] ?? STRINGS.en;
    const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
    const flatJson = safeJson(flat);
    const baseTitleJson = safeJson(manifest.title);
    const firstHref = first ? escapeHtml(first.href) : '';

    return `<!doctype html>
<html lang="${locale}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} · SCORM preview</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; }
        .lab-shell { display: grid; grid-template-rows: 44px 1fr; grid-template-columns: 260px 1fr; grid-template-areas: "topbar topbar" "toc content"; height: 100%; background: #fff; }
        .lab-shell.toc-collapsed { grid-template-columns: 0 1fr; }
        .lab-topbar { grid-area: topbar; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 12px; background: #0d6efd; color: white; }
        .lab-toggle { background: transparent; border: 0; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; font: 500 13px/1 inherit; }
        .lab-toggle:hover { background: rgba(255,255,255,0.15); }
        .lab-title { flex: 1; font: 600 13px/1.2 inherit; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lab-nav { display: flex; gap: 0; }
        .lab-nav button { background: transparent; border: 0; color: #fff; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; border-radius: 4px; }
        .lab-nav button:first-child { border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
        .lab-nav button:last-child  { border-top-right-radius: 6px; border-bottom-right-radius: 6px; }
        .lab-nav button svg { width: 18px; height: 18px; fill: #fff; }
        .lab-nav button:hover:not(:disabled) { background: rgba(255,255,255,0.18); }
        .lab-nav button:disabled { opacity: 0.35; cursor: default; }
        .lab-toc { grid-area: toc; overflow: auto; border-right: 1px solid #d3d7e0; background: #f6f7fb; padding: 10px 6px; font-size: 13px; min-width: 0; }
        .lab-shell.toc-collapsed .lab-toc { display: none; }
        .lab-toc ul { list-style: none; padding-left: 0; margin: 0; }
        .lab-toc ul ul { padding-left: 14px; border-left: 1px dashed #d3d7e0; margin-left: 6px; }
        .lab-toc li { margin: 1px 0; }
        .lab-toc a, .lab-toc .lab-toc-folder { display: block; padding: 4px 8px; color: #1a1d2e; text-decoration: none; border-radius: 4px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lab-toc .lab-toc-folder { color: #5b6478; cursor: default; font-weight: 500; }
        .lab-toc a:hover { background: rgba(13,110,253,0.08); }
        .lab-toc a.is-active { background: #0d6efd; color: white; }
        .lab-content { grid-area: content; position: relative; overflow: hidden; min-width: 0; }
        .lab-content iframe { width: 100%; height: 100%; border: 0; display: block; background: white; }
        @media (max-width: 600px) { .lab-shell { grid-template-columns: 0 1fr; } .lab-shell:not(.toc-collapsed) .lab-toc { display: block; position: absolute; top: 44px; left: 0; bottom: 0; width: 240px; z-index: 5; box-shadow: 0 4px 16px rgba(15,18,32,.12); } }
    </style>
</head>
<body>
    <div class="lab-shell" id="lab-shell">
        <div class="lab-topbar">
            <button type="button" class="lab-toggle" id="lab-toggle">☰ ${strings.menu}</button>
            <div class="lab-title" id="lab-title">${title}</div>
            <div class="lab-nav" role="toolbar" aria-label="Navigation">
                <button id="nav-skipprev" title="${strings.first}" aria-label="${strings.first}">${ICONS.skipprev}</button>
                <button id="nav-prev"     title="${strings.prev}"  aria-label="${strings.prev}">${ICONS.prev}</button>
                <button id="nav-up"       title="${strings.up}"    aria-label="${strings.up}">${ICONS.up}</button>
                <button id="nav-next"     title="${strings.next}"  aria-label="${strings.next}">${ICONS.next}</button>
                <button id="nav-skipnext" title="${strings.last}"  aria-label="${strings.last}">${ICONS.skipnext}</button>
            </div>
        </div>
        <nav class="lab-toc" id="lab-toc" aria-label="Table of contents">${toc}</nav>
        <div class="lab-content"><iframe id="lab-frame" src="${firstHref}" title="${title}"></iframe></div>
    </div>
    <script>
        (function () {
            const TOC = ${flatJson};
            const shell = document.getElementById('lab-shell');
            const frame = document.getElementById('lab-frame');
            const titleEl = document.getElementById('lab-title');
            const tocEl = document.getElementById('lab-toc');
            const baseTitle = ${baseTitleJson};
            let current = 0;

            function indexOfHref(href) { return TOC.findIndex(it => it.href === href); }
            function indexOfId(id) { return TOC.findIndex(it => it.id === id); }

            function select(i) {
                if (!TOC.length) return;
                if (i < 0) i = 0;
                if (i >= TOC.length) i = TOC.length - 1;
                current = i;
                const it = TOC[i];
                frame.src = it.href;
                titleEl.textContent = baseTitle + ' · ' + it.title;
                for (const a of tocEl.querySelectorAll('a[data-href]')) {
                    a.classList.toggle('is-active', a.dataset.href === it.href);
                }
                document.getElementById('nav-skipprev').disabled = i === 0;
                document.getElementById('nav-prev').disabled = i === 0;
                document.getElementById('nav-next').disabled = i === TOC.length - 1;
                document.getElementById('nav-skipnext').disabled = i === TOC.length - 1;
                document.getElementById('nav-up').disabled = it.parentId === null || indexOfId(it.parentId) < 0;
                try { history.replaceState(null, '', '#' + encodeURIComponent(it.href)); } catch {}
            }

            tocEl.addEventListener('click', e => {
                const a = e.target.closest('a[data-href]');
                if (!a) return;
                e.preventDefault();
                const i = indexOfHref(a.dataset.href);
                if (i >= 0) select(i);
            });
            document.getElementById('lab-toggle').addEventListener('click', () => shell.classList.toggle('toc-collapsed'));
            document.getElementById('nav-skipprev').addEventListener('click', () => select(0));
            document.getElementById('nav-prev').addEventListener('click', () => select(current - 1));
            document.getElementById('nav-next').addEventListener('click', () => select(current + 1));
            document.getElementById('nav-skipnext').addEventListener('click', () => select(TOC.length - 1));
            document.getElementById('nav-up').addEventListener('click', () => {
                const it = TOC[current];
                if (!it || it.parentId === null) return;
                const pi = indexOfId(it.parentId);
                if (pi >= 0) select(pi);
            });

            const hash = (location.hash || '').slice(1);
            const initial = hash ? indexOfHref(decodeURIComponent(hash)) : 0;
            select(initial >= 0 ? initial : 0);
        })();
    </script>
</body>
</html>`;
}
