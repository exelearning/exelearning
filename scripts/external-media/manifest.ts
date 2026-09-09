/**
 * Manifest for the distributable external-media artifacts.
 *
 * Host plugins stop copying our SOURCE and start copying built artifacts plus this
 * manifest, so "is the copy current and intact?" becomes a hash comparison instead of
 * a diff against five hand-maintained mirrors.
 */
import { createHash } from 'node:crypto';

/** Bumped when the artifact set or its public API changes. */
export const LIBRARY_VERSION = '1.0.0';

/**
 * The wire protocol the child and host speak. A client whose adapter was written
 * against a different major cannot safely load these artifacts.
 * Kept in step with `exe_media_policy.js`'s `VERSION`; the contract build asserts it.
 */
export const PROTOCOL_VERSION = 1;

export interface ArtifactInput {
    /** Filename as published in the dist directory. */
    path: string;
    contents: string;
}

export interface ArtifactRecord {
    path: string;
    sha256: string;
    bytes: number;
}

export interface Manifest {
    libraryVersion: string;
    protocolVersion: number;
    buildHash: string;
    sourceCommit: string;
    files: Record<string, ArtifactRecord>;
}

export function sha256(contents: string): string {
    return createHash('sha256').update(contents, 'utf8').digest('hex');
}

/**
 * Build the manifest for a set of artifacts.
 *
 * `buildHash` covers the artifact BYTES only — deliberately not the source commit.
 * Two builds of identical output from different commits are the same build, and
 * folding the commit in would make the reproducibility check impossible to pass.
 */
export function buildManifest({
    artifacts,
    sourceCommit,
}: {
    artifacts: Record<string, ArtifactInput>;
    sourceCommit: string;
}): Manifest {
    const files: Record<string, ArtifactRecord> = {};
    // Sorted so the manifest — and the build hash below — do not depend on the
    // order the caller happened to supply the artifacts in.
    for (const key of Object.keys(artifacts).sort()) {
        const artifact = artifacts[key];
        files[key] = {
            path: artifact.path,
            sha256: sha256(artifact.contents),
            bytes: Buffer.byteLength(artifact.contents, 'utf8'),
        };
    }

    const buildHash = sha256(
        Object.keys(files)
            .map(key => `${key}:${files[key].sha256}`)
            .join('\n'),
    );

    return { libraryVersion: LIBRARY_VERSION, protocolVersion: PROTOCOL_VERSION, buildHash, sourceCommit, files };
}
