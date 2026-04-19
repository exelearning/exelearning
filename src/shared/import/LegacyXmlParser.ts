/**
 * LegacyXmlParser
 *
 * Parses legacy .elp files (contentv3.xml) that use Python pickle format.
 * Converts the legacy XML structure to the same format as modern ODE XML.
 *
 * This is a TypeScript conversion of public/app/yjs/LegacyXmlParser.js
 * designed to work in both browser (via bundle) and server (via direct import).
 *
 * Legacy format has XML like:
 * <instance class="exe.engine.package.Package">
 *   <dictionary>
 *     <string role="key" value="_title"/>
 *     <unicode value="Project Title"/>
 *     ...
 *   </dictionary>
 * </instance>
 */

import { DOMParser } from '@xmldom/xmldom';
import type { Logger } from './interfaces';
import { defaultLogger, FEEDBACK_TRANSLATIONS } from './interfaces';
import { LegacyHandlerRegistry } from './legacy-handlers';
import type { IdeviceHandlerContext } from './legacy-handlers';
import { stripLegacyExeTextWrapper } from './legacyExeTextWrapper';

/**
 * Metadata extracted from legacy Python pickle format
 */
export interface LegacyMetadata {
    title: string;
    author: string;
    description: string;
    language: string;
    license: string;
    footer: string;
    extraHeadContent: string;
    exportSource: boolean;
    pp_addPagination: boolean;
    pp_addSearchBox: boolean;
    pp_addExeLink: boolean;
    pp_addAccessibilityToolbar: boolean;
}

/**
 * Block properties for iDevice containers
 */
export interface LegacyBlockProperties {
    visibility?: string;
    teacherOnly?: string;
    [key: string]: unknown;
}

/**
 * iDevice data extracted from legacy format
 */
export interface LegacyIdevice {
    id: string;
    type: string;
    title: string;
    icon: string;
    position: number;
    htmlView: string;
    feedbackHtml: string;
    feedbackButton: string;
    properties?: Record<string, unknown>;
    cssClass?: string;
    blockProperties?: LegacyBlockProperties;
}

/**
 * Block data extracted from legacy format
 */
export interface LegacyBlock {
    id: string;
    name: string;
    iconName: string;
    position: number;
    idevices: LegacyIdevice[];
    blockProperties?: LegacyBlockProperties;
}

/**
 * Page data extracted from legacy format
 */
export interface LegacyPage {
    id: string;
    title: string;
    parent_id: string | null;
    position: number;
    blocks: LegacyBlock[];
    children?: LegacyPage[];
}

/**
 * Result of parsing legacy XML
 */
export interface LegacyParseResult {
    meta: LegacyMetadata;
    pages: LegacyPage[];
}

/**
 * LegacyXmlParser class
 * Parses legacy .elp files (contentv3.xml) and converts to modern format
 */
export class LegacyXmlParser {
    private xmlContent: string = '';
    private xmlDoc: Document | null = null;
    private parentRefMap: Map<string, string | null> = new Map();
    private projectLanguage: string = '';
    private logger: Logger;

    /**
     * LEGACY ICON TO THEME ICON MAPPING CONVENTION
     * Maps legacy iDevice icon names to modern theme icon names.
     */
    static LEGACY_ICON_MAP: Record<string, string> = {
        preknowledge: 'think',
        reading: 'book',
        casestudy: 'case',
        question: 'interactive',
    };

    /**
     * DEFAULT IDEVICE TITLES THAT SHOULD NOT BE SHOWN AS BLOCK NAMES
     *
     * When importing legacy ELP files from eXe 2.x, iDevices often have
     * default titles like "Free Text" or "Text" that were automatically
     * assigned by the system. These should NOT appear as block titles
     * in eXe 3 - only custom, user-defined titles should be preserved.
     *
     * This set contains all known default titles in multiple languages
     * that should result in an empty blockName.
     */
    static DEFAULT_IDEVICE_TITLES: Set<string> = new Set([
        // Free Text iDevice - all languages
        'Free Text',
        'Texto libre',
        'Text lliure',
        'Testu librea',
        'Texto livre',
        'Texte libre',
        'Freier Text',
        'Testo libero',
        // Text iDevice - all languages
        'Text',
        'Texto',
        'Testua',
        'Texte',
    ]);

    /**
     * IDEVICE TITLE TRANSLATIONS
     */
    static IDEVICE_TITLE_TRANSLATIONS: Record<string, Record<string, string>> = {
        'Case Study': {
            es: 'Caso practico',
            en: 'Case Study',
            ca: 'Cas practic',
            va: 'Cas practic',
            eu: 'Kasu praktikoa',
            gl: 'Caso practico',
            pt: 'Caso pratico',
            fr: 'Etude de cas',
            de: 'Fallstudie',
            it: 'Caso di studio',
        },
        Activity: {
            es: 'Actividad',
            en: 'Activity',
            ca: 'Activitat',
            va: 'Activitat',
            eu: 'Jarduera',
            gl: 'Actividade',
            pt: 'Atividade',
            fr: 'Activite',
            de: 'Aktivitat',
            it: 'Attivita',
        },
        'Reading Activity': {
            es: 'Actividad de lectura',
            en: 'Reading Activity',
            ca: 'Activitat de lectura',
            va: 'Activitat de lectura',
            eu: 'Irakurketa jarduera',
            gl: 'Actividade de lectura',
            pt: 'Atividade de leitura',
            fr: 'Activite de lecture',
            de: 'Leseaktivitat',
            it: 'Attivita di lettura',
        },
        Preknowledge: {
            es: 'Conocimiento previo',
            en: 'Preknowledge',
            ca: 'Coneixement previ',
            va: 'Coneixement previ',
            eu: 'Aurretiko ezagutza',
            gl: 'Conecemento previo',
            pt: 'Conhecimento previo',
            fr: 'Prerequis',
            de: 'Vorwissen',
            it: 'Conoscenze pregresse',
        },
        Objectives: {
            es: 'Objetivos',
            en: 'Objectives',
            ca: 'Objectius',
            va: 'Objectius',
            eu: 'Helburuak',
            gl: 'Obxectivos',
            pt: 'Objetivos',
            fr: 'Objectifs',
            de: 'Ziele',
            it: 'Obiettivi',
        },
        Task: {
            es: 'Tarea',
            en: 'Task',
            ca: 'Tasca',
            va: 'Tasca',
            eu: 'Zeregina',
            gl: 'Tarefa',
            pt: 'Tarefa',
            fr: 'Tache',
            de: 'Aufgabe',
            it: 'Compito',
        },
        Quotation: {
            es: 'Cita',
            en: 'Quotation',
            ca: 'Citacio',
            va: 'Citacio',
            eu: 'Aipua',
            gl: 'Cita',
            pt: 'Citacao',
            fr: 'Citation',
            de: 'Zitat',
            it: 'Citazione',
        },
        Reflection: {
            es: 'Reflexion',
            en: 'Reflection',
            ca: 'Reflexio',
            va: 'Reflexio',
            eu: 'Hausnarketa',
            gl: 'Reflexion',
            pt: 'Reflexao',
            fr: 'Reflexion',
            de: 'Reflexion',
            it: 'Riflessione',
        },
        'Free Text': {
            es: 'Texto libre',
            en: 'Free Text',
            ca: 'Text lliure',
            va: 'Text lliure',
            eu: 'Testu librea',
            gl: 'Texto libre',
            pt: 'Texto livre',
            fr: 'Texte libre',
            de: 'Freier Text',
            it: 'Testo libero',
        },
        'True-False Question': {
            es: 'Pregunta verdadero-falso',
            en: 'True-False Question',
            ca: 'Pregunta vertader-fals',
            va: 'Pregunta vertader-fals',
            eu: 'Egia-gezurra galdera',
            gl: 'Pregunta verdadeiro-falso',
            pt: 'Pergunta verdadeiro-falso',
            fr: 'Question vrai-faux',
            de: 'Wahr-Falsch-Frage',
            it: 'Domanda vero-falso',
        },
        'Multi-select': {
            es: 'Seleccion multiple',
            en: 'Multi-select',
            ca: 'Seleccio multiple',
            va: 'Seleccio multiple',
            eu: 'Hautapen anitza',
            gl: 'Seleccion multiple',
            pt: 'Selecao multipla',
            fr: 'Selection multiple',
            de: 'Mehrfachauswahl',
            it: 'Selezione multipla',
        },
        'Multi-choice': {
            es: 'Eleccion multiple',
            en: 'Multi-choice',
            ca: 'Eleccio multiple',
            va: 'Eleccio multiple',
            eu: 'Aukera anitza',
            gl: 'Eleccion multiple',
            pt: 'Escolha multipla',
            fr: 'Choix multiple',
            de: 'Multiple Choice',
            it: 'Scelta multipla',
        },
        'Download source file': {
            es: 'Descargar archivo fuente',
            en: 'Download source file',
            ca: 'Descarregar fitxer font',
            va: 'Descarregar fitxer font',
            eu: 'Deskargatu iturburu fitxategia',
            gl: 'Descargar ficheiro fonte',
            pt: 'Baixar arquivo fonte',
            fr: 'Telecharger le fichier source',
            de: 'Quelldatei herunterladen',
            it: 'Scarica file sorgente',
        },
    };

    constructor(logger: Logger = defaultLogger) {
        this.logger = logger;
    }

    /**
     * Get localized "Show Feedback" text based on language code
     */
    getLocalizedFeedbackText(langCode: string): string {
        const lang = (langCode || '').split('-')[0].toLowerCase();
        return FEEDBACK_TRANSLATIONS[lang] || FEEDBACK_TRANSLATIONS.es;
    }

    /**
     * Get localized "Case Study" title based on language code
     */
    getLocalizedCaseStudyTitle(langCode: string): string {
        return this.getLocalizedIdeviceTitle('Case Study', langCode) || 'Caso practico';
    }

    /**
     * Get localized iDevice title based on English title and language code
     */
    getLocalizedIdeviceTitle(englishTitle: string, langCode: string): string | null {
        const translations = LegacyXmlParser.IDEVICE_TITLE_TRANSLATIONS[englishTitle];
        if (!translations) return null;
        const lang = (langCode || '').split('-')[0].toLowerCase();
        return translations[lang] || translations.es || englishTitle;
    }

    /**
     * Preprocess legacy XML content before parsing
     * Fixes encoding issues from eXe 2.x exports
     */
    preprocessLegacyXml(xmlContent: string): string {
        let xml = xmlContent;

        // 1. Remove indentations (5 spaces, tabs)
        xml = xml.replace(/ {5}/g, '');
        xml = xml.replace(/\t/g, '');

        // 2. Unify newlines to Unix LF
        xml = xml.replace(/\r/g, '\n');
        xml = xml.replace(/\n\n/g, '\n');

        // 3. Convert newlines to &#10; entity
        xml = xml.replace(/\n/g, '&#10;');

        // 4. Restore newlines between tags
        xml = xml.replace(/>&#10;</g, '>\n<');

        // 5. Convert hex escape sequences (\xNN) to characters
        xml = xml.replace(/\\x([0-9A-Fa-f]{2})/g, (_match, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
        });

        // 6. Convert \n to &#10;
        xml = xml.replace(/\\n/g, '&#10;');

        return xml;
    }

    /**
     * Parse legacy XML content and return normalized structure
     */
    parse(xmlContent: string): LegacyParseResult {
        this.logger.log('[LegacyXmlParser] Parsing legacy XML format');

        // Preprocess XML to fix encoding issues from eXe 2.x
        this.xmlContent = this.preprocessLegacyXml(xmlContent);

        // Parse XML using @xmldom/xmldom (works in both Node.js and browser)
        // @xmldom/xmldom >=0.9 throws ParseError directly for fatal errors (e.g. unclosed tags)
        const parser = new DOMParser();
        try {
            this.xmlDoc = parser.parseFromString(this.xmlContent, 'text/xml') as unknown as Document;
        } catch (e) {
            throw new Error(`XML parsing error: ${(e as Error).message}`);
        }

        const parseError = this.xmlDoc.getElementsByTagName('parsererror')[0];
        if (parseError) {
            throw new Error(`XML parsing error: ${parseError.textContent}`);
        }

        // Build parent reference map
        this.buildParentReferenceMap();

        // Find all Node instances (pages)
        const nodes = this.findAllNodes();
        this.logger.log(`[LegacyXmlParser] Found ${nodes.length} legacy nodes`);

        // Extract metadata
        const meta = this.extractMetadata();

        // Store project language for handlers to use
        this.projectLanguage = meta.language || '';

        // Build page hierarchy
        const pages = this.buildPageHierarchy(nodes);

        // Convert internal links (exe-node: path-based to ID-based)
        const fullPathMap = this.buildFullPathMap(pages);
        this.convertAllInternalLinks(pages, fullPathMap);

        this.logger.log(`[LegacyXmlParser] Parse complete: ${pages.length} pages`);

        return {
            meta,
            pages,
        };
    }

    /**
     * Build parent reference map from XML
     */
    private buildParentReferenceMap(): void {
        if (!this.xmlDoc) return;

        const nodeInstances = this.getElementsByAttribute(this.xmlDoc, 'instance', 'class', 'exe.engine.node.Node');

        for (const nodeEl of nodeInstances) {
            const ref = nodeEl.getAttribute('reference');
            if (!ref) continue;

            const dict = this.getDirectChildByTagName(nodeEl, 'dictionary');
            if (!dict) continue;

            const parentRef = this.findDictValue(dict, 'parent');
            this.parentRefMap.set(ref, parentRef as string | null);
        }

        this.logger.log(`[LegacyXmlParser] Built parent map with ${this.parentRefMap.size} entries`);
    }

    /**
     * Find value for a key in a dictionary element
     */
    private findDictValue(dict: Element, key: string): string | boolean | null {
        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === key
            ) {
                const valueEl = children[i + 1];
                if (!valueEl) return null;

                if (valueEl.tagName === 'none') {
                    return null;
                }
                if (valueEl.tagName === 'reference') {
                    return valueEl.getAttribute('key');
                }
                if (valueEl.tagName === 'unicode' || valueEl.tagName === 'string') {
                    return valueEl.getAttribute('value') || valueEl.textContent;
                }
                if (valueEl.tagName === 'bool') {
                    const boolVal = valueEl.getAttribute('value');
                    return boolVal === '1' || boolVal === 'True' || boolVal === 'true';
                }
                if (valueEl.tagName === 'instance') {
                    return valueEl.getAttribute('reference');
                }
            }
        }

        return null;
    }

    /**
     * Check if a Node instance is defined inside a parentNode field
     */
    private isNodeInsideParentNodeField(nodeEl: Element): boolean {
        let prev: Node | null = nodeEl.previousSibling;
        while (prev && prev.nodeType !== 1) {
            prev = prev.previousSibling;
        }
        const prevElement = prev as Element | null;

        return (
            prevElement?.tagName === 'string' &&
            prevElement.getAttribute('role') === 'key' &&
            prevElement.getAttribute('value') === 'parentNode'
        );
    }

    /**
     * Check if a node is an empty phantom node
     * Returns true only if BOTH idevices AND children keys exist with empty lists
     */
    private isEmptyPhantomNode(nodeEl: Element): boolean {
        const dict = this.getDirectChildByTagName(nodeEl, 'dictionary');
        if (!dict) return true;

        const idevicesList = this.findDictList(dict, 'idevices');
        const childrenList = this.findDictList(dict, 'children');

        // Only consider it empty if BOTH keys exist and are empty
        // If a key is missing, we can't be sure it's a phantom node
        if (idevicesList === null || childrenList === null) {
            return false;
        }

        const isIdevicesEmpty = Array.from(idevicesList.childNodes).filter(n => n.nodeType === 1).length === 0;
        const isChildrenEmpty = Array.from(childrenList.childNodes).filter(n => n.nodeType === 1).length === 0;

        return isIdevicesEmpty && isChildrenEmpty;
    }

    /**
     * Find all Node instances in the document
     *
     * Legacy XML may define Node instances inline within parentNode fields.
     * These inline definitions are often the ONLY definition of those nodes,
     * so we must include all unique nodes (by reference), not filter them out.
     *
     * However, some legacy files (e.g., mujeres_huella.elp) have "phantom" nodes
     * defined inside parentNode fields that have EXPLICIT empty idevices AND
     * empty children lists. These phantom nodes should be filtered out to avoid
     * creating duplicate root nodes.
     *
     * This matches the PHP behavior in OdeXmlUtil.php:1109-1140 which uses
     * all exe.engine.node.Node instances without filtering.
     */
    private findAllNodes(): Element[] {
        if (!this.xmlDoc) return [];

        const allNodes = this.getElementsByAttribute(this.xmlDoc, 'instance', 'class', 'exe.engine.node.Node');
        const seenRefs = new Set<string>();
        const result: Element[] = [];

        for (const nodeEl of allNodes) {
            const ref = nodeEl.getAttribute('reference');
            if (!ref) continue;

            // Only skip if we've already included this exact reference
            if (seenRefs.has(ref)) {
                this.logger.log(`[LegacyXmlParser] Skipping duplicate node reference=${ref}`);
                continue;
            }

            // Filter out EMPTY phantom nodes defined inside parentNode fields
            if (this.isNodeInsideParentNodeField(nodeEl) && this.isEmptyPhantomNode(nodeEl)) {
                this.logger.log(
                    `[LegacyXmlParser] Skipping empty phantom node inside parentNode field, reference=${ref}`,
                );
                continue;
            }

            seenRefs.add(ref);
            result.push(nodeEl);
        }

        this.logger.log(
            `[LegacyXmlParser] Found ${result.length} unique nodes (from ${allNodes.length} total instances)`,
        );
        return result;
    }

    /**
     * Extract metadata from root package
     */
    private extractMetadata(): LegacyMetadata {
        const meta: LegacyMetadata = {
            title: 'Legacy Project',
            author: '',
            description: '',
            language: '',
            license: '',
            footer: '',
            extraHeadContent: '',
            exportSource: false,
            pp_addPagination: false,
            pp_addSearchBox: false,
            pp_addExeLink: true,
            pp_addAccessibilityToolbar: false,
        };

        if (!this.xmlDoc) return meta;

        const rootPackages = this.getElementsByAttribute(
            this.xmlDoc,
            'instance',
            'class',
            'exe.engine.package.Package',
        );
        const rootPackage = rootPackages[0];
        if (!rootPackage) return meta;

        const dict = this.getDirectChildByTagName(rootPackage, 'dictionary');
        if (!dict) return meta;

        const title = this.findDictValue(dict, '_title');
        if (title && typeof title === 'string') meta.title = title;

        const author = this.findDictValue(dict, '_author');
        if (author && typeof author === 'string') meta.author = author;

        const description = this.findDictValue(dict, '_description');
        if (description && typeof description === 'string') meta.description = description;

        const lang = this.findDictValue(dict, '_lang');
        if (lang && typeof lang === 'string') meta.language = lang;

        const footer = this.findDictValue(dict, 'footer');
        if (footer && typeof footer === 'string') meta.footer = footer;

        const extraHeadContent = this.findDictValue(dict, '_extraHeadContent');
        if (extraHeadContent && typeof extraHeadContent === 'string') meta.extraHeadContent = extraHeadContent;

        const addPagination = this.findDictValue(dict, '_addPagination');
        if (addPagination === true) meta.pp_addPagination = true;

        const addSearchBox = this.findDictValue(dict, '_addSearchBox');
        if (addSearchBox === true) meta.pp_addSearchBox = true;

        const exportSource = this.findDictValue(dict, 'exportSource');
        if (exportSource === true) meta.exportSource = true;

        const addExeLink = this.findDictValue(dict, '_addExeLink');
        if (addExeLink === false) meta.pp_addExeLink = false;

        const addAccessibilityToolbar = this.findDictValue(dict, '_addAccessibilityToolbar');
        if (addAccessibilityToolbar === true) meta.pp_addAccessibilityToolbar = true;

        const license = this.findDictValue(dict, 'license');
        if (license !== null && license !== undefined && typeof license === 'string') {
            meta.license = license === 'None' ? '' : license;
        }

        this.logger.log(`[LegacyXmlParser] Metadata: title="${meta.title}", license="${meta.license}"`);
        return meta;
    }

    /**
     * Check if the structure should flatten root children
     */
    private shouldFlattenRootChildren(rootPages: LegacyPage[]): {
        shouldFlatten: boolean;
        rootPage: LegacyPage | null;
    } {
        if (rootPages.length !== 1) {
            return { shouldFlatten: false, rootPage: null };
        }

        const rootPage = rootPages[0];
        const hasDirectChildren = rootPage.children && rootPage.children.length > 0;

        return { shouldFlatten: hasDirectChildren, rootPage };
    }

    /**
     * Flatten root children for legacy v2.x imports
     */
    private flattenRootChildren(rootPage: LegacyPage): LegacyPage[] {
        const flatPages: LegacyPage[] = [];

        // 1. Add root as first top-level page
        flatPages.push({
            id: rootPage.id,
            title: rootPage.title,
            parent_id: null,
            position: 0,
            blocks: rootPage.blocks,
        });

        // 2. Promote direct children to top-level
        if (rootPage.children) {
            rootPage.children.forEach(child => {
                flatPages.push({
                    id: child.id,
                    title: child.title,
                    parent_id: null,
                    position: flatPages.length,
                    blocks: child.blocks,
                });

                // 3. Add grandchildren with their parent relationships preserved
                if (child.children && child.children.length > 0) {
                    this.flattenPages(child.children, flatPages, child.id);
                }
            });
        }

        this.logger.log(`[LegacyXmlParser] Applied root node flattening convention for v2.x import`);
        return flatPages;
    }

    /**
     * Build page hierarchy from Node instances
     */
    private buildPageHierarchy(nodes: Element[]): LegacyPage[] {
        const pageMap = new Map<string, LegacyPage>();
        const rootPages: LegacyPage[] = [];

        // 1. Create page object for each node
        nodes.forEach((nodeEl, index) => {
            const ref = nodeEl.getAttribute('reference');
            if (!ref) return;

            const dict = this.getDirectChildByTagName(nodeEl, 'dictionary');
            const titleValue = dict ? this.findDictValue(dict, '_title') : null;
            const title = typeof titleValue === 'string' ? titleValue : 'Untitled';

            const page: LegacyPage = {
                id: `page-${ref}`,
                title: title,
                blocks: [],
                children: [],
                parent_id: null,
                position: index,
            };

            // Extract iDevices (components) for this node
            page.blocks = this.extractNodeBlocks(nodeEl);

            pageMap.set(ref, page);
        });

        // 2. Link children to parents
        pageMap.forEach((page, ref) => {
            const parentRef = this.parentRefMap.get(ref);
            if (parentRef && pageMap.has(parentRef)) {
                const parent = pageMap.get(parentRef)!;
                parent.children!.push(page);
                page.parent_id = parent.id;
            } else {
                rootPages.push(page);
            }
        });

        // 3. Sort children and root pages by document order (position)
        // This ensures pages appear in the order they were defined in the XML
        pageMap.forEach(page => {
            if (page.children && page.children.length > 0) {
                page.children.sort((a, b) => a.position - b.position);
            }
        });
        rootPages.sort((a, b) => a.position - b.position);

        // Apply root node flattening convention
        const { shouldFlatten, rootPage } = this.shouldFlattenRootChildren(rootPages);
        let flatPages: LegacyPage[];
        if (shouldFlatten && rootPage) {
            flatPages = this.flattenRootChildren(rootPage);
        } else {
            flatPages = [];
            this.flattenPages(rootPages, flatPages, null);
        }

        // Reassign positions sequentially after flattening
        flatPages.forEach((page, index) => {
            page.position = index;
        });

        // Detect and apply node reordering
        const nodesChangeRef = this.detectNodeReorderMap();
        if (nodesChangeRef.size > 0) {
            flatPages = this.applyNodeReordering(flatPages, nodesChangeRef);
        }

        return flatPages;
    }

    /**
     * Flatten page tree into array
     */
    private flattenPages(pages: LegacyPage[], result: LegacyPage[], parentId: string | null): void {
        pages.forEach(page => {
            const flatPage: LegacyPage = {
                id: page.id,
                title: page.title,
                parent_id: parentId,
                position: result.length,
                blocks: page.blocks,
            };
            result.push(flatPage);

            if (page.children && page.children.length > 0) {
                this.flattenPages(page.children, result, page.id);
            }
        });
    }

    /**
     * Detect nodes needing reordering
     */
    private detectNodeReorderMap(): Map<number, number> {
        const nodesChangeRef = new Map<number, number>();

        if (!this.xmlDoc) return nodesChangeRef;

        const allNodes = this.getElementsByAttribute(this.xmlDoc, 'instance', 'class', 'exe.engine.node.Node');

        for (const node of allNodes) {
            const nodeRef = node.getAttribute('reference');
            if (!nodeRef) continue;

            const dict = this.getDirectChildByTagName(node, 'dictionary');
            if (!dict) continue;

            const childrenList = this.findDictList(dict, 'children');
            if (!childrenList) continue;

            let prevRef = parseInt(nodeRef, 10);

            const children = Array.from(childrenList.childNodes).filter(n => n.nodeType === 1) as Element[];
            for (const child of children) {
                if (child.tagName === 'instance') {
                    const instRef = child.getAttribute('reference');
                    if (instRef) {
                        prevRef = parseInt(instRef, 10);
                    }
                } else if (child.tagName === 'reference') {
                    const refKey = parseInt(child.getAttribute('key') || '0', 10);
                    nodesChangeRef.set(refKey, prevRef);
                    prevRef = refKey;
                }
            }
        }

        if (nodesChangeRef.size > 0) {
            this.logger.log(`[LegacyXmlParser] Detected ${nodesChangeRef.size} nodes needing reordering`);
        }

        return nodesChangeRef;
    }

    /**
     * Apply node reordering
     */
    private applyNodeReordering(pages: LegacyPage[], nodesChangeRef: Map<number, number>): LegacyPage[] {
        if (nodesChangeRef.size === 0) return pages;

        const pageRefMap = new Map<number, LegacyPage>();
        for (const page of pages) {
            const ref = page.id.replace('page-', '');
            pageRefMap.set(parseInt(ref, 10), page);
        }

        for (const [oldRef, afterRef] of nodesChangeRef) {
            const pageToMove = pageRefMap.get(oldRef);
            const referencePoint = pageRefMap.get(afterRef);

            if (pageToMove && referencePoint) {
                pageToMove.position = referencePoint.position + 0.5;
            }
        }

        pages.sort((a, b) => a.position - b.position);

        pages.forEach((page, index) => {
            page.position = index;
        });

        this.logger.log(`[LegacyXmlParser] Reordered ${nodesChangeRef.size} nodes`);
        return pages;
    }

    /**
     * Build path map for internal link conversion
     */
    private buildFullPathMap(pages: LegacyPage[]): Map<string, string> {
        const fullPathMap = new Map<string, string>();
        const pageIdMap = new Map<string, { id: string; name: string; parent_id: string | null }>();

        // First pass: build page info map
        for (const page of pages) {
            pageIdMap.set(page.id, {
                id: page.id,
                name: page.title,
                parent_id: page.parent_id,
            });
        }

        // Second pass: build full paths
        for (const page of pages) {
            const pathParts = [page.title];
            let currentParentId = page.parent_id;

            while (currentParentId && pageIdMap.has(currentParentId)) {
                const parent = pageIdMap.get(currentParentId)!;
                pathParts.unshift(parent.name);
                currentParentId = parent.parent_id;
            }

            const fullPath = pathParts.join(':');
            fullPathMap.set(fullPath, page.id);

            try {
                const decodedPath = decodeURIComponent(fullPath);
                if (decodedPath !== fullPath) {
                    fullPathMap.set(decodedPath, page.id);
                }
            } catch {
                // Ignore decoding errors
            }
        }

        // Third pass: Add root-prefixed paths for promoted children
        const rootPage = pages.find(p => p.parent_id === null && p.position === 0);
        if (rootPage) {
            const rootTitle = rootPage.title;
            const promotedChildren = pages.filter(p => p.parent_id === null && p.id !== rootPage.id);

            for (const promoted of promotedChildren) {
                const pathWithRoot = `${rootTitle}:${promoted.title}`;
                if (!fullPathMap.has(pathWithRoot)) {
                    fullPathMap.set(pathWithRoot, promoted.id);
                    this.logger.log(`[LegacyXmlParser] Added root-prefixed path: ${pathWithRoot}`);
                }
            }
        }

        if (fullPathMap.size > 0) {
            this.logger.log(`[LegacyXmlParser] Built path map with ${fullPathMap.size} entries`);
        }

        return fullPathMap;
    }

    /**
     * Convert exe-node: links from path-based to ID-based
     */
    private convertInternalLinks(html: string, fullPathMap: Map<string, string>): string {
        if (!html || !html.includes('exe-node:')) return html;

        const EXE_NODE_PREFIX = 'exe-node:';

        return html.replace(/href=["'](exe-node:[^"'#]+)(#[^"']*)?["']/gi, (match, linkPart, hashPart = '') => {
            const originalLink = linkPart;

            let cleanedLink = linkPart;
            try {
                cleanedLink = decodeURIComponent(cleanedLink);
            } catch {
                // Ignore decoding errors
            }

            let pathOnly = cleanedLink.replace(EXE_NODE_PREFIX, '');

            const segments = pathOnly.split(':');
            if (segments.length > 1) {
                const pathWithoutRoot = segments.slice(1).join(':');
                if (fullPathMap.has(pathWithoutRoot)) {
                    pathOnly = pathWithoutRoot;
                }
            }

            if (fullPathMap.has(pathOnly)) {
                const pageId = fullPathMap.get(pathOnly)!;
                const newLink = `${EXE_NODE_PREFIX}${pageId}`;
                this.logger.log(`[LegacyXmlParser] Converted link: ${originalLink} -> ${newLink}`);
                let finalHash = hashPart || '';
                if (finalHash === '#auto_top') {
                    finalHash = '';
                }
                return `href="${newLink}${finalHash}"`;
            }

            this.logger.log(`[LegacyXmlParser] Link not found in path map: ${pathOnly}`);
            return match;
        });
    }

    /**
     * Recursively convert internal links in object properties
     */
    private convertLinksInObject(obj: unknown, fullPathMap: Map<string, string>): void {
        if (!obj || typeof obj !== 'object') return;

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                if (typeof obj[i] === 'string' && obj[i].includes('exe-node:')) {
                    obj[i] = this.convertInternalLinks(obj[i], fullPathMap);
                } else if (typeof obj[i] === 'object') {
                    this.convertLinksInObject(obj[i], fullPathMap);
                }
            }
        } else {
            for (const key of Object.keys(obj)) {
                const value = (obj as Record<string, unknown>)[key];
                if (typeof value === 'string' && value.includes('exe-node:')) {
                    (obj as Record<string, unknown>)[key] = this.convertInternalLinks(value, fullPathMap);
                } else if (typeof value === 'object') {
                    this.convertLinksInObject(value, fullPathMap);
                }
            }
        }
    }

    /**
     * Convert all internal links in all iDevices
     */
    private convertAllInternalLinks(pages: LegacyPage[], fullPathMap: Map<string, string>): LegacyPage[] {
        if (fullPathMap.size === 0) return pages;

        let convertedCount = 0;

        for (const page of pages) {
            if (!page.blocks) continue;

            for (const block of page.blocks) {
                if (!block.idevices) continue;

                for (const idevice of block.idevices) {
                    if (idevice.htmlView?.includes('exe-node:')) {
                        const converted = this.convertInternalLinks(idevice.htmlView, fullPathMap);
                        if (converted !== idevice.htmlView) {
                            idevice.htmlView = converted;
                            convertedCount++;
                        }
                    }

                    if (idevice.feedbackHtml?.includes('exe-node:')) {
                        idevice.feedbackHtml = this.convertInternalLinks(idevice.feedbackHtml, fullPathMap);
                    }

                    if (idevice.properties) {
                        this.convertLinksInObject(idevice.properties, fullPathMap);
                    }
                }
            }
        }

        if (convertedCount > 0) {
            this.logger.log(`[LegacyXmlParser] Converted ${convertedCount} internal links`);
        }

        return pages;
    }

    /**
     * Extract iDevice title from instance
     */
    private extractIdeviceTitle(inst: Element): string {
        const dict = this.getDirectChildByTagName(inst, 'dictionary');
        if (!dict) return '';

        const titleValue = this.findDictValue(dict, '_title') || this.findDictValue(dict, 'title');
        return titleValue && typeof titleValue === 'string' && titleValue.trim() ? titleValue : '';
    }

    /**
     * Extract blocks and iDevices from a Node
     */
    private extractNodeBlocks(nodeEl: Element): LegacyBlock[] {
        const blocks: LegacyBlock[] = [];

        const dict = this.getDirectChildByTagName(nodeEl, 'dictionary');
        if (!dict) return blocks;

        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === 'idevices'
            ) {
                const listEl = children[i + 1];
                if (listEl && listEl.tagName === 'list') {
                    const idevices = this.extractIDevicesWithTitles(listEl);

                    idevices.forEach((idevice, idx) => {
                        const title = idevice.title || '';
                        // Filter out default iDevice titles - they should not appear as block names
                        // Only custom, user-defined titles should be preserved
                        const blockName = LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has(title) ? '' : title;
                        const block: LegacyBlock = {
                            id: `block-${nodeEl.getAttribute('reference')}-${idx}`,
                            name: blockName,
                            iconName: idevice.icon || '',
                            position: idx,
                            idevices: [idevice],
                        };
                        if (idevice.blockProperties) {
                            block.blockProperties = idevice.blockProperties;
                        }
                        blocks.push(block);
                    });
                }
                break;
            }
        }

        return blocks;
    }

    /**
     * Map legacy iDevice class names to modern types
     */
    private mapIdeviceType(className: string): string {
        const textBasedIdevices = [
            'FreeTextIdevice',
            'FreeTextfpdIdevice',
            'GenericIdevice',
            'TextIdevice',
            'ActivityIdevice',
            'TaskIdevice',
            'ObjectivesIdevice',
            'PreknowledgeIdevice',
            'ReadingActivityIdevice',
            'ReflectionIdevice',
            'ReflectionfpdIdevice',
            'ReflectionfpdmodifIdevice',
            'TareasIdevice',
            'ListaApartadosIdevice',
            'ComillasIdevice',
            'NotaInformacionIdevice',
            'NotaIdevice',
            'CasopracticofpdIdevice',
            'CitasparapensarfpdIdevice',
            'DebesconocerfpdIdevice',
            'DestacadofpdIdevice',
            'OrientacionestutoriafpdIdevice',
            'OrientacionesalumnadofpdIdevice',
            'ParasabermasfpdIdevice',
            'RecomendacionfpdIdevice',
            'WikipediaIdevice',
            'RssIdevice',
            'AppletIdevice',
            'FileAttachIdevice',
            'AttachmentIdevice',
        ];

        for (const textType of textBasedIdevices) {
            if (className.includes(textType)) {
                this.logger.log(`[LegacyXmlParser] Converting ${textType} to 'text' for editability`);
                return 'text';
            }
        }

        const interactiveTypeMap: Record<string, string> = {
            TrueFalseIdevice: 'trueorfalse',
            VerdaderofalsofpdIdevice: 'trueorfalse',
            MultichoiceIdevice: 'form',
            EleccionmultiplefpdIdevice: 'form',
            MultiSelectIdevice: 'form',
            SeleccionmultiplefpdIdevice: 'form',
            ClozeIdevice: 'complete',
            ClozefpdIdevice: 'complete',
            ClozelangfpdIdevice: 'complete',
            ImageMagnifierIdevice: 'magnifier',
            GalleryIdevice: 'image-gallery',
            CasestudyIdevice: 'casestudy',
            EjercicioresueltofpdIdevice: 'casestudy',
            ExternalUrlIdevice: 'external-website',
            QuizTestIdevice: 'quick-questions',
        };

        for (const [legacyType, modernType] of Object.entries(interactiveTypeMap)) {
            if (className.includes(legacyType)) {
                this.logger.log(`[LegacyXmlParser] Mapping ${legacyType} to '${modernType}'`);
                return modernType;
            }
        }

        const match = className.match(/(\w+)Idevice/);
        const extractedType = match ? match[1].toLowerCase() : 'unknown';
        this.logger.log(`[LegacyXmlParser] Unknown iDevice '${extractedType}' -> converting to 'text' for editability`);
        return 'text';
    }

    /**
     * Extract iDevices from a list element, including their titles
     */
    private extractIDevicesWithTitles(listEl: Element): LegacyIdevice[] {
        const idevices: LegacyIdevice[] = [];

        const directChildren = Array.from(listEl.childNodes).filter(n => n.nodeType === 1) as Element[];
        const instancesToProcess: Element[] = [];

        for (const child of directChildren) {
            if (child.tagName === 'instance') {
                instancesToProcess.push(child);
            } else if (child.tagName === 'reference') {
                const refKey = child.getAttribute('key');
                if (refKey && this.xmlDoc) {
                    const referencedInstance = this.getElementsByAttribute(
                        this.xmlDoc,
                        'instance',
                        'reference',
                        refKey,
                    )[0];
                    if (referencedInstance) {
                        this.logger.log(`[LegacyXmlParser] Resolved reference key=${refKey} to instance`);
                        instancesToProcess.push(referencedInstance);
                    } else {
                        this.logger.log(
                            `[LegacyXmlParser] WARNING: Could not find instance for reference key=${refKey}`,
                        );
                    }
                }
            }
        }

        this.logger.log(
            `[LegacyXmlParser] Found ${instancesToProcess.length} iDevice elements (${directChildren.filter(c => c.tagName === 'instance').length} direct, ${directChildren.filter(c => c.tagName === 'reference').length} references)`,
        );

        for (const inst of instancesToProcess) {
            const className = inst.getAttribute('class') || '';

            if (!className.toLowerCase().includes('idevice')) {
                this.logger.log(`[LegacyXmlParser] SKIPPING instance - no 'idevice' in class: ${className}`);
                continue;
            }

            const ref =
                inst.getAttribute('reference') || `idev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            const dict = this.getDirectChildByTagName(inst, 'dictionary');

            let ideviceType: string;
            let rawIdeviceDir = '';

            if (className === 'exe.engine.jsidevice.JsIdevice' && dict) {
                const iDeviceDir = this.findDictStringValue(dict, '_iDeviceDir');
                if (iDeviceDir) {
                    const parts = iDeviceDir.replace(/\\/g, '/').split('/');
                    const extractedType = parts[parts.length - 1] || iDeviceDir;
                    rawIdeviceDir = extractedType;

                    const jsIdeviceTypeMap: Record<string, string> = {
                        'adivina-activity': 'guess',
                        'candado-activity': 'padlock',
                        'clasifica-activity': 'classify',
                        'completa-activity': 'complete',
                        'desafio-activity': 'challenge',
                        'descubre-activity': 'discover',
                        'flipcards-activity': 'flipcards',
                        'identifica-activity': 'identify',
                        'listacotejo-activity': 'checklist',
                        'mapa-activity': 'map',
                        'mathematicaloperations-activity': 'mathematicaloperations',
                        'mathproblems-activity': 'mathproblems',
                        'ordena-activity': 'sort',
                        'quext-activity': 'quick-questions',
                        'relaciona-activity': 'relate',
                        'rosco-activity': 'az-quiz-game',
                        'selecciona-activity': 'quick-questions-multiple-choice',
                        'seleccionamedias-activity': 'select-media-files',
                        'sopa-activity': 'word-search',
                        'trivial-activity': 'trivial',
                        'videoquext-activity': 'quick-questions-video',
                        'download-package': 'download-source-file',
                        'form-activity': 'form',
                        rubrics: 'rubric',
                        'pbl-tools': 'text',
                    };
                    ideviceType = jsIdeviceTypeMap[extractedType] || extractedType;

                    const knownModernTypes = [
                        'text',
                        'casestudy',
                        'geogebra-activity',
                        'interactive-video',
                        'scrambled-list',
                        'udl-content',
                        'image-gallery',
                        'beforeafter',
                        'dragdrop',
                        'external-website',
                        'hidden-image',
                        'magnifier',
                        'periodic-table',
                        'trueorfalse',
                        'example',
                    ];
                    const allKnownTypes = [...Object.values(jsIdeviceTypeMap), ...knownModernTypes];
                    if (!allKnownTypes.includes(ideviceType)) {
                        this.logger.log(
                            `[LegacyXmlParser] Unknown JsIdevice type '${extractedType}', defaulting to 'text'`,
                        );
                        ideviceType = 'text';
                    }
                    this.logger.log(
                        `[LegacyXmlParser] JsIdevice detected with type: ${ideviceType} (from path: ${iDeviceDir})`,
                    );
                } else {
                    ideviceType = 'text';
                }
            } else if (this.isGenericIdeviceClass(className) && dict) {
                const typeName = this.findDictStringValue(dict, '__name__');
                if (typeName) {
                    ideviceType = this.mapGenericIdeviceType(typeName);
                    this.logger.log(
                        `[LegacyXmlParser] Generic Idevice detected with type: ${typeName} -> ${ideviceType}`,
                    );
                } else {
                    ideviceType = 'text';
                    this.logger.log(`[LegacyXmlParser] Generic Idevice without __name__, defaulting to 'text'`);
                }
            } else {
                ideviceType = this.mapIdeviceType(className);
            }

            let title = this.extractIdeviceTitle(inst);

            if (className.toLowerCase().includes('ejercicioresueltofpdidevice') && title === 'Translation') {
                title = this.getLocalizedCaseStudyTitle(this.projectLanguage);
                this.logger.log(
                    `[LegacyXmlParser] Fixed EjercicioresueltofpdIdevice title: "Translation" -> "${title}"`,
                );
            }

            if (className.toLowerCase().includes('casestudyidevice') && title === 'Case Study') {
                title = this.getLocalizedCaseStudyTitle(this.projectLanguage);
                this.logger.log(`[LegacyXmlParser] Fixed CasestudyIdevice title: "Case Study" -> "${title}"`);
            }

            const localizedTitle = this.getLocalizedIdeviceTitle(title, this.projectLanguage);
            if (localizedTitle && localizedTitle !== title) {
                this.logger.log(`[LegacyXmlParser] Translated iDevice title: "${title}" -> "${localizedTitle}"`);
                title = localizedTitle;
            }

            let iconName = '';
            if (dict) {
                const rawIcon = this.findDictStringValue(dict, 'icon');
                if (rawIcon) {
                    iconName = LegacyXmlParser.LEGACY_ICON_MAP[rawIcon] || rawIcon;
                    this.logger.log(`[LegacyXmlParser] iDevice icon: ${rawIcon} -> ${iconName}`);
                }
            }

            const idevice: LegacyIdevice = {
                id: `idevice-${ref}`,
                type: ideviceType,
                title: title,
                icon: iconName,
                position: idevices.length,
                htmlView: '',
                feedbackHtml: '',
                feedbackButton: '',
            };

            // Extract HTML content
            if (dict) {
                const fieldsResult = this.extractFieldsContentWithFeedback(dict);
                if (fieldsResult.content) {
                    idevice.htmlView = fieldsResult.content;
                }
                if (fieldsResult.feedbackHtml) {
                    idevice.feedbackHtml = fieldsResult.feedbackHtml;
                    idevice.feedbackButton = fieldsResult.feedbackButton;
                }

                if (!idevice.feedbackHtml) {
                    const answerFeedback = this.extractReflectionFeedback(dict);
                    if (answerFeedback.content) {
                        idevice.feedbackHtml = answerFeedback.content;
                        idevice.feedbackButton = answerFeedback.buttonCaption;
                    }
                }

                if (!idevice.htmlView) {
                    const contentFields = [
                        'content',
                        '_content',
                        '_html',
                        'htmlView',
                        'story',
                        '_story',
                        'text',
                        '_text',
                    ];
                    for (const field of contentFields) {
                        const content = this.extractRichTextContent(dict, field);
                        if (content) {
                            idevice.htmlView = content;
                            break;
                        }
                    }
                }

                if (!idevice.htmlView) {
                    idevice.htmlView = this.extractAnyTextFieldContent(dict);
                }

                if (!idevice.htmlView && className.includes('FreeTextIdevice')) {
                    const parentTextArea = this.findParentTextAreaField(inst);
                    if (parentTextArea) {
                        idevice.htmlView = this.extractTextFieldContent(parentTextArea);
                        if (idevice.htmlView) {
                            this.logger.log(`[LegacyXmlParser] FreeTextIdevice content from parent TextAreaField`);
                        }
                    }
                }

                // LEGACY IDEVICE PROPERTY EXTRACTION via Handler Registry
                // Use unified handler system for all legacy iDevice types
                // Pass rawIdeviceDir (e.g., 'selecciona-activity') to allow GameHandler to match legacy names
                const handler = LegacyHandlerRegistry.getHandler(className, rawIdeviceDir || ideviceType);
                const handlerContext: IdeviceHandlerContext = {
                    language: this.projectLanguage,
                    ideviceId: idevice.id,
                    className: className,
                    ideviceType: rawIdeviceDir || ideviceType,
                };

                // Extract properties using handler
                const handlerProps = handler.extractProperties(dict, idevice.id);
                if (handlerProps && Object.keys(handlerProps).length > 0) {
                    idevice.properties = handlerProps;
                    this.logger.log(
                        `[LegacyXmlParser] Extracted properties via ${handler.constructor.name} (${Object.keys(handlerProps).length} keys)`,
                    );
                }

                // Use handler's extractHtmlView if it returns content
                // Some handlers (like GameHandler) process the content (e.g., decrypt game data)
                const handlerHtml = handler.extractHtmlView(dict, handlerContext);
                if (handlerHtml) {
                    idevice.htmlView = handlerHtml;
                    this.logger.log(`[LegacyXmlParser] Used handler htmlView (${handlerHtml.length} chars)`);
                }

                // Use handler's extractFeedback for feedback content
                const handlerFeedback = handler.extractFeedback(dict, handlerContext);
                if (handlerFeedback.content) {
                    idevice.feedbackHtml = handlerFeedback.content;
                    idevice.feedbackButton = handlerFeedback.buttonCaption;
                    this.logger.log(`[LegacyXmlParser] Extracted feedback via handler`);
                }

                // Update type from handler if it provides a different type
                // This is important for GameHandler which normalizes game types
                // Call AFTER extractProperties since handler may detect type during extraction
                const handlerType = handler.getTargetType();
                if (handlerType && handlerType !== 'text' && handlerType !== idevice.type) {
                    this.logger.log(`[LegacyXmlParser] Handler updated type: ${idevice.type} -> ${handlerType}`);
                    idevice.type = handlerType;
                }

                // Get block properties from handler if available
                // This allows handlers like NotaHandler to set visibility=false on the block
                if (typeof handler.getBlockProperties === 'function') {
                    const blockProps = handler.getBlockProperties();
                    if (blockProps && Object.keys(blockProps).length > 0) {
                        idevice.blockProperties = blockProps;
                        this.logger.log(`[LegacyXmlParser] Handler block properties:`, blockProps);
                    }
                }
            }

            if (idevice.htmlView) {
                idevice.htmlView = stripLegacyExeTextWrapper(idevice.htmlView);
            }

            // Apply iDevice type detection based on content
            if (idevice.htmlView) {
                if (idevice.htmlView.includes('exe-rubric-strings')) {
                    idevice.type = 'rubric';
                    idevice.htmlView = this.normalizeLegacyRubricHtml(idevice.htmlView, title);
                    idevice.cssClass = 'rubric';
                    this.logger.log('[LegacyXmlParser] Detected rubric iDevice, transformed to modern format');
                }

                if (idevice.htmlView.includes('exe-udlContent')) {
                    idevice.type = 'udl-content';
                    this.logger.log('[LegacyXmlParser] Detected UDL content iDevice');
                }

                if (idevice.htmlView.includes('exe-sortableList')) {
                    idevice.type = 'scrambled-list';
                    this.logger.log('[LegacyXmlParser] Detected scrambled-list iDevice');
                }

                if (idevice.htmlView.includes('exe-download-package-instructions')) {
                    idevice.type = 'download-source-file';
                    idevice.htmlView = idevice.htmlView
                        .replace(/\.elp([^x])/gi, '.elpx$1')
                        .replace(/\.elp(['"])/gi, '.elpx$1')
                        .replace(/\.elp(<)/gi, '.elpx$1')
                        .replace(/\.elp$/gi, '.elpx');
                    this.logger.log('[LegacyXmlParser] Detected download-source-file iDevice, converted .elp to .elpx');
                }

                if (idevice.htmlView.includes('exe-interactive-video')) {
                    idevice.type = 'interactive-video';
                    this.logger.log('[LegacyXmlParser] Detected interactive-video iDevice');
                }

                if (idevice.htmlView.includes('auto-geogebra')) {
                    idevice.type = 'geogebra-activity';
                    this.logger.log('[LegacyXmlParser] Detected geogebra-activity iDevice');
                }

                if (idevice.htmlView.includes('pbl-task-description')) {
                    const pblTaskData = this.extractPblTaskMetadata(idevice.htmlView);
                    if (pblTaskData) {
                        if (pblTaskData.rebuiltHtmlView) {
                            idevice.htmlView = pblTaskData.rebuiltHtmlView;
                            delete pblTaskData.rebuiltHtmlView;
                        }
                        idevice.properties = { ...idevice.properties, ...pblTaskData };
                        this.logger.log('[LegacyXmlParser] Detected PBL Task iDevice, extracted metadata');
                    }
                }
            }

            idevices.push(idevice);
        }

        this.logger.log(`[LegacyXmlParser] Extracted ${idevices.length} iDevices with titles`);
        return idevices;
    }

    /**
     * Normalize legacy rubric HTML to the same serialized format generated by
     * the current rubric editor save flow.
     */
    private normalizeLegacyRubricHtml(htmlView: string, fallbackTitle: string): string {
        if (!htmlView) return '';

        const normalizedLegacyClasses = htmlView.replace(/exe-rubric([^s])/g, 'exe-rubrics$1');

        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(
            `<div>${normalizedLegacyClasses}</div>`,
            'text/html',
        ) as unknown as Document;
        const root = htmlDoc.documentElement;
        if (!root) return normalizedLegacyClasses;

        const table = this.getElementsByTagName(root, 'table').find(el => {
            const cls = el.getAttribute('class') || '';
            return (
                cls.includes('exe-table') ||
                cls.includes('exe-rubrics-export-table') ||
                !!el.getAttribute('data-rubric-table-type')
            );
        });

        if (!table) {
            return normalizedLegacyClasses;
        }

        const instructionsEl = this.getElementByClassName(root, 'div', 'exe-rubrics-instructions');
        const textAfterEl = this.getElementByClassName(root, 'div', 'exe-rubrics-text-after');
        const authorshipEl = this.getElementByClassName(root, 'p', 'exe-rubrics-authorship');
        const stringsEl = this.getElementByClassName(root, 'ul', 'exe-rubrics-strings');

        const instructionsHtml = this.getInnerHtml(instructionsEl);
        const textAfterHtml = this.getInnerHtml(textAfterEl);
        const authorshipHtml = this.getOuterHtml(authorshipEl);

        const stringsMap = this.extractRubricStrings(stringsEl);
        const rubricData = this.extractRubricDataFromLegacyTable(table, fallbackTitle, stringsMap);

        if (!rubricData) {
            return normalizedLegacyClasses;
        }

        const stringsHtml = this.buildRubricStringsHtml(stringsMap);
        const dataPayload = this.encodeEscapedHtml(JSON.stringify(rubricData));
        const richTextDataHtml =
            '<div class="exe-rubrics-richtext-data sr-av">' +
            '<span class="exe-rubrics-instructions-data">' +
            this.encodeEscapedHtml(instructionsHtml) +
            '</span>' +
            '<span class="exe-rubrics-text-after-data">' +
            this.encodeEscapedHtml(textAfterHtml) +
            '</span>' +
            '</div>';

        const exportInterfaceHtml = this.buildRubricExportInterfaceHtml(rubricData, stringsMap);

        const serialized =
            (instructionsHtml.trim() !== ''
                ? '<div class="exe-rubrics-instructions">' + instructionsHtml + '</div>'
                : '') +
            '<div class="rubric">' +
            '<div class="exe-rubrics-DataGame js-hidden">' +
            dataPayload +
            '</div>' +
            (authorshipHtml || '') +
            stringsHtml +
            exportInterfaceHtml +
            '</div>' +
            (textAfterHtml.trim() !== '' ? '<div class="exe-rubrics-text-after">' + textAfterHtml + '</div>' : '') +
            richTextDataHtml;

        return serialized;
    }

    private extractRubricStrings(stringsEl: Element | null): Record<string, string> {
        const stringsMap: Record<string, string> = {};
        if (!stringsEl) return stringsMap;

        const items = this.getElementsByTagName(stringsEl, 'li');
        for (const item of items) {
            const key = (item.getAttribute('class') || '').trim();
            const value = (item.textContent || '').trim();
            if (!key || !value) continue;
            stringsMap[key] = value;
        }

        return stringsMap;
    }

    private buildRubricStringsHtml(stringsMap: Record<string, string>): string {
        let html = '<ul class="exe-rubrics-strings">';
        for (const key of Object.keys(stringsMap)) {
            html += `<li class="${key}">${stringsMap[key]}</li>`;
        }
        html += '</ul>';
        return html;
    }

    private extractRubricDataFromLegacyTable(
        table: Element,
        _fallbackTitle: string,
        stringsMap: Record<string, string>,
    ): Record<string, unknown> | null {
        const caption = this.getElementsByTagName(table, 'caption')[0];
        let title = (caption?.textContent || '').trim();
        if (!title) {
            title = 'Imported rubric';
        }

        const scores: string[] = [];
        const categories: string[] = [];
        const descriptions: Array<Array<{ text: string; weight: string }>> = [];

        const thead = this.getElementsByTagName(table, 'thead')[0];
        const headerRows = thead ? this.getElementsByTagName(thead, 'tr') : [];
        const firstHeaderRow = headerRows[0] || null;
        if (firstHeaderRow) {
            const headerCells = Array.from(firstHeaderRow.childNodes).filter(n => n.nodeType === 1) as Element[];
            for (let i = 1; i < headerCells.length; i++) {
                scores.push((headerCells[i].textContent || '').trim());
            }
        }

        let bodyRows: Element[] = [];
        const tbody = this.getElementsByTagName(table, 'tbody')[0];
        if (tbody) {
            bodyRows = this.getElementsByTagName(tbody, 'tr');
        }
        if (bodyRows.length === 0) {
            const allRows = this.getElementsByTagName(table, 'tr');
            bodyRows = firstHeaderRow ? allRows.filter(row => row !== firstHeaderRow) : allRows;
        }

        for (const row of bodyRows) {
            const cells = Array.from(row.childNodes).filter(n => n.nodeType === 1) as Element[];
            if (cells.length < 2) continue;

            categories.push((cells[0].textContent || '').trim());

            const rowData: Array<{ text: string; weight: string }> = [];
            for (let i = 1; i < cells.length; i++) {
                const clonedCell = cells[i].cloneNode(true) as Element;

                const inputs = this.getElementsByTagName(clonedCell, 'input');
                for (const input of inputs) {
                    input.parentNode?.removeChild(input);
                }

                let weight = '';
                const spans = this.getElementsByTagName(clonedCell, 'span');
                if (spans.length > 0) {
                    const spanText = (spans[0].textContent || '').trim();
                    const match = spanText.match(/^\(([^)]+)\)$/);
                    if (match?.[1]) {
                        weight = match[1].trim();
                    }
                    spans[0].parentNode?.removeChild(spans[0]);
                }

                rowData.push({
                    text: this.getInnerHtml(clonedCell).trim(),
                    weight,
                });
            }

            descriptions.push(rowData);
        }

        if (categories.length === 0 || descriptions.length === 0) {
            return null;
        }

        if (scores.length === 0) {
            let maxCols = 0;
            for (const row of descriptions) {
                maxCols = Math.max(maxCols, row.length);
            }
            for (let i = 0; i < maxCols; i++) scores.push('');
        }

        const rubricData: Record<string, unknown> = {
            title,
            categories,
            scores,
            descriptions,
        };

        if (Object.keys(stringsMap).length > 0) {
            rubricData.i18n = stringsMap;
        }

        return rubricData;
    }

    private buildRubricExportInterfaceHtml(
        rubricData: Record<string, unknown>,
        stringsMap: Record<string, string>,
    ): string {
        const strings = {
            activity: stringsMap.activity || 'Activity',
            name: stringsMap.name || 'Name',
            score: stringsMap.score || 'Score',
            date: stringsMap.date || 'Date',
            notes: stringsMap.notes || 'Notes',
            download: stringsMap.download || 'Download',
            reset: stringsMap.reset || 'Reset',
        };

        const tableHtml = this.buildRubricExportTableHtml(rubricData);
        if (tableHtml === '') return '';

        const currentDate = new Date().toLocaleDateString();

        return (
            '<div class="exe-rubrics-wrapper">' +
            '<div class="exe-rubrics-content">' +
            '<div id="exe-rubrics-header">' +
            '<div>' +
            '<label for="activity">' +
            this.escapeHtml(strings.activity) +
            ':</label>' +
            '<input type="text" id="activity" data-rubric-field="activity" class="form-control form-control-sm">' +
            '</div>' +
            '<div>' +
            '<label for="name">' +
            this.escapeHtml(strings.name) +
            ':</label>' +
            '<input type="text" id="name" data-rubric-field="name" class="form-control form-control-sm">' +
            '</div>' +
            '<div>' +
            '<label for="score">' +
            this.escapeHtml(strings.score) +
            ':</label>' +
            '<input type="text" id="score" data-rubric-field="score" class="form-control form-control-sm">' +
            '</div>' +
            '<div>' +
            '<label for="date">' +
            this.escapeHtml(strings.date) +
            ':</label>' +
            '<input type="text" id="date" data-rubric-field="date" class="form-control form-control-sm" value="' +
            this.escapeHtmlAttr(currentDate) +
            '">' +
            '</div>' +
            '</div>' +
            '<div class="exe-rubrics-table-slot">' +
            tableHtml +
            '</div>' +
            '<div id="exe-rubrics-footer">' +
            '<p>' +
            '<label for="notes">' +
            this.escapeHtml(strings.notes) +
            ':</label>' +
            '<textarea id="notes" data-rubric-field="notes" class="form-control form-control-sm" cols="32" rows="1"></textarea>' +
            '</p>' +
            '</div>' +
            '<p class="exe-rubrics-actions">' +
            '<button type="button" class="exe-rubrics-download btn btn-primary btn-sm">' +
            this.escapeHtml(strings.download) +
            '</button>' +
            '<button type="button" class="exe-rubrics-reset btn btn-primary btn-sm">' +
            this.escapeHtml(strings.reset) +
            '</button>' +
            '</p>' +
            '</div>' +
            '</div>'
        );
    }

    private buildRubricExportTableHtml(rubricData: Record<string, unknown>): string {
        const title = typeof rubricData.title === 'string' ? rubricData.title : '';
        const categories = Array.isArray(rubricData.categories) ? rubricData.categories : [];
        const scores = Array.isArray(rubricData.scores) ? rubricData.scores : [];
        const descriptions = Array.isArray(rubricData.descriptions) ? rubricData.descriptions : [];

        if (categories.length === 0 || descriptions.length === 0) return '';

        let html = '<table class="exe-table exe-rubrics-export-table" data-rubric-table-type="export">';
        html += '<caption>' + this.escapeHtml(title) + '</caption>';
        html += '<thead><tr><th>&nbsp;</th>';

        for (let i = 0; i < scores.length; i++) {
            html += '<th>' + this.escapeHtml(String(scores[i] || '')) + '</th>';
        }

        html += '</tr></thead><tbody>';

        for (let r = 0; r < categories.length; r++) {
            html += '<tr>';
            html += '<th>' + this.escapeHtml(String(categories[r] || '')) + '</th>';

            const row = Array.isArray(descriptions[r]) ? (descriptions[r] as Array<Record<string, unknown>>) : [];
            for (let c = 0; c < scores.length; c++) {
                const cell = row[c] || {};
                const cellText = typeof cell.text === 'string' ? cell.text : '';
                const cellWeight = typeof cell.weight === 'string' ? cell.weight : '';
                html += '<td>' + cellText;
                if (cellWeight !== '') {
                    html += ' <span>(' + this.escapeHtml(cellWeight) + ')</span>';
                }
                html += '</td>';
            }

            html += '</tr>';
        }

        html += '</tbody></table>';
        return html;
    }

    private getOuterHtml(element: Element | null): string {
        if (!element) return '';
        const tagName = element.tagName.toLowerCase();
        const attrs: string[] = [];
        if (element.attributes) {
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                attrs.push(`${attr.name}="${attr.value}"`);
            }
        }
        const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
        return `<${tagName}${attrStr}>${this.getInnerHtml(element)}</${tagName}>`;
    }

    private encodeEscapedHtml(text: string): string {
        if (!text) return '';
        try {
            return escape(text);
        } catch (_e) {
            return text;
        }
    }

    /**
     * Find a string value in dictionary by key
     */
    private findDictStringValue(dict: Element, key: string): string | null {
        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === key
            ) {
                const valueEl = children[i + 1];
                if (valueEl && (valueEl.tagName === 'string' || valueEl.tagName === 'unicode')) {
                    return valueEl.getAttribute('value') || valueEl.textContent || null;
                }
            }
        }
        return null;
    }

    /**
     * Find a list element in dictionary by key
     */
    private findDictList(dict: Element, key: string): Element | null {
        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === key
            ) {
                const valueEl = children[i + 1];
                if (valueEl && valueEl.tagName === 'list') {
                    return valueEl;
                }
            }
        }
        return null;
    }

    /**
     * Extract PBL Task metadata from HTML content
     */
    private extractPblTaskMetadata(htmlView: string): Record<string, unknown> | null {
        if (!htmlView) return null;

        try {
            // Parse HTML using @xmldom/xmldom (environment agnostic)
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(`<div>${htmlView}</div>`, 'text/html') as unknown as Document;
            const tempDiv = htmlDoc.documentElement;

            // Extract elements using getElementsByClassName-like approach
            const durationLabel = this.getElementByClassName(tempDiv, 'dt', 'pbl-task-duration');
            const durationValue = this.getElementByClassName(tempDiv, 'dd', 'pbl-task-duration');
            const participantsLabel = this.getElementByClassName(tempDiv, 'dt', 'pbl-task-participants');
            const participantsValue = this.getElementByClassName(tempDiv, 'dd', 'pbl-task-participants');
            const feedbackDiv = this.getElementByClassName(tempDiv, 'div', 'feedback');
            const feedbackButton = this.getElementByClassName(tempDiv, 'input', 'feedbackbutton');
            const taskDescriptionDiv = this.getElementByClassName(tempDiv, 'div', 'pbl-task-description');

            const taskDurationInput = durationLabel?.textContent?.trim() || '';
            const taskDuration = durationValue?.textContent?.trim() || '';
            const taskParticipantsInput = participantsLabel?.textContent?.trim() || '';
            const taskParticipants = participantsValue?.textContent?.trim() || '';
            const textButtonFeedback =
                feedbackButton?.getAttribute('value') || feedbackButton?.textContent?.trim() || '';
            const textFeedback = this.getInnerHtml(feedbackDiv) || '';
            const taskContent = this.getInnerHtml(taskDescriptionDiv) || '';

            const metadata: Record<string, unknown> = {
                textInfoDurationTextInput: taskDurationInput,
                textInfoDurationInput: taskDuration,
                textInfoParticipantsTextInput: taskParticipantsInput,
                textInfoParticipantsInput: taskParticipants,
                textFeedbackInput: textButtonFeedback,
                textFeedbackTextarea: textFeedback,
            };

            // Rebuild htmlView
            let rebuiltHtmlView = '';

            if (taskDuration || taskParticipants) {
                rebuiltHtmlView += '<dl>';
                rebuiltHtmlView += `<div class="inline"><dt><span title="${this.escapeHtmlAttr(taskDurationInput)}">${this.escapeHtml(taskDurationInput)}</span></dt>`;
                rebuiltHtmlView += `<dd>${this.escapeHtml(taskDuration)}</dd></div>`;
                rebuiltHtmlView += `<div class="inline"><dt><span title="${this.escapeHtmlAttr(taskParticipantsInput)}">${this.escapeHtml(taskParticipantsInput)}</span></dt>`;
                rebuiltHtmlView += `<dd>${this.escapeHtml(taskParticipants)}</dd></div>`;
                rebuiltHtmlView += '</dl>';
            }

            rebuiltHtmlView += taskContent;

            if (textButtonFeedback) {
                rebuiltHtmlView += '<div class="iDevice_buttons feedback-button js-required">';
                rebuiltHtmlView += `<input type="button" class="feedbacktooglebutton" value="${this.escapeHtmlAttr(textButtonFeedback)}" `;
                rebuiltHtmlView += `data-text-a="${this.escapeHtmlAttr(textButtonFeedback)}" data-text-b="${this.escapeHtmlAttr(textButtonFeedback)}">`;
                rebuiltHtmlView += '</div>';
                rebuiltHtmlView += `<div class="feedback js-feedback js-hidden" style="display: none;">${textFeedback}</div>`;
            }

            rebuiltHtmlView = `<div class="exe-text-activity">${rebuiltHtmlView}</div>`;

            metadata.rebuiltHtmlView = rebuiltHtmlView;

            return metadata;
        } catch (e) {
            this.logger.log(`[LegacyXmlParser] Error extracting PBL Task metadata: ${(e as Error).message}`);
            return null;
        }
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(str: string): string {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Escape HTML special characters for attributes
     */
    private escapeHtmlAttr(str: string): string {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Extract content and feedback from "fields" list
     */
    private extractFieldsContentWithFeedback(dict: Element): {
        content: string;
        feedbackHtml: string;
        feedbackButton: string;
    } {
        const contents: string[] = [];
        let feedbackHtml = '';
        let feedbackButton = '';
        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === 'fields'
            ) {
                const listEl = children[i + 1];
                if (listEl && listEl.tagName === 'list') {
                    const directChildren = Array.from(listEl.childNodes).filter(n => n.nodeType === 1) as Element[];
                    const fieldInstances: Element[] = [];

                    for (const fieldChild of directChildren) {
                        if (fieldChild.tagName === 'instance') {
                            fieldInstances.push(fieldChild);
                        } else if (fieldChild.tagName === 'reference') {
                            const refKey = fieldChild.getAttribute('key');
                            if (refKey && this.xmlDoc) {
                                const referencedInstance = this.getElementsByAttribute(
                                    this.xmlDoc,
                                    'instance',
                                    'reference',
                                    refKey,
                                )[0];
                                if (referencedInstance) {
                                    this.logger.log(`[LegacyXmlParser] Resolved field reference key=${refKey}`);
                                    fieldInstances.push(referencedInstance);
                                }
                            }
                        }
                    }

                    for (const fieldInst of fieldInstances) {
                        const fieldClass = fieldInst.getAttribute('class') || '';
                        if (fieldClass.includes('TextAreaField') || fieldClass.includes('TextField')) {
                            const content = this.extractTextAreaFieldContent(fieldInst);
                            if (content) {
                                contents.push(content);
                            }
                        }
                        if (fieldClass.includes('FeedbackField')) {
                            const feedback = this.extractFeedbackFieldContent(fieldInst);
                            if (feedback.content) {
                                feedbackHtml = feedback.content;
                                feedbackButton = feedback.buttonCaption;
                            }
                        }
                    }
                }
                break;
            }
        }

        return {
            content: contents.join('\n'),
            feedbackHtml,
            feedbackButton,
        };
    }

    /**
     * Extract content from a FeedbackField instance
     */
    private extractFeedbackFieldContent(fieldInst: Element): { content: string; buttonCaption: string } {
        const dict = this.getDirectChildByTagName(fieldInst, 'dictionary');
        if (!dict) return { content: '', buttonCaption: '' };

        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];
        let content = '';
        let buttonCaption = '';

        const contentKeys = ['feedback', 'content_w_resourcePaths', '_content', 'content'];
        for (const targetKey of contentKeys) {
            if (content) break;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (
                    child.tagName === 'string' &&
                    child.getAttribute('role') === 'key' &&
                    child.getAttribute('value') === targetKey
                ) {
                    const valueEl = children[i + 1];
                    if (valueEl && valueEl.tagName === 'unicode') {
                        const value = valueEl.getAttribute('value') || valueEl.textContent || '';
                        if (value.trim()) {
                            content = this.decodeHtmlContent(value);
                            break;
                        }
                    }
                }
            }
        }

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === '_buttonCaption'
            ) {
                const valueEl = children[i + 1];
                if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
                    buttonCaption = valueEl.getAttribute('value') || valueEl.textContent || '';
                    break;
                }
            }
        }

        const defaultCaption = this.getLocalizedFeedbackText(this.projectLanguage);
        return {
            content,
            buttonCaption: buttonCaption || defaultCaption,
        };
    }

    /**
     * Extract content from a TextAreaField instance
     */
    private extractTextAreaFieldContent(fieldInst: Element): string {
        const dict = this.getDirectChildByTagName(fieldInst, 'dictionary');
        if (!dict) return '';

        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];
        const contentKeys = ['content_w_resourcePaths', '_content', 'content'];

        for (const targetKey of contentKeys) {
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (
                    child.tagName === 'string' &&
                    child.getAttribute('role') === 'key' &&
                    child.getAttribute('value') === targetKey
                ) {
                    const valueEl = children[i + 1];
                    if (valueEl && valueEl.tagName === 'unicode') {
                        const value = valueEl.getAttribute('value') || valueEl.textContent || '';
                        if (value.trim()) {
                            return this.decodeHtmlContent(value);
                        }
                    }
                }
            }
        }

        return '';
    }

    /**
     * Extract rich text content from a dictionary field
     */
    private extractRichTextContent(dict: Element, fieldName: string): string {
        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === fieldName
            ) {
                const valueEl = children[i + 1];
                if (!valueEl) return '';

                if (valueEl.tagName === 'unicode' || valueEl.tagName === 'string') {
                    return this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
                }

                if (valueEl.tagName === 'instance') {
                    return this.extractTextFieldContent(valueEl);
                }

                if (valueEl.tagName === 'reference') {
                    const refKey = valueEl.getAttribute('key');
                    if (refKey && this.xmlDoc) {
                        const referencedInstance = this.getElementsByAttribute(
                            this.xmlDoc,
                            'instance',
                            'reference',
                            refKey,
                        )[0];
                        if (referencedInstance) {
                            const refClass = referencedInstance.getAttribute('class') || '';
                            if (refClass.includes('TextAreaField') || refClass.includes('TextField')) {
                                this.logger.log(`[LegacyXmlParser] Resolved content reference key=${refKey}`);
                                return this.extractTextFieldContent(referencedInstance);
                            }
                        }
                    }
                }
            }
        }

        return '';
    }

    /**
     * Extract content from a TextField instance
     */
    private extractTextFieldContent(fieldInst: Element): string {
        const dict = this.getDirectChildByTagName(fieldInst, 'dictionary');
        if (!dict) return '';

        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];

        // First pass: look for content_w_resourcePaths
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === 'content_w_resourcePaths'
            ) {
                const valueEl = children[i + 1];
                if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
                    const content = this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
                    if (content) return content;
                }
            }
        }

        // Second pass: fallback to _content or content
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.tagName === 'string' && child.getAttribute('role') === 'key') {
                const keyValue = child.getAttribute('value');
                if (keyValue === '_content' || keyValue === 'content') {
                    const valueEl = children[i + 1];
                    if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
                        const content = this.decodeHtmlContent(
                            valueEl.getAttribute('value') || valueEl.textContent || '',
                        );
                        if (content) return content;
                    }
                }
            }
        }

        return '';
    }

    /**
     * Try to extract content from any TextField-like instance
     */
    private extractAnyTextFieldContent(dict: Element): string {
        const instances = this.getElementsByTagName(dict, 'instance');

        for (const inst of instances) {
            if (inst.parentNode !== dict) continue;

            const className = inst.getAttribute('class') || '';
            if (className.toLowerCase().includes('field') || className.toLowerCase().includes('text')) {
                const content = this.extractTextFieldContent(inst);
                if (content) return content;
            }
        }

        return '';
    }

    /**
     * Extract feedback from ReflectionIdevice-style structure
     */
    private extractReflectionFeedback(dict: Element): { content: string; buttonCaption: string } {
        const children = Array.from(dict.childNodes).filter(n => n.nodeType === 1) as Element[];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === 'answerTextArea'
            ) {
                const valueEl = children[i + 1];
                if (valueEl && valueEl.tagName === 'instance') {
                    const fieldDict = this.getDirectChildByTagName(valueEl, 'dictionary');
                    if (fieldDict) {
                        const buttonCaption = this.findDictStringValue(fieldDict, 'buttonCaption') || '';
                        const content = this.extractTextAreaFieldContent(valueEl);

                        if (content) {
                            const defaultCaption = this.getLocalizedFeedbackText(this.projectLanguage);
                            return {
                                content,
                                buttonCaption: buttonCaption || defaultCaption,
                            };
                        }
                    }
                }
            }
        }

        return { content: '', buttonCaption: '' };
    }

    /**
     * Decode HTML-encoded content (environment agnostic)
     */
    private decodeHtmlContent(text: string): string {
        if (!text) return '';

        return text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    }

    /**
     * Find the parent TextAreaField that contains this iDevice instance
     */
    private findParentTextAreaField(ideviceInst: Element): Element | null {
        if (!ideviceInst) return null;

        const parentDict = ideviceInst.parentNode as Element | null;
        if (parentDict && parentDict.tagName === 'dictionary') {
            const parentInst = parentDict.parentNode as Element | null;
            if (parentInst && parentInst.tagName === 'instance') {
                const parentClass = parentInst.getAttribute('class') || '';
                if (parentClass.includes('TextAreaField')) {
                    return parentInst;
                }
            }
        }
        return null;
    }

    /**
     * Check if class is a generic Idevice class
     */
    private isGenericIdeviceClass(className: string): boolean {
        return className.endsWith('.Idevice') && !className.startsWith('exe.engine.');
    }

    /**
     * Map generic iDevice type names to modern types
     */
    private mapGenericIdeviceType(typeName: string): string {
        const typeMap: Record<string, string> = {};
        return typeMap[typeName.toLowerCase()] || 'text';
    }

    // =========================================================================
    // DOM Query Helpers (compatible with @xmldom/xmldom)
    // Note: @xmldom/xmldom doesn't support querySelector/querySelectorAll
    // =========================================================================

    /**
     * Get elements by tag name
     */
    private getElementsByTagName(parent: Document | Element, tagName: string): Element[] {
        const elements = parent.getElementsByTagName(tagName);
        return Array.from(elements) as Element[];
    }

    /**
     * Get elements by attribute value
     */
    private getElementsByAttribute(
        parent: Document | Element,
        tagName: string,
        attrName: string,
        attrValue: string,
    ): Element[] {
        const elements = this.getElementsByTagName(parent, tagName);
        return elements.filter(el => el.getAttribute(attrName) === attrValue);
    }

    /**
     * Get direct child element by tag name
     */
    private getDirectChildByTagName(parent: Element, tagName: string): Element | null {
        const children = Array.from(parent.childNodes).filter(n => n.nodeType === 1) as Element[];
        return children.find(el => el.tagName === tagName) || null;
    }

    /**
     * Get element by class name (simple implementation)
     */
    private getElementByClassName(parent: Element, tagName: string, className: string): Element | null {
        const elements = this.getElementsByTagName(parent, tagName);
        return elements.find(el => (el.getAttribute('class') || '').split(/\s+/).includes(className)) || null;
    }

    /**
     * Get inner HTML of an element (environment agnostic)
     */
    private getInnerHtml(element: Element | null): string {
        if (!element) return '';

        const children = Array.from(element.childNodes);
        return children
            .map(node => {
                if (node.nodeType === 3) {
                    // Text node
                    return node.textContent || '';
                } else if (node.nodeType === 1) {
                    // Element node
                    const el = node as Element;
                    const tagName = el.tagName.toLowerCase();
                    const attrs: string[] = [];

                    if (el.attributes) {
                        for (let i = 0; i < el.attributes.length; i++) {
                            const attr = el.attributes[i];
                            attrs.push(`${attr.name}="${attr.value}"`);
                        }
                    }

                    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
                    const innerHtml = this.getInnerHtml(el);

                    if (['br', 'hr', 'img', 'input'].includes(tagName)) {
                        return `<${tagName}${attrStr} />`;
                    }

                    return `<${tagName}${attrStr}>${innerHtml}</${tagName}>`;
                }
                return '';
            })
            .join('');
    }
}
