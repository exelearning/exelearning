import { ParsedOdeStructure } from '../../xml/interfaces/ode-xml.interface';

/**
 * Result of opening an ELP file
 */
export interface OpenElpResult {
    odeSessionId: string;
    structure: ParsedOdeStructure;
    sessionPath: string;
    contentPath: string;
}

/**
 * Project session information
 */
export interface ProjectSession {
    odeSessionId: string;
    created: Date;
    modified: Date;
    structure: ParsedOdeStructure;
    sessionPath: string;
    contentPath: string;
}

/**
 * Options for opening ELP files
 */
export interface OpenElpOptions {
    overwrite?: boolean;
    preserveStructure?: boolean;
    validateXml?: boolean;
    username?: string; // Username opening the project
    forceCloseSession?: boolean; // Force close existing session
    odeId?: string; // ODE ID (from XML or generated)
    odeVersionId?: string; // ODE Version ID (from XML or generated)
    skipDbPersistence?: boolean; // Skip DB persistence (Yjs is source of truth)
}

/**
 * Options for saving projects
 */
export interface SaveProjectOptions {
    compressionLevel?: number;
    includeBackup?: boolean;
}
