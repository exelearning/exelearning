/**
 * TypeBox Schemas for REST API v1
 *
 * Used for request validation and Swagger documentation.
 */
import { t } from 'elysia';
import { verifyToken } from '../../auth';

// ============================================================================
// AUTH TYPES AND HELPERS
// ============================================================================

/**
 * Authenticated user info extracted from JWT
 */
export interface AuthenticatedUser {
    userId: number;
    email: string;
    roles: string[];
    isGuest: boolean;
}

/**
 * Auth result - either success with user or error with response
 */
export type AuthResult =
    | { success: true; user: AuthenticatedUser }
    | { success: false; status: number; response: ApiErrorResponse };

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

/**
 * Create error response object
 */
export function errorResponse(code: string, message: string, details?: unknown): ApiErrorResponse {
    return {
        success: false as const,
        error: { code, message, details },
    };
}

/**
 * Create success response object
 */
export function successResponse<T>(data: T): { success: true; data: T } {
    return {
        success: true as const,
        data,
    };
}

/**
 * Extract and verify JWT from Authorization header.
 * IMPORTANT: API v1 is for external integrations only. Guest users are NOT allowed.
 *
 * Returns the authenticated user if valid, or error response if:
 * - No Authorization header
 * - Invalid JWT token
 * - User is a guest (isGuest: true)
 */
export async function authenticateRequest(headers: Record<string, string | undefined>): Promise<AuthResult> {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return {
            success: false,
            status: 401,
            response: errorResponse('UNAUTHORIZED', 'Valid JWT token required'),
        };
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
        return {
            success: false,
            status: 401,
            response: errorResponse('UNAUTHORIZED', 'Invalid or expired JWT token'),
        };
    }

    // API v1 is for registered users only, NOT guests
    if (payload.isGuest === true) {
        return {
            success: false,
            status: 403,
            response: errorResponse(
                'FORBIDDEN',
                'API v1 is not available for guest users. Please login with a registered account.',
            ),
        };
    }

    return {
        success: true,
        user: {
            userId: payload.sub,
            email: payload.email,
            roles: payload.roles || [],
            isGuest: false,
        },
    };
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.includes('ROLE_ADMIN');
}

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const ErrorResponse = t.Object({
    success: t.Literal(false),
    error: t.Object({
        code: t.String(),
        message: t.String(),
        details: t.Optional(t.Unknown()),
    }),
});

export const SuccessResponse = <T extends ReturnType<typeof t.Object>>(data: T) =>
    t.Object({
        success: t.Literal(true),
        data,
    });

// ============================================================================
// PAGE SCHEMAS
// ============================================================================

export const PageData = t.Object({
    id: t.String(),
    pageId: t.String(),
    pageName: t.String(),
    parentId: t.Union([t.String(), t.Null()]),
    order: t.Number(),
    blockCount: t.Number(),
    createdAt: t.String(),
    updatedAt: t.Optional(t.String()),
    properties: t.Optional(t.Record(t.String(), t.Unknown())),
});

export const CreatePageBody = t.Object({
    name: t.String({ minLength: 1 }),
    parentId: t.Optional(t.Union([t.String(), t.Null()])),
    order: t.Optional(t.Number()),
});

export const UpdatePageBody = t.Object({
    name: t.Optional(t.String()),
    properties: t.Optional(t.Record(t.String(), t.Unknown())),
});

export const MovePageBody = t.Object({
    newParentId: t.Union([t.String(), t.Null()]),
    position: t.Optional(t.Number()),
});

// ============================================================================
// BLOCK SCHEMAS
// ============================================================================

export const BlockData = t.Object({
    id: t.String(),
    blockId: t.String(),
    blockName: t.String(),
    iconName: t.String(),
    blockType: t.String(),
    order: t.Number(),
    componentCount: t.Number(),
    createdAt: t.String(),
    updatedAt: t.Optional(t.String()),
    properties: t.Optional(t.Record(t.String(), t.Unknown())),
});

export const CreateBlockBody = t.Object({
    name: t.Optional(t.String()),
    order: t.Optional(t.Number()),
});

export const UpdateBlockBody = t.Object({
    name: t.Optional(t.String()),
    iconName: t.Optional(t.String()),
    properties: t.Optional(t.Record(t.String(), t.Unknown())),
});

export const MoveBlockBody = t.Object({
    targetPageId: t.String(),
    position: t.Optional(t.Number()),
});

// ============================================================================
// COMPONENT (IDEVICE) SCHEMAS
// ============================================================================

export const ComponentData = t.Object({
    id: t.String(),
    ideviceId: t.String(),
    ideviceType: t.String(),
    order: t.Number(),
    createdAt: t.String(),
    updatedAt: t.Optional(t.String()),
    htmlContent: t.Optional(t.String()),
    htmlView: t.Optional(t.String()),
    properties: t.Optional(t.Record(t.String(), t.Unknown())),
    jsonProperties: t.Optional(t.Union([t.String(), t.Record(t.String(), t.Unknown())])),
    title: t.Optional(t.String()),
    subtitle: t.Optional(t.String()),
    instructions: t.Optional(t.String()),
    feedback: t.Optional(t.String()),
    lockedBy: t.Optional(t.String()),
    lockUserName: t.Optional(t.String()),
    lockUserColor: t.Optional(t.String()),
});

export const CreateComponentBody = t.Object({
    ideviceType: t.String({ minLength: 1 }),
    initialData: t.Optional(t.Record(t.String(), t.Unknown())),
    order: t.Optional(t.Number()),
});

export const UpdateComponentBody = t.Object({
    htmlContent: t.Optional(t.String()),
    htmlView: t.Optional(t.String()),
    properties: t.Optional(t.Record(t.String(), t.Unknown())),
    jsonProperties: t.Optional(t.Union([t.String(), t.Record(t.String(), t.Unknown())])),
    title: t.Optional(t.String()),
    subtitle: t.Optional(t.String()),
    instructions: t.Optional(t.String()),
    feedback: t.Optional(t.String()),
});

export const SetHtmlBody = t.Object({
    html: t.String(),
});

export const MoveComponentBody = t.Object({
    targetBlockId: t.String(),
    position: t.Optional(t.Number()),
});

// ============================================================================
// METADATA SCHEMAS
// ============================================================================

export const MetadataData = t.Object({
    title: t.Optional(t.String()),
    subtitle: t.Optional(t.String()),
    author: t.Optional(t.String()),
    description: t.Optional(t.String()),
    language: t.Optional(t.String()),
    license: t.Optional(t.String()),
    footer: t.Optional(t.String()),
    addExeLink: t.Optional(t.Boolean()),
    addPagination: t.Optional(t.Boolean()),
    addSearchBox: t.Optional(t.Boolean()),
    addAccessibilityToolbar: t.Optional(t.Boolean()),
    extraHeadContent: t.Optional(t.String()),
    exportSource: t.Optional(t.String()),
    exelearning_version: t.Optional(t.String()),
});

export const UpdateMetadataBody = t.Object({
    title: t.Optional(t.String()),
    subtitle: t.Optional(t.String()),
    author: t.Optional(t.String()),
    description: t.Optional(t.String()),
    language: t.Optional(t.String()),
    license: t.Optional(t.String()),
    footer: t.Optional(t.String()),
    addExeLink: t.Optional(t.Boolean()),
    addPagination: t.Optional(t.Boolean()),
    addSearchBox: t.Optional(t.Boolean()),
    addAccessibilityToolbar: t.Optional(t.Boolean()),
    extraHeadContent: t.Optional(t.String()),
});

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const ProjectData = t.Object({
    id: t.Number(),
    uuid: t.String(),
    title: t.Union([t.String(), t.Null()]),
    owner_id: t.Union([t.Number(), t.Null()]),
    created_at: t.Union([t.Number(), t.Null()]),
    updated_at: t.Union([t.Number(), t.Null()]),
    saved_once: t.Boolean(),
});

export const CreateProjectBody = t.Object({
    title: t.String({ minLength: 1 }),
});

export const UpdateProjectBody = t.Object({
    title: t.Optional(t.String()),
});

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

export const ExportFormat = t.Union([
    t.Literal('html5'),
    t.Literal('html5-sp'),
    t.Literal('scorm12'),
    t.Literal('scorm2004'),
    t.Literal('ims'),
    t.Literal('epub3'),
    t.Literal('elp'),
    t.Literal('elpx'),
]);

export const ExportFormatInfo = t.Object({
    id: t.String(),
    name: t.String(),
    extension: t.String(),
    mimeType: t.String(),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UserData = t.Object({
    id: t.Number(),
    email: t.String(),
    roles: t.Array(t.String()),
    created_at: t.Union([t.Number(), t.Null()]),
    updated_at: t.Union([t.Number(), t.Null()]),
});

export const CreateUserBody = t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 4 }),
    roles: t.Optional(t.Array(t.String())),
});

export const UpdateUserBody = t.Object({
    email: t.Optional(t.String({ format: 'email' })),
    password: t.Optional(t.String({ minLength: 4 })),
    roles: t.Optional(t.Array(t.String())),
});

// ============================================================================
// PARAMS SCHEMAS
// ============================================================================

export const ProjectUuidParam = t.Object({
    uuid: t.String(),
});

export const PageIdParam = t.Object({
    uuid: t.String(),
    pageId: t.String(),
});

export const BlockIdParam = t.Object({
    uuid: t.String(),
    blockId: t.String(),
});

export const PageBlockParam = t.Object({
    uuid: t.String(),
    pageId: t.String(),
    blockId: t.String(),
});

export const ComponentIdParam = t.Object({
    uuid: t.String(),
    componentId: t.String(),
});

export const ExportFormatParam = t.Object({
    uuid: t.String(),
    format: ExportFormat,
});

export const UserIdParam = t.Object({
    id: t.Number(),
});

// ============================================================================
// ASSET SCHEMAS
// ============================================================================

export const AssetData = t.Object({
    id: t.Number(),
    clientId: t.Union([t.String(), t.Null()]),
    filename: t.String(),
    mimeType: t.Union([t.String(), t.Null()]),
    size: t.Number(),
    folderPath: t.String(),
    createdAt: t.String(),
    updatedAt: t.String(),
});

export const AssetIdParam = t.Object({
    uuid: t.String(),
    assetId: t.String(),
});

export const BulkDeleteAssetsBody = t.Object({
    clientIds: t.Array(t.String()),
});
