import { Controller, Get, Req, Res, Logger, Query } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import '../../types/fastify';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { AuthService } from '../auth/auth.service';
import { ProjectsService } from '../projects/services/projects.service';
import { LocaleService } from '../translation/services/locale.service';
import { TranslationService } from '../translation/services/translation.service';
import { createGravatarUrl } from '../../utils/gravatar.util';
import { getBasePath, prefixPath } from '../../utils/basepath.util';

// Find package.json by traversing up from current directory
const findPackageJson = (): any => {
    let currentDir = __dirname;
    for (let i = 0; i < 10; i++) {
        const packagePath = join(currentDir, 'package.json');
        if (existsSync(packagePath)) {
            return JSON.parse(readFileSync(packagePath, 'utf-8'));
        }
        currentDir = join(currentDir, '..');
    }
    return { version: 'unknown' };
};

const packageJson = findPackageJson();

const isOfflineMode = () => String(process.env.APP_ONLINE_MODE ?? '1') === '0';

// Get version from APP_VERSION env var or package.json (with 'v' prefix)
const getAppVersion = () => process.env.APP_VERSION || `v${packageJson.version}`;

@Controller()
export class PagesController {
    private readonly logger = new Logger(PagesController.name);

    constructor(
        private readonly authService: AuthService,
        private readonly projectsService: ProjectsService,
        private readonly localeService: LocaleService,
        private readonly translationService: TranslationService,
    ) {}
    @Get('/login')
    async login(@Req() request: any, @Res() res: FastifyReply) {
        const offline = isOfflineMode();
        const defaultEmail =
            process.env.DEFAULT_USER_EMAIL || process.env.TEST_USER_EMAIL || 'user@exelearning.net';

        // Offline mode: auto-login with default/local user and skip login screen
        if (offline && request.session) {
            if (!request.session.userId) {
                // Detect browser locale for new user preference
                const browserLocale =
                    this.localeService.parseAcceptLanguageHeader(request) || 'en';

                let user = await this.authService.findByEmail(defaultEmail);
                if (!user) {
                    user = await this.authService.findOrCreateExternalUser(
                        'offline-local',
                        defaultEmail,
                        ['ROLE_USER'],
                        browserLocale,
                    );
                }
                if (user) {
                    request.session.userId = user.id;
                    request.session.email = user.email;
                    request.session.isGuest = false;
                    request.session.authMethodUsed = 'offline';
                }
            }

            const redirectTo = request.session?.targetPath || prefixPath('/workarea');
            return res.redirect( redirectTo);
        }

        const authMethods = this.authService.getAuthMethods();
        const guestLoginNonce = authMethods.includes('guest')
            ? randomBytes(8).toString('hex')
            : null;
        if (guestLoginNonce && request.session) {
            (request as any).session.guestLoginNonce = guestLoginNonce;
        }

        let user = null;
        if (request.session?.userId) {
            if (request.session.isGuest) {
                const email = request.session.email || 'guest@guest.local';
                user = {
                    id: request.session.userId,
                    username: email,
                    usernameFirsLetter: (email[0] || 'G').toUpperCase(),
                    gravatarUrl: createGravatarUrl(email, null, email),
                };
            } else {
                const dbUser = await this.authService.findById(request.session.userId);
                if (dbUser) {
                    user = {
                        id: dbUser.id,
                        username: dbUser.email,
                        usernameFirsLetter: (dbUser.email[0] || 'U').toUpperCase(),
                        gravatarUrl: dbUser.getGravatarUrl(),
                    };
                } else {
                    request.session.destroy();
                }
            }
        }

        // Detect locale: user preference > Accept-Language > default
        const userId = request.session?.userId;
        const { locale } = await this.localeService.detectLocale(request, userId);

        // Server-side translations for the login template
        const t = {
            sign_in: this.translationService.trans('Sign in', {}, 'messages', locale),
            hello_again: this.translationService.trans(
                'Hello again! Please enter your credentials.',
                {},
                'messages',
                locale,
            ),
            email: this.translationService.trans('Email', {}, 'messages', locale),
            password: this.translationService.trans('Password', {}, 'messages', locale),
            logout: this.translationService.trans('Logout', {}, 'messages', locale),
            work_area: this.translationService.trans('Work area', {}, 'messages', locale),
            logged_in_as: this.translationService.trans('Logged in as', {}, 'messages', locale),
            close: this.translationService.trans('Close', {}, 'messages', locale),
            version: this.translationService.trans('Version:', {}, 'messages', locale),
            guest: this.translationService.trans('Guest', {}, 'messages', locale),
            other_auth_methods: this.translationService.trans(
                'Other authentication methods:',
                {},
                'messages',
                locale,
            ),
            auth_methods: this.translationService.trans(
                'Authentication methods:',
                {},
                'messages',
                locale,
            ),
        };

        const viewModel = {
            app_version: getAppVersion(),
            auth_methods: authMethods,
            user,
            error: null,
            last_username: request.session?.email || '',
            csrf_token: 'temp-csrf-token', // TODO: Generate real CSRF token
            guest_login_nonce: guestLoginNonce,
            locale,
            t,
            basePath: getBasePath(),
        };
        return res.view('security/login', viewModel);
    }

    @Get('/workarea')
    async workarea(
        @Req() request: any,
        @Res() res: FastifyReply,
        @Query('project') projectUuid?: string,
    ) {
        // Check if user is authenticated
        if (!request.session || !request.session.userId) {
            if (request.session) {
                request.session.targetPath = request.originalUrl || '/workarea';
            }
            // Redirect to login if not authenticated
            return res.redirect(prefixPath('/login'));
        }

        const userId = request.session.userId;

        // === Handle project parameter (UUID) ===

        // If no project UUID provided, create a new project and redirect
        if (!projectUuid) {
            this.logger.log(
                `[Workarea] No project UUID provided, creating new project for user ${userId}`,
            );
            try {
                const newProject = await this.projectsService.createQuick(userId);
                this.logger.log(
                    `[Workarea] Created new project ${newProject.uuid}, redirecting...`,
                );
                return res.redirect(prefixPath(`/workarea?project=${newProject.uuid}&new=1`));
            } catch (error) {
                this.logger.error(`[Workarea] Failed to create project: ${error.message}`);
                // Fall through to render workarea with error
                return res.view('workarea/error', {
                    error: 'Failed to create project',
                    message: error.message,
                    basePath: getBasePath(),
                });
            }
        }

        // Validate UUID format (basic check)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(projectUuid)) {
            this.logger.warn(`[Workarea] Invalid project UUID format: ${projectUuid}`);
            return res.view('workarea/error', {
                error: 'Invalid project ID',
                message: 'The project ID format is invalid',
                basePath: getBasePath(),
            });
        }

        // Check if user has access to this project (by UUID)
        const accessCheck = await this.projectsService.checkAccessByUuid(projectUuid, userId);
        if (!accessCheck.hasAccess) {
            this.logger.warn(
                `[Workarea] Access denied for user ${userId} to project ${projectUuid}: ${accessCheck.reason}`,
            );
            return res.view('workarea/error', {
                error: 'Access Denied',
                message: this.getAccessDeniedMessage(accessCheck.reason),
                basePath: getBasePath(),
            });
        }

        this.logger.log(`[Workarea] User ${userId} accessing project ${projectUuid}`);

        // Detect locale: user preference > Accept-Language > default
        const { locale } = await this.localeService.detectLocale(request, userId);

        // === END NEW LOGIC ===

        let user;

        // Check if this is a guest user
        if (request.session.isGuest) {
            const email = request.session.email || 'guest@guest.local';
            // Guest user - use session data
            user = {
                id: request.session.userId,
                username: email,
                usernameFirsLetter: (email[0] || 'G').toUpperCase(),
                acceptedLopd: true,
                odePlatformId: null,
                newOde: null,
                gravatarUrl: createGravatarUrl(email, null, email),
            };
        } else {
            // Regular user - load from database
            const dbUser = await this.authService.findById(request.session.userId);
            if (!dbUser) {
                // User not found in database, clear session and redirect
                request.session.destroy();
                return res.redirect(prefixPath('/login'));
            }

            user = {
                id: dbUser.id,
                username: dbUser.email,
                usernameFirsLetter: (dbUser.email[0] || 'U').toUpperCase(),
                acceptedLopd: dbUser.isLopdAccepted,
                odePlatformId: null,
                newOde: null,
                gravatarUrl: dbUser.getGravatarUrl(),
            };
        }

        const isOfflineInstallation =
            String(process.env.APP_ONLINE_MODE || '1') === '0' ||
            (process.env.APP_AUTH_METHODS || '')
                .split(',')
                .map((m) => m.trim().toLowerCase())
                .includes('none');

        // Mock/derived config data
        const config = {
            platformName: 'exelearning',
            platformType: 'standalone',
            platformUrlGet: '',
            platformUrlSet: '',
            clientCallWaitingTime: 120000, // 120 seconds timeout for iDevice script loading
            clientIntervalGetLastEdition: 5000,
            clientIntervalUpdate: 3000,
            defaultTheme: 'default',
            isOfflineInstallation,
            platformIntegration: false,
            userStyles: 0,
            userIdevices: 0,
            // Debug mode: load individual JS files instead of bundle when APP_ENV=dev
            debugJs: process.env.APP_ENV === 'dev',
            // Expose APP_ENV, APP_DEBUG and APP_ONLINE_MODE to frontend
            appEnv: process.env.APP_ENV || 'prod',
            appDebug: process.env.APP_DEBUG || '0',
            onlineMode: String(process.env.APP_ONLINE_MODE || '1') === '1',
        };

        // Mock symfony data
        const protocol = request.protocol || 'http';
        const host = request.get('host') || 'localhost:3001';
        const baseURL = `${protocol}://${host}`;

        if (process.env.APP_DEBUG === '1') {
            console.log('Request info:', { protocol, host, baseURL });
        }

        // Generate JWT token for WebSocket authentication
        const authToken = await this.authService.generateTokenForUser(
            request.session.userId,
            request.session.email,
            request.session.isGuest || false,
        );

        const basePath = getBasePath();
        const symfony = {
            odeSessionId: null,
            environment: process.env.APP_ENV || 'prod',
            baseURL,
            basePath,
            fullURL: basePath ? `${baseURL}${basePath}` : baseURL,
            changelogURL: prefixPath('/CHANGELOG.md'),
            filesDirPermission: {
                checked: true, // No permission errors in development mode
            },
            locale,
            themeTypeBase: 'base',
            themeTypeUser: 'user',
            ideviceTypeBase: 'base',
            ideviceTypeUser: 'user',
            ideviceVisibilityPreferencePre: 'exe_',
            token: authToken, // JWT token for WebSocket authentication
        };

        // Mock mercure data
        const mercure = {
            url: null,
            jwtSecretKey: null,
        }; // Will be configured when implementing real-time features

        // Server-side translations for the workarea template
        const t = {
            // Menu items - File
            file: this.translationService.trans('File', {}, 'messages', locale),
            new: this.translationService.trans('New', {}, 'messages', locale),
            new_from_template: this.translationService.trans(
                'New from Template...',
                {},
                'messages',
                locale,
            ),
            open: this.translationService.trans('Open', {}, 'messages', locale),
            recent_projects: this.translationService.trans(
                'Recent projects',
                {},
                'messages',
                locale,
            ),
            import_elpx: this.translationService.trans('Import (.elpx…)', {}, 'messages', locale),
            save: this.translationService.trans('Save', {}, 'messages', locale),
            save_as: this.translationService.trans('Save as', {}, 'messages', locale),
            download_as: this.translationService.trans('Download as...', {}, 'messages', locale),
            export_as: this.translationService.trans('Export as...', {}, 'messages', locale),
            exelearning_content: this.translationService.trans(
                'eXeLearning content (.elpx)',
                {},
                'messages',
                locale,
            ),
            website: this.translationService.trans('Website', {}, 'messages', locale),
            single_page: this.translationService.trans('Single page', {}, 'messages', locale),
            export_to_folder: this.translationService.trans(
                'Export to Folder (Unzipped Website)',
                {},
                'messages',
                locale,
            ),
            print: this.translationService.trans('Print', {}, 'messages', locale),
            upload_to: this.translationService.trans('Upload to', {}, 'messages', locale),
            metadata: this.translationService.trans('Metadata', {}, 'messages', locale),
            import: this.translationService.trans('Import', {}, 'messages', locale),
            export: this.translationService.trans('Export', {}, 'messages', locale),

            // Menu items - Utilities
            utilities: this.translationService.trans('Utilities', {}, 'messages', locale),
            preview: this.translationService.trans('Preview', {}, 'messages', locale),
            idevice_manager: this.translationService.trans('iDevice manager', {}, 'messages', locale),
            resources_report: this.translationService.trans(
                'Resources report',
                {},
                'messages',
                locale,
            ),
            link_validation: this.translationService.trans(
                'Link validation',
                {},
                'messages',
                locale,
            ),
            file_manager: this.translationService.trans('File manager', {}, 'messages', locale),

            // Menu items - Help
            help: this.translationService.trans('Help', {}, 'messages', locale),
            assistant: this.translationService.trans('Assistant', {}, 'messages', locale),
            user_manual: this.translationService.trans('User manual', {}, 'messages', locale),
            api_reference: this.translationService.trans(
                'API Reference (Swagger)',
                {},
                'messages',
                locale,
            ),
            about_exelearning: this.translationService.trans(
                'About eXeLearning',
                {},
                'messages',
                locale,
            ),
            release_notes: this.translationService.trans('Release notes', {}, 'messages', locale),
            legal_notes: this.translationService.trans('Legal notes', {}, 'messages', locale),
            exelearning_website: this.translationService.trans(
                'eXeLearning website',
                {},
                'messages',
                locale,
            ),
            report_bug: this.translationService.trans('Report a bug', {}, 'messages', locale),

            // Buttons
            download: this.translationService.trans('Download', {}, 'messages', locale),
            styles: this.translationService.trans('Styles', {}, 'messages', locale),
            settings: this.translationService.trans('Settings', {}, 'messages', locale),
            share: this.translationService.trans('Share', {}, 'messages', locale),
            private: this.translationService.trans('Private', {}, 'messages', locale),
            public: this.translationService.trans('Public', {}, 'messages', locale),
            preferences: this.translationService.trans('Preferences', {}, 'messages', locale),
            logout: this.translationService.trans('Logout', {}, 'messages', locale),

            // Panel titles
            toggle_panels: this.translationService.trans('Toggle panels', {}, 'messages', locale),
            structure_panel: this.translationService.trans(
                'Structure panel',
                {},
                'messages',
                locale,
            ),
            idevices_panel: this.translationService.trans('iDevices panel', {}, 'messages', locale),

            // Other
            undo: this.translationService.trans('Undo', {}, 'messages', locale),
            redo: this.translationService.trans('Redo', {}, 'messages', locale),
            user_menu: this.translationService.trans('User menu', {}, 'messages', locale),
            users_online: this.translationService.trans('Users online', {}, 'messages', locale),
            exit: this.translationService.trans('Exit', {}, 'messages', locale),

            // Title editor
            change_title: this.translationService.trans('Change title', {}, 'messages', locale),

            // Structure panel actions
            move_up: this.translationService.trans('Move up', {}, 'messages', locale),
            move_down: this.translationService.trans('Move down', {}, 'messages', locale),
            move_left: this.translationService.trans(
                'Move left (up in hierarchy)',
                {},
                'messages',
                locale,
            ),
            move_right: this.translationService.trans(
                'Move right (down in hierarchy)',
                {},
                'messages',
                locale,
            ),
            page_properties: this.translationService.trans(
                'Page properties',
                {},
                'messages',
                locale,
            ),
            delete_page: this.translationService.trans('Delete page', {}, 'messages', locale),
            clone_page: this.translationService.trans('Clone page', {}, 'messages', locale),
            import_idevices: this.translationService.trans(
                'Import iDevices',
                {},
                'messages',
                locale,
            ),
            new_page: this.translationService.trans('New page', {}, 'messages', locale),
            add_subpage: this.translationService.trans('Add subpage', {}, 'messages', locale),
            page_options: this.translationService.trans('Page options', {}, 'messages', locale),
        };

        // Render the workarea template. If view engine is not configured (as in some tests),
        // fall back to a minimal HTML shell that still exposes the expected globals.
        try {
            return res.view('workarea/workarea', {
                version: getAppVersion(),
                app_version: getAppVersion(), // For template compatibility
                expires: '',
                extension: '.elp',
                user,
                config,
                symfony,
                mercure,
                locale,
                projectId: projectUuid || null, // Yjs project UUID from URL parameter
                t, // Translations object
                basePath, // For template URLs
            });
        } catch (error) {
            this.logger.warn(
                `View rendering failed or engine not configured. Serving fallback HTML. Error: ${error?.message}`,
            );

            const fallbackHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>eXeLearning Workarea</title>
    <script>window.eXeLearning = { version: "${getAppVersion()}", user: ${JSON.stringify(user)}, config: ${JSON.stringify(config)}, symfony: ${JSON.stringify(symfony)} };</script>
  </head>
  <body>
    <div id="root">eXeLearning workarea</div>
  </body>
</html>`;
            return res.type('text/html').code(200).send(fallbackHtml);
        }
    }

    @Get('/')
    root(@Res() res: FastifyReply) {
        // Redirect to login
        return res.redirect( prefixPath('/login'));
    }

    /**
     * Get human-readable message for access denied reason
     */
    private getAccessDeniedMessage(reason: string): string {
        switch (reason) {
            case 'PROJECT_NOT_FOUND':
                return 'The project you are looking for does not exist.';
            case 'PROJECT_DELETED':
                return 'This project has been deleted.';
            case 'AUTHENTICATION_REQUIRED':
                return 'You need to log in to access this private project.';
            case 'ACCESS_DENIED':
                return 'You do not have permission to access this project. Contact the owner if you need access.';
            default:
                return 'Unable to access this project.';
        }
    }
}
