/**
 * Platform Integration Routes for Elysia
 *
 * Handles integration with external educational platforms (Moodle, Moodle Workplace, etc.)
 * Provides entry points for creating/editing projects from platforms and
 * bidirectional file transfer (download from platform, upload to platform).
 */
import { Elysia, t } from 'elysia';
import { getBasePath } from '../utils/basepath.util';
import { decodePlatformJWT, getPlatformIntegrationParams } from '../utils/platform-jwt';
import { platformPetitionGet, platformPetitionSet } from '../services/platform-integration';

/**
 * Platform integration routes
 */
export const platformIntegrationRoutes = new Elysia({ name: 'platform-integration' })

    // =========================================================================
    // Entry Points (from Platform to eXeLearning)
    // =========================================================================

    /**
     * GET /new_ode - Entry point from platform to create a new project
     *
     * Platform sends a JWT token with user and course information.
     * eXeLearning validates the token and redirects to workarea for project creation.
     *
     * @query jwt_token - JWT token signed with APP_SECRET or provider token
     */
    .get('/new_ode', async ({ query, set }) => {
        const jwtToken = query.jwt_token as string | undefined;

        if (!jwtToken) {
            set.status = 400;
            return { error: 'Bad Request', message: 'Missing jwt_token parameter' };
        }

        const payload = await decodePlatformJWT(jwtToken);
        if (!payload) {
            set.status = 401;
            return { error: 'Unauthorized', message: 'Invalid or expired token' };
        }

        // Redirect to workarea with parameters for new project creation
        const basePath = getBasePath();
        const redirectUrl = `${basePath}/workarea?newOde=new&jwt_token=${encodeURIComponent(jwtToken)}`;

        return Response.redirect(redirectUrl, 302);
    })

    /**
     * GET /edit_ode - Entry point from platform to edit an existing project
     *
     * Platform sends a JWT token with user, course, and project information.
     * eXeLearning validates the token and redirects to workarea for project editing.
     *
     * @query ode_id - Platform's course module ID (cmid)
     * @query jwt_token - JWT token signed with APP_SECRET or provider token
     */
    .get('/edit_ode', async ({ query, set }) => {
        const jwtToken = query.jwt_token as string | undefined;
        const odeId = query.ode_id as string | undefined;

        if (!jwtToken) {
            set.status = 400;
            return { error: 'Bad Request', message: 'Missing jwt_token parameter' };
        }

        const payload = await decodePlatformJWT(jwtToken);
        if (!payload) {
            set.status = 401;
            return { error: 'Unauthorized', message: 'Invalid or expired token' };
        }

        // Use ode_id from query or cmid from JWT
        const projectId = odeId || payload.cmid;

        // Redirect to workarea with parameters for project editing
        const basePath = getBasePath();
        const redirectUrl = `${basePath}/workarea?odeId=${encodeURIComponent(projectId)}&jwt_token=${encodeURIComponent(jwtToken)}`;

        return Response.redirect(redirectUrl, 302);
    })

    // =========================================================================
    // API Endpoints (for bidirectional file transfer)
    // =========================================================================

    /**
     * POST /api/platform/integration/openPlatformElp - Download ELP from platform
     *
     * Frontend calls this endpoint to fetch an ELP file from the platform.
     * The server acts as a proxy, fetching the file from Moodle and returning it.
     *
     * @body jwt_token - JWT token for platform authentication
     * @returns Base64-encoded ELP file and filename
     */
    .post(
        '/api/platform/integration/openPlatformElp',
        async ({ body, set }) => {
            const { jwt_token } = body;

            // Get integration parameters with validation
            const params = await getPlatformIntegrationParams(jwt_token, 'get');
            if (!params) {
                set.status = 401;
                return {
                    responseMessage: 'ERROR',
                    error: 'Invalid token or unauthorized provider',
                };
            }

            try {
                const result = await platformPetitionGet(params, jwt_token);

                return {
                    responseMessage: 'OK',
                    elpFile: result.ode_file,
                    elpFileName: result.ode_filename,
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error('[PlatformIntegration] openPlatformElp error:', message);

                set.status = 500;
                return {
                    responseMessage: 'ERROR',
                    error: message,
                };
            }
        },
        {
            body: t.Object({
                jwt_token: t.String(),
            }),
        },
    )

    /**
     * POST /api/platform/integration/set_platform_new_ode - Generate export and upload to platform
     *
     * Frontend calls this endpoint when saving a project that came from a platform.
     * The server:
     * 1. Reconstructs the Yjs document from the database
     * 2. Generates the appropriate export (SCORM12 or HTML5 based on JWT pkgtype)
     * 3. Uploads the ZIP to the platform
     *
     * @body projectUuid - UUID of the project to export and upload
     * @body jwt_token - JWT token for platform authentication
     * @returns Success/error status
     */
    .post(
        '/api/platform/integration/set_platform_new_ode',
        async ({ body, set }) => {
            const { projectUuid, jwt_token } = body;

            // Get integration parameters with validation
            const params = await getPlatformIntegrationParams(jwt_token, 'set');
            if (!params) {
                set.status = 401;
                return {
                    responseMessage: 'Invalid token or unauthorized provider',
                };
            }

            try {
                const result = await platformPetitionSet(params, jwt_token, projectUuid);

                if (!result.success) {
                    set.status = 500;
                    // Return format expected by frontend
                    return {
                        responseMessage: result.error || 'Upload failed',
                    };
                }

                // Return format expected by frontend
                return {
                    responseMessage: 'OK',
                    returnUrl: params.returnurl,
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error('[PlatformIntegration] set_platform_new_ode error:', message);

                set.status = 500;
                // Return format expected by frontend
                return {
                    responseMessage: message,
                };
            }
        },
        {
            body: t.Object({
                projectUuid: t.String(),
                jwt_token: t.String(),
            }),
        },
    );
