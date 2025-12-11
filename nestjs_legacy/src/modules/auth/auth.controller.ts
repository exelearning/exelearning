import {
    Controller,
    Post,
    Body,
    Get,
    Req,
    UseGuards,
    Redirect,
    Res,
    Put,
    Param,
    Query,
    Logger,
    HttpCode,
    HttpStatus,
    Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import '../../types/fastify';
import { randomBytes, createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';
import { XMLParser } from 'fast-xml-parser';
import { AuthService } from './auth.service';
import { buildAbsoluteUrl, decodeJwtPayload } from './auth.utils';
import { UserPreferencesService } from '../user-preferences/user-preferences.service';
import { IDeviceService } from '../idevice/services/idevice.service';
import { ThemeService } from '../theme/services/theme.service';
import { SessionManagerService } from '../session/session-manager.service';
import { Constants, Settings } from '../../constants';
import {
    USER_PREFERENCES_CONFIG,
    IDEVICE_INFO_FIELDS_CONFIG,
    ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG,
    ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG,
    LICENSES,
    TRANS_PREFIX,
    GROUPS_TITLE,
} from '../../config/properties.config';
import { generateId } from '../../utils/id-generator.util';
import { ProjectImportService } from '../project/services/project-import.service';
import { ProjectOpenService } from '../project/services/project-open.service';
import { LocaleService } from '../translation/services/locale.service';
import { TranslationService } from '../translation/services/translation.service';
import { prefixPath, getBasePath } from '../../utils/basepath.util';

@Controller()
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
        private readonly userPreferencesService: UserPreferencesService,
        private readonly ideviceService: IDeviceService,
        private readonly themeService: ThemeService,
        private readonly localeService: LocaleService,
        private readonly translationService: TranslationService,
        @Optional() private readonly sessionManagerService?: SessionManagerService,
        @Optional() private readonly projectImportService?: ProjectImportService,
        @Optional() private readonly projectOpenService?: ProjectOpenService,
    ) {}

    private authMethods(): string[] {
        return this.authService.getAuthMethods();
    }

    /**
     * Recursively translate all TRANSLATABLE_TEXT: prefixed strings in an object
     */
    private translateProperties(obj: any, locale: string): any {
        if (typeof obj === 'string') {
            if (obj.startsWith(TRANS_PREFIX)) {
                const key = obj.replace(TRANS_PREFIX, '');
                return this.translationService.trans(key, {}, 'messages', locale);
            }
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => this.translateProperties(item, locale));
        }
        if (obj !== null && typeof obj === 'object') {
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.translateProperties(value, locale);
            }
            return result;
        }
        return obj;
    }

    private targetAfterLogin(req: FastifyRequest): string {
        const sessionTarget =
            (req as any).session?.postLoginRedirect || (req as any).session?.targetPath;
        if ((req as any).session) {
            delete (req as any).session.postLoginRedirect;
            delete (req as any).session.targetPath;
        }

        return sessionTarget || prefixPath('/workarea');
    }

    // API endpoints (mantener compatibilidad)
    @Post('api/auth/login')
    async apiLogin(@Body() loginDto: { email: string; password: string }) {
        return this.authService.login(loginDto.email, loginDto.password);
    }

    @Post('api/auth/logout')
    async apiLogout(@Req() req: any) {
        // TODO: Implement logout logic
        return { message: 'Logged out successfully' };
    }

    @Get('api/auth/check')
    async checkAuth(@Req() req: any) {
        const authenticated = !!(req.session && req.session.userId);
        return { authenticated };
    }

    @Get('api/session/check')
    async checkSession(@Req() req: any) {
        const authenticated = !!(req.session && req.session.userId);
        return {
            authenticated,
            active: authenticated,
            user: authenticated ? { id: req.session.userId, email: req.session.email } : null,
        };
    }

    @Get('api/parameter-management/parameters/data/list')
    async getParameters(@Req() req: any) {
        // Generate temporary ODE session ID (Symfony-compatible format)
        const odeSessionId = generateId();

        // Detect locale: user preference > Accept-Language > default
        const userId = req.session?.userId;
        const { locale: detectedLocale } = await this.localeService.detectLocale(req, userId);

        // Get environment configuration values
        const versionControl = this.configService.get<string>('VERSION_CONTROL', 'true') === 'true';
        const autosaveOdeFilesFunction =
            this.configService.get<string>('AUTOSAVE_ODE_FILES_FUNCTION', 'true') === 'true';
        const autosaveIntervalTime = parseInt(
            this.configService.get<string>('PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL', '60000'),
            10,
        );
        const countUserAutosave =
            this.configService.get<string>('COUNT_USER_AUTOSAVE_SPACE_ODE_FILES', 'true') ===
            'true';
        const onlineThemesInstall =
            this.configService.get<string>('ONLINE_THEMES_INSTALL', '0') === '1';
        const appOnlineMode = this.configService.get<string>('APP_ONLINE_MODE', '1') === '1';
        const defaultProjectVisibility =
            this.configService.get<string>('DEFAULT_PROJECT_VISIBILITY', 'private') === 'public'
                ? 'public'
                : 'private';

        // Calculate canInstallThemes (matches Symfony logic)
        const canInstallThemes = appOnlineMode && !onlineThemesInstall ? 0 : 1;

        // Populate USER_PREFERENCES_CONFIG with Settings.LOCALES
        const userPreferencesConfig = {
            ...USER_PREFERENCES_CONFIG,
            locale: {
                ...USER_PREFERENCES_CONFIG.locale,
                options: Settings.LOCALES,
            },
        };

        // Return complete parameters in the expected format
        // Build response object first, then translate TRANSLATABLE_TEXT: prefixed strings
        const response = {
            // ODE Session ID (temporary UUID for this request)
            odeSessionId,

            // Detected user locale
            detectedLocale,

            // Temporary content storage directory
            temporaryContentStorageDirectory: `files/${Constants.TEMPORARY_CONTENT_STORAGE_DIRECTORY}`,

            // Generate new item key constant
            generateNewItemKey: Constants.GENERATE_NEW_ITEM_KEY,

            // Available locales
            locales: Settings.LOCALES,

            // CSV item separator
            csvItemSeparator: Constants.CSV_ITEM_SEPARATOR,

            // Environment-based configuration
            versionControl,
            autosaveOdeFilesFunction,
            autosaveIntervalTime,
            countUserAutosave,
            canInstallThemes,
            defaultProjectVisibility,

            // Property configurations
            ideviceInfoFieldsConfig: IDEVICE_INFO_FIELDS_CONFIG,
            odeComponentsSyncPropertiesConfig: ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG,
            odePagStructureSyncPropertiesConfig: ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG,
            userPreferencesConfig,

            // API routes
            routes: {
                api_odes_get_user_recent_ode_list: {
                    path: '/api/v2/projects/user/recent',
                    methods: ['GET'],
                },
                api_translations_list_by_locale: {
                    path: '/api/translations/{locale}/list',
                    methods: ['GET'],
                },
                api_idevices_installed: {
                    path: '/api/idevice/installed',
                    methods: ['GET'],
                },
                api_themes_installed: {
                    path: '/api/theme/installed',
                    methods: ['GET'],
                },
                api_user_preferences_get: {
                    path: '/api/user/preferences',
                    methods: ['GET'],
                },
                api_user_preferences_save: {
                    path: '/api/user/preferences',
                    methods: ['PUT'],
                },
                api_current_ode_users_for_user_get: {
                    path: '/api/current-ode-users-management/current-ode-user/user/get',
                    methods: ['GET'],
                },
                api_odes_properties_get: {
                    path: '/api/project/{odeSessionId}/properties',
                    methods: ['GET'],
                },
                api_odes_last_updated: {
                    path: '/api/project/{odeId}/last-updated',
                    methods: ['GET'],
                },
                api_odes_current_users: {
                    path: '/api/project/{odeId}/version/{odeVersionId}/session/{odeSessionId}/users',
                    methods: ['GET'],
                },
                current_ode_users_on_page_id: {
                    path: '/api/current/ode/users/on/page/id',
                    methods: ['POST'],
                },
                api_nav_structures_nav_structure_get: {
                    path: '/api/project/version/{odeVersionId}/session/{odeSessionId}/structure',
                    methods: ['GET'],
                },
                api_idevices_list_by_page: {
                    path: '/api/idevice-management/idevices/{odeNavStructureSyncId}/list/page',
                    methods: ['GET'],
                },
                api_idevices_download_file_resources: {
                    path: '/api/idevice-management/idevices/download/file/resources',
                    methods: ['GET'],
                },
                api_idevices_html_view_get: {
                    path: '/api/idevice-management/idevices/{odeComponentsSyncId}/html/view/get',
                    methods: ['GET'],
                },
                api_idevices_html_template_get: {
                    path: '/api/idevice-management/idevices/{odeComponentsSyncId}/html/template/get',
                    methods: ['GET'],
                },
                api_idevices_html_view_save: {
                    path: '/api/idevice-management/idevices/html/view/save',
                    methods: ['PUT'],
                },
                api_idevices_idevice_data_save: {
                    path: '/api/idevice-management/idevices/data/save',
                    methods: ['PUT'],
                },
                api_idevices_idevice_duplicate: {
                    path: '/api/idevice-management/idevices/duplicate',
                    methods: ['POST'],
                },
                api_idevices_idevice_reorder: {
                    path: '/api/idevice-management/idevices/reorder/save',
                    methods: ['PUT'],
                },
                api_odes_clean_init_autosave_elp: {
                    path: '/api/project/clean/init/autosave/elp',
                    methods: ['POST'],
                },
                api_odes_remove_date_ode_files: {
                    path: '/api/ode-management/odes/remove/date/ode/files',
                    methods: ['POST'],
                },
                api_nav_structures_nav_structure_data_save: {
                    path: '/api/nav-structure-management/nav-structures/nav/structure/data/save',
                    methods: ['PUT'],
                },
                api_nav_structures_nav_structure_reorder: {
                    path: '/api/nav-structure-management/nav-structures/reorder/save',
                    methods: ['PUT'],
                },
                api_nav_structures_nav_structure_delete: {
                    path: '/api/nav-structure-management/nav-structures/{odeNavStructureSyncId}/delete',
                    methods: ['DELETE'],
                },
                api_nav_structures_nav_structure_properties_save: {
                    path: '/api/nav-structure-management/nav-structures/properties/save',
                    methods: ['PUT'],
                },
                api_nav_structures_nav_structure_duplicate: {
                    path: '/api/nav-structure-management/nav-structures/duplicate',
                    methods: ['POST'],
                },
                api_nav_structures_import_elp_child: {
                    path: '/api/nav-structure-management/nav-structures/{odeNavStructureSyncId}/import-elp',
                    methods: ['POST'],
                },
                api_ode_import_local_root: {
                    path: '/api/ode-management/odes/ode/import/local/root',
                    methods: ['POST'],
                },
                api_odes_ode_local_elp_import_root_from_local: {
                    path: '/api/ode-management/odes/ode/import/local/root',
                    methods: ['POST'],
                },
                api_odes_ode_local_elp_import_root: {
                    path: '/api/ode-management/odes/ode/local/elp/import-root-upload',
                    methods: ['POST'],
                },
                api_pag_structures_pag_structure_data_save: {
                    path: '/api/pag-structure-management/pag-structures/pag/structure/data/save',
                    methods: ['PUT'],
                },
                api_pag_structures_pag_structure_reorder: {
                    path: '/api/pag-structure-management/pag-structures/reorder/save',
                    methods: ['PUT'],
                },
                api_pag_structures_pag_structure_delete: {
                    path: '/api/pag-structure-management/pag-structures/{odePagStructureSyncId}/delete',
                    methods: ['DELETE'],
                },
                api_pag_structures_pag_structure_properties_save: {
                    path: '/api/pag-structure-management/pag-structures/properties/save',
                    methods: ['PUT'],
                },
                api_pag_structures_pag_structure_duplicate: {
                    path: '/api/pag-structure-management/pag-structures/duplicate',
                    methods: ['POST'],
                },
                api_odes_properties_save: {
                    path: '/api/ode-management/odes/properties/save',
                    methods: ['PUT'],
                },
                current_ode_users_update_flag: {
                    path: '/api/current-ode-users-management/current-ode-user/current/ode/users/update/flag',
                    methods: ['POST'],
                },
                update_api_current_ode_user_flag: {
                    path: '/api/current-ode-users-management/current-ode-user/update/api/current/ode/user/flag',
                    methods: ['POST'],
                },
                check_ode_component_flag_current_ode_users: {
                    path: '/api/current-ode-users-management/current-ode-user/check/ode/component/flag/current/ode/users',
                    methods: ['POST'],
                },
                api_odes_check_before_leave_ode_session: {
                    path: '/api/ode-management/odes/check/before/leave/ode/session',
                    methods: ['POST'],
                },
                api_odes_ode_session_close: {
                    path: '/api/ode-management/odes/ode/session/close',
                    methods: ['POST'],
                },
                api_ode_export_download: {
                    path: '/api/ode-export/{odeSessionId}/{exportType}/download',
                    methods: ['GET'],
                },
                api_ode_export_preview: {
                    path: '/api/ode-export/{odeSessionId}/preview',
                    methods: ['GET'],
                },
                api_odes_ode_save_manual: {
                    path: '/api/ode-management/odes/ode/save/manual',
                    methods: ['POST'],
                },
                api_odes_ode_save_auto: {
                    path: '/api/ode-management/odes/ode/save/auto',
                    methods: ['POST'],
                },
                api_odes_user_get_ode_list: {
                    path: '/api/project/get/user/ode/list',
                    methods: ['GET'],
                },
                api_odes_ode_local_elp_open: {
                    path: '/api/ode-management/odes/ode/local/elp/open',
                    methods: ['POST'],
                },
                api_odes_ode_local_large_elp_open: {
                    path: '/api/ode-management/odes/ode/local/large/elp/open',
                    methods: ['POST'],
                },
                api_ode_theme_import: {
                    path: '/api/ode-management/odes/ode/theme/import',
                    methods: ['POST'],
                },
                api_ode_properties_get: {
                    path: '/api/ode-management/odes/properties/:sessionId/get',
                    methods: ['GET'],
                },
                api_nav_structure_get: {
                    path: '/api/nav-structure-management/nav-structures/:versionId/:sessionId/nav/structure/get',
                    methods: ['GET'],
                },
                api_resource_lock_timeout: {
                    path: '/api/resource-lock/get/timeout',
                    methods: ['GET'],
                },
                api_games_session_idevices: {
                    path: '/api/games/{odeSessionId}/idevices',
                    methods: ['GET'],
                },
                api_odes_session_get_broken_links: {
                    path: '/api/ode-management/odes/session/brokenlinks',
                    methods: ['POST'],
                },
                api_odes_pag_get_broken_links: {
                    path: '/api/ode-management/odes/pag/{odePageId}/brokenlinks',
                    methods: ['GET'],
                },
                api_odes_block_get_broken_links: {
                    path: '/api/ode-management/odes/block/{odeBlockId}/brokenlinks',
                    methods: ['GET'],
                },
                api_odes_idevice_get_broken_links: {
                    path: '/api/ode-management/odes/idevice/{odeIdeviceId}/brokenlinks',
                    methods: ['GET'],
                },
                api_odes_session_get_used_files: {
                    path: '/api/ode-management/odes/session/usedfiles',
                    methods: ['POST'],
                },
            },
            baseUrl: '/api',
            version: '3.0.0',
            odeNavStructureSyncPropertiesConfig: {
                titleNode: {
                    title: `${TRANS_PREFIX}Title`,
                    type: 'text',
                    category: `${TRANS_PREFIX}General`,
                    heritable: false,
                    value: '',
                },
                hidePageTitle: {
                    title: `${TRANS_PREFIX}Hide page title`,
                    type: 'checkbox',
                    category: `${TRANS_PREFIX}General`,
                    value: 'false',
                    heritable: false,
                },
                titleHtml: {
                    title: `${TRANS_PREFIX}Title HTML`,
                    type: 'text',
                    category: `${TRANS_PREFIX}Advanced (SEO)`,
                    heritable: false,
                    value: '',
                },
                editableInPage: {
                    title: `${TRANS_PREFIX}Different title on the page`,
                    type: 'checkbox',
                    category: `${TRANS_PREFIX}General`,
                    value: 'false',
                    alwaysVisible: true,
                },
                titlePage: {
                    title: `${TRANS_PREFIX}Title in page`,
                    type: 'text',
                    category: `${TRANS_PREFIX}General`,
                    heritable: false,
                    value: '',
                },
                visibility: {
                    title: `${TRANS_PREFIX}Visible in export`,
                    value: 'true',
                    type: 'checkbox',
                    category: `${TRANS_PREFIX}General`,
                    heritable: true,
                },
                highlight: {
                    title: `${TRANS_PREFIX}Highlight this page in the website navigation menu`,
                    value: 'false',
                    type: 'checkbox',
                    category: `${TRANS_PREFIX}General`,
                    heritable: false,
                },
                description: {
                    title: `${TRANS_PREFIX}Description`,
                    type: 'textarea',
                    category: `${TRANS_PREFIX}Advanced (SEO)`,
                    heritable: false,
                    value: '',
                },
            },
            odeProjectSyncPropertiesConfig: {
                properties: {
                    pp_title: {
                        title: `${TRANS_PREFIX}Title`,
                        help: `${TRANS_PREFIX}The name given to the resource.`,
                        alwaysVisible: true,
                        type: 'text',
                        category: 'properties',
                        groups: { properties_package: GROUPS_TITLE.properties_package },
                        value: '',
                    },
                    pp_subtitle: {
                        title: `${TRANS_PREFIX}Subtitle`,
                        help: `${TRANS_PREFIX}Adds additional information to the main title.`,
                        alwaysVisible: true,
                        type: 'text',
                        category: 'properties',
                        groups: { properties_package: GROUPS_TITLE.properties_package },
                        value: '',
                    },
                    pp_lang: {
                        title: `${TRANS_PREFIX}Language`,
                        help: `${TRANS_PREFIX}Select a language.`,
                        value: 'en',
                        alwaysVisible: true,
                        type: 'select',
                        options: Settings.PACKAGE_LOCALES,
                        category: 'properties',
                        groups: { properties_package: GROUPS_TITLE.properties_package },
                    },
                    pp_author: {
                        title: `${TRANS_PREFIX}Authorship`,
                        help: `${TRANS_PREFIX}Primary author/s of the resource.`,
                        alwaysVisible: true,
                        type: 'text',
                        category: 'properties',
                        groups: { properties_package: GROUPS_TITLE.properties_package },
                        value: '',
                    },
                    pp_license: {
                        title: `${TRANS_PREFIX}License`,
                        value: 'creative commons: attribution - share alike 4.0',
                        alwaysVisible: true,
                        type: 'select',
                        options: LICENSES,
                        category: 'properties',
                        groups: { properties_package: GROUPS_TITLE.properties_package },
                    },
                    pp_description: {
                        title: `${TRANS_PREFIX}Description`,
                        alwaysVisible: true,
                        type: 'textarea',
                        category: 'properties',
                        groups: { properties_package: GROUPS_TITLE.properties_package },
                        value: '',
                    },
                },
                export: {
                    exportSource: {
                        title: `${TRANS_PREFIX}Editable export`,
                        value: 'true',
                        help: `${TRANS_PREFIX}The exported content will be editable with eXeLearning.`,
                        type: 'checkbox',
                        category: 'properties',
                        groups: { export: GROUPS_TITLE.export },
                    },
                    pp_addExeLink: {
                        title: `${TRANS_PREFIX}"Made with eXeLearning" link`,
                        value: 'true',
                        help: `${TRANS_PREFIX}Help us spreading eXeLearning. Checking this option, a "Made with eXeLearning" link will be displayed in your pages.`,
                        type: 'checkbox',
                        category: 'properties',
                        groups: { export: GROUPS_TITLE.export },
                    },
                    pp_addPagination: {
                        title: `${TRANS_PREFIX}Page counter`,
                        value: 'false',
                        help: `${TRANS_PREFIX}A text with the page number will be added on each page.`,
                        type: 'checkbox',
                        category: 'properties',
                        groups: { export: GROUPS_TITLE.export },
                    },
                    pp_addSearchBox: {
                        title: `${TRANS_PREFIX}Search bar (Website export only)`,
                        value: 'false',
                        help: `${TRANS_PREFIX}A search box will be added to every page of the website.`,
                        type: 'checkbox',
                        category: 'properties',
                        groups: { export: GROUPS_TITLE.export },
                    },
                    pp_addAccessibilityToolbar: {
                        title: `${TRANS_PREFIX}Accessibility toolbar`,
                        value: 'false',
                        help: `${TRANS_PREFIX}The accessibility toolbar allows visitors to manipulate some aspects of your site, such as font and text size.`,
                        type: 'checkbox',
                        category: 'properties',
                        groups: { export: GROUPS_TITLE.export },
                    },
                },
                custom_code: {
                    pp_extraHeadContent: {
                        title: `${TRANS_PREFIX}HEAD`,
                        help: `${TRANS_PREFIX}HTML to be included at the end of HEAD: LINK, META, SCRIPT, STYLE...`,
                        alwaysVisible: true,
                        type: 'textarea',
                        category: 'properties',
                        groups: { custom_code: GROUPS_TITLE.custom_code },
                        value: '',
                    },
                    footer: {
                        title: `${TRANS_PREFIX}Page footer`,
                        help: `${TRANS_PREFIX}Type any HTML. It will be placed after every page content. No JavaScript code will be executed inside eXe.`,
                        alwaysVisible: true,
                        type: 'textarea',
                        category: 'properties',
                        groups: { custom_code: GROUPS_TITLE.custom_code },
                        value: '',
                    },
                },
            },
            odeProjectSyncCataloguingConfig: {},
            themeInfoFieldsConfig: {
                title: {
                    title: 'Title',
                    tag: 'text',
                },
                description: {
                    title: 'Description',
                    tag: 'textarea',
                },
                version: {
                    title: 'Version',
                    tag: 'text',
                },
                author: {
                    title: 'Authorship',
                    tag: 'text',
                },
                authorUrl: {
                    title: 'Author URL',
                    tag: 'text',
                },
                license: {
                    title: 'License',
                    tag: 'textarea',
                },
                licenseUrl: {
                    title: 'License URL',
                    tag: 'textarea',
                },
            },
            themeEditionFieldsConfig: {
                title: {
                    title: 'Title',
                    tag: 'text',
                    config: 'title',
                    category: 'Information',
                },
                description: {
                    title: 'Description',
                    tag: 'textarea',
                    config: 'description',
                    category: 'Information',
                },
                version: {
                    title: 'Version',
                    tag: 'text',
                    config: 'version',
                    category: 'Information',
                },
                author: {
                    title: 'Authorship',
                    tag: 'text',
                    config: 'author',
                    category: 'Information',
                },
                authorUrl: {
                    title: 'Author URL',
                    tag: 'text',
                    config: 'author-url',
                    category: 'Information',
                },
                license: {
                    title: 'License',
                    tag: 'textarea',
                    config: 'license',
                    category: 'Information',
                },
                licenseUrl: {
                    title: 'License URL',
                    tag: 'textarea',
                    config: 'license-url',
                    category: 'Information',
                },
                textColor: {
                    title: 'Text color',
                    tag: 'color',
                    config: 'text-color',
                    category: 'Texts and Links',
                },
                linkColor: {
                    title: 'Links color',
                    tag: 'color',
                    config: 'link-color',
                    category: 'Texts and Links',
                },
                headerImg: {
                    title: 'Header image',
                    tag: 'img',
                    config: 'header-img',
                    category: 'Header',
                },
                logoImg: {
                    title: 'Logo image',
                    tag: 'img',
                    config: 'logo-img',
                    category: 'Header',
                },
            },
            mercure: {
                url: null,
                jwtSecretKey: null,
            },
            config: {
                isOfflineInstallation: true, // Set to true until Mercure is configured
            },
        };

        // Prefix all route paths with BASE_PATH for subdirectory installations
        const basePath = getBasePath();
        if (basePath && response.routes) {
            for (const key of Object.keys(response.routes)) {
                const route = response.routes[key];
                if (route.path && route.path.startsWith('/')) {
                    route.path = `${basePath}${route.path}`;
                }
            }
        }

        // Translate all TRANSLATABLE_TEXT: prefixed strings in the response
        return this.translateProperties(response, detectedLocale);
    }

    @Get('api/user/preferences')
    async getUserPreferences(@Req() req: any) {
        // Get user ID from session or use default (req.user populated by SessionUserMiddleware)
        const userId = req.session?.userId || req.user?.email || 'user@exelearning.net';

        // Get preferences from database
        const preferences = await this.userPreferencesService.getPreferencesObject(userId);

        // Convert to Symfony-compatible format { key: { id: null, key: 'key', value: 'val' } }
        const formattedPreferences: Record<string, { id: null; key: string; value: string }> = {};
        for (const [key, value] of Object.entries(preferences)) {
            formattedPreferences[key] = { id: null, key, value };
        }

        // Set defaults if preferences don't exist
        if (!preferences['advancedMode']) {
            formattedPreferences['advancedMode'] = { id: null, key: 'advancedMode', value: 'true' };
        }
        if (!preferences['versionControl']) {
            formattedPreferences['versionControl'] = {
                id: null,
                key: 'versionControl',
                value: 'false',
            };
        }
        if (!preferences['locale']) {
            formattedPreferences['locale'] = { id: null, key: 'locale', value: 'en' };
        }
        if (!preferences['theme']) {
            formattedPreferences['theme'] = { id: null, key: 'theme', value: 'INTEF' };
        }

        // Add iDevice visibility preferences for all installed iDevices
        const idevices = await this.ideviceService.getInstalledIDevices();
        for (const idevice of idevices) {
            const prefKey = `preference-idevice-visibility-${idevice.name}`;
            if (!preferences[prefKey]) {
                formattedPreferences[prefKey] = { id: null, key: prefKey, value: 'true' };
            }
        }

        return {
            userPreferences: formattedPreferences,
        };
    }

    @Put('api/user/preferences')
    async saveUserPreferences(@Req() req: any, @Body() body: any) {
        // Get user ID from session or use default (req.user populated by SessionUserMiddleware)
        const userId = req.session?.userId || req.user?.email || 'user@exelearning.net';

        // Frontend sends preferences directly in body (form-urlencoded: locale=es&defaultLicense=...)
        // not wrapped in { preferences: {...} }
        const preferences = body;

        // Validate that body has properties
        if (!preferences || typeof preferences !== 'object' || Object.keys(preferences).length === 0) {
            return {
                responseMessage: 'ERROR',
                error: 'No preferences provided',
            };
        }

        try {
            // Save each preference key-value pair
            for (const [key, value] of Object.entries(preferences)) {
                // Handle both direct string values and { value: 'val' } format
                const preferenceValue =
                    typeof value === 'object' && value !== null && 'value' in value
                        ? (value as any).value
                        : String(value);

                await this.userPreferencesService.upsertPreference(userId, key, preferenceValue);
            }

            return { responseMessage: 'OK' };
        } catch (error) {
            console.error('Error saving user preferences:', error);
            return {
                responseMessage: 'ERROR',
                error: 'Failed to save preferences',
            };
        }
    }

    @Get('api/project/current')
    async getCurrentProject(@Req() req: any) {
        // Return null for now - no current project
        // TODO: Implement real project loading from session/database
        return null;
    }

    @Get('api/project/:odeSessionId/properties')
    async getOdeProperties(@Param('odeSessionId') odeSessionId: string) {
        this.logger.debug(`🔵 /api/project/${odeSessionId}/properties called`);

        // NOTE: With Yjs as source of truth, properties are managed via Y.Map('metadata')
        // This endpoint returns empty properties - frontend should use YjsPropertiesBinding
        this.logger.debug(`🔵 Properties now managed by Yjs - returning empty object`);

        return {
            odeProperties: {},
            odeVersionName: '1.0.0',
        };
    }

    @Get('api/config/upload-limits')
    async getUploadLimits() {
        // Get upload limit from environment configuration (in MB)
        const maxSizeMB = parseInt(
            this.configService.get<string>('FILE_UPLOAD_MAX_SIZE', '256'),
            10,
        );

        // Convert MB to bytes
        const maxFileSize = maxSizeMB * 1024 * 1024;
        const maxFileSizeFormatted = `${maxSizeMB} MB`;

        return {
            maxFileSize,
            maxFileSizeFormatted,
            limitingFactor: 'application',
            details: {
                phpPostMaxSize: maxFileSizeFormatted,
                phpUploadMaxFilesize: maxFileSizeFormatted,
                applicationMaxSize: maxFileSizeFormatted,
            },
        };
    }

    @Get('api/project/:odeId/last-updated')
    async getOdeLastUpdated(@Req() req: any) {
        // Return last updated timestamp
        // TODO: Implement real last updated from database
        return {
            lastUpdated: new Date().toISOString(),
        };
    }

    @Get('api/project/:odeId/version/:odeVersionId/session/:odeSessionId/users')
    async getOdeConcurrentUsers(@Req() req: any) {
        // Return concurrent users list
        // TODO: Implement real concurrent users from database
        return {
            currentUsers: [],
        };
    }

    @Get('api/project/version/:odeVersionId/session/:odeSessionId/structure')
    async getOdeStructure(
        @Param('odeVersionId') odeVersionId: string,
        @Param('odeSessionId') odeSessionId: string,
        @Req() req: any,
    ) {
        // If odeSessionId is "undefined", return empty structure
        // NOTE: With Yjs as source of truth, sessions are managed via Yjs documents, not CurrentOdeUsers
        const actualSessionId = odeSessionId;

        // If still no session ID, return empty structure with root navStructure
        if (!actualSessionId || actualSessionId === 'undefined') {
            return {
                structure: [],
                navStructure: { id: 'root', title: 'New page', children: [], level: 0, order: 0 },
            };
        }

        // PRIORITY 1: Check in-memory session first (Yjs source of truth)
        // This is critical for skipDbPersistence mode where DB is empty
        const memorySession = this.projectOpenService?.getSession(actualSessionId);
        this.logger.log(
            `[getOdeStructure] Session ${actualSessionId}: memorySession=${!!memorySession}, pages=${memorySession?.structure?.pages?.length || 0}`,
        );
        if (memorySession?.structure?.pages?.length > 0) {
            this.logger.log(
                `[getOdeStructure] Found ${memorySession.structure.pages.length} pages in memory session for ${actualSessionId}`,
            );
            // Log first 5 pages for debugging
            memorySession.structure.pages.slice(0, 5).forEach((p, i) => {
                this.logger.debug(
                    `  Page ${i}: id=${p.id}, title=${p.title}, parent_id=${p.parent_id || 'null'}`,
                );
            });

            // Use data from memory session (parsed from XML)
            // IMPORTANT: Use odePageId for both id and pageId so that parent references match
            const structure = memorySession.structure.pages.map((page) => ({
                id: page.id, // Use odePageId for consistency with parent references
                pageId: page.id, // Also provide pageId for frontend compatibility
                pageName: page.title || 'Untitled',
                parent: page.parent_id || 'root', // Frontend expects 'root' for null parent
                order: page.position + 1,
                level: page.level,
                properties: {} as Record<string, any>,
            }));

            // Build tree-shaped navStructure for frontend compatibility
            const nodeMap = new Map<string, any>();
            const roots: any[] = [];

            structure.forEach((node) => {
                const treeNode = {
                    id: node.pageId,
                    title: node.pageName,
                    parent: node.parent,
                    level: node.level || 0,
                    order: node.order,
                    children: [] as any[],
                };
                nodeMap.set(node.pageId, treeNode);
            });

            // Build parent-child relationships using pageId (which matches parent references)
            structure.forEach((node) => {
                const treeNode = nodeMap.get(node.pageId);
                if (node.parent && node.parent !== 'root' && nodeMap.has(node.parent)) {
                    nodeMap.get(node.parent).children.push(treeNode);
                } else {
                    roots.push(treeNode);
                }
            });

            const navStructure =
                roots.length === 1
                    ? roots[0]
                    : { id: 'root', title: 'root', children: roots, level: 0, order: 0 };

            return { structure, navStructure };
        }

        // No session found in memory - with Yjs as source of truth, return empty structure
        // Frontend should initialize Yjs document which will create the structure
        this.logger.warn(
            `[getOdeStructure] No memory session found for ${actualSessionId} - Yjs should be source of truth`,
        );
        return {
            structure: [],
            navStructure: { id: 'root', title: 'New page', children: [], level: 0, order: 0 },
        };
    }

    @Get('api/idevice/installed')
    async getInstalledIdevices(@Req() req: any) {
        // Get list of installed iDevices by scanning filesystem
        const idevices = await this.ideviceService.getInstalledIDevices();
        return { idevices };
    }

    @Get('api/theme/installed')
    async getInstalledThemes(@Req() req: any) {
        // Get list of installed themes by scanning filesystem
        const themes = await this.themeService.getInstalledThemes();
        return { themes };
    }

    @Post('api/project/clean/init/autosave/elp')
    async cleanInitAutosaveElp(@Req() req: any) {
        // Clean autosave files for user
        // TODO: Implement real autosave cleaning from filesystem
        return {
            success: true,
            message: 'Autosaves cleaned',
        };
    }

    @Post('api/ode-management/odes/remove/date/ode/files')
    async removeOdeFilesByDate(@Body() body: any, @Req() req: any) {
        // Remove ODE files by date
        // TODO: Implement real file removal from filesystem/database
        return {
            success: true,
            message: 'Files removed by date',
        };
    }

    @Put('api/ode-management/odes/properties/save')
    async saveOdeProperties(@Body() body: any, @Req() req: any) {
        const { odeSessionId, ...restParams } = body;

        if (!odeSessionId) {
            return {
                success: false,
                message: 'Missing odeSessionId',
            };
        }

        // NOTE: With Yjs as source of truth, properties are now managed via Y.Map('metadata')
        // Frontend should use YjsPropertiesBinding.updateYjsFromInput() instead of this endpoint
        // This endpoint returns success for backwards compatibility but does not persist to DB

        // Build odeProperties object from flat params for response
        const odeProperties: Record<string, string> = {};
        for (const [key, value] of Object.entries(restParams)) {
            if (value !== undefined && value !== null) {
                odeProperties[key] = String(value);
            }
        }

        this.logger.warn(
            `[saveOdeProperties] Called for session ${odeSessionId} - properties now managed by Yjs`,
        );

        return {
            success: true,
            message: 'Properties managed by Yjs - use YjsPropertiesBinding',
            odeProperties: odeProperties,
        };
    }

    @Post('api/current-ode-users-management/current-ode-user/current/ode/users/update/flag')
    async currentOdeUsersUpdateFlag(@Body() body: any, @Req() req: any) {
        // Update flag for concurrent users
        // TODO: Implement real concurrent user notification via Mercure/WebSocket
        return {
            success: true,
            message: 'Update flag activated',
        };
    }

    @Post('api/ode-management/odes/check/before/leave/ode/session')
    async checkBeforeLeaveOdeSession(@Body() body: any, @Req() req: any) {
        const { odeSessionId } = body || {};

        if (!odeSessionId) {
            return {
                responseMessage: 'error: invalid data',
            };
        }

        // Placeholder behaviour (no DB check yet):
        // - Assume no pending changes
        // - Allow user to leave directly, mirroring legacy keys expected by the UI
        return {
            leaveSession: true,
            askSave: false,
            leaveEmptySession: false,
            responseMessage: 'OK',
        };
    }

    @Post('api/ode-management/odes/ode/session/close')
    @HttpCode(HttpStatus.OK)
    async closeOdeSession(@Body() body: any, @Req() req: any) {
        const { odeSessionId } = body || {};

        if (!odeSessionId) {
            this.logger.error('[Close Session] Missing odeSessionId in request body');
            return {
                responseMessage: 'error: invalid data',
            };
        }

        try {
            this.logger.log(`[Close Session] Closing session: ${odeSessionId}`);

            // Use SessionManagerService to properly close the session
            // This will:
            // 1. Hard delete CurrentOdeUsers records from database
            // 2. Soft delete navigation/page/component structures
            // 3. Remove session from in-memory storage
            if (!this.sessionManagerService) {
                this.logger.warn(
                    '[Close Session] SessionManagerService not available, returning stub response.',
                );
                return {
                    responseMessage: 'OK',
                    odeNavStructureSyncsDeleted: 0,
                    odePagStructureSyncsDeleted: 0,
                    odeComponentsSyncsDeleted: 0,
                    currentOdeUsersDeleted: 0,
                };
            }

            const result = await this.sessionManagerService.closeSession(odeSessionId);

            this.logger.log(`[Close Session] ✓ Session closed successfully: ${odeSessionId}`);
            this.logger.debug(
                `[Close Session] Deleted: ${result.navDeleted} nav, ${result.pagDeleted} pag, ${result.compDeleted} comp`,
            );

            return {
                responseMessage: 'OK',
                odeNavStructureSyncsDeleted: result.navDeleted,
                odePagStructureSyncsDeleted: result.pagDeleted,
                odeComponentsSyncsDeleted: result.compDeleted,
                currentOdeUsersDeleted: 1, // At least one user was in the session
            };
        } catch (error) {
            this.logger.error(`[Close Session] Error closing session ${odeSessionId}:`, error);
            return {
                responseMessage: `error: ${error.message}`,
                odeNavStructureSyncsDeleted: 0,
                currentOdeUsersDeleted: 0,
            };
        }
    }

    @Get('api/ode-management/odes/:odeId/last-updated')
    async getLastUpdated(@Param('odeId') odeId: string, @Req() req: any) {
        // Get last updated timestamp for ODE
        // TODO: Implement real timestamp tracking from database
        return {
            lastUpdated: Date.now(),
            odeId,
        };
    }

    @Post('api/ode-management/odes/ode/save/manual')
    async saveOdeManual(@Body() body: any, @Req() req: any) {
        const { odeSessionId } = body;

        // Validate odeSessionId
        if (!odeSessionId) {
            this.logger.error('[Manual Save] Missing odeSessionId in request body');
            return {
                responseMessage: 'error: invalid data',
            };
        }

        // Check if version control is enabled (matches Symfony line 139)
        const versionControl = this.configService.get<string>('VERSION_CONTROL', 'true') === 'true';

        if (!versionControl) {
            this.logger.error('[Manual Save] Version control is disabled');
            return {
                responseMessage: 'error: version control desactivated',
            };
        }

        try {
            // Get user email from session (req.user populated by SessionUserMiddleware)
            const userEmail = req.session?.email || req.user?.email;

            if (!userEmail) {
                this.logger.error('[Manual Save] No user found in session');
                return {
                    responseMessage: 'error: user not authenticated',
                };
            }

            // NOTE: With Yjs as source of truth, concurrent editing is handled by Yjs CRDT
            // NOTE: With Yjs as source of truth, export/save is handled client-side
            // This endpoint is deprecated for manual saves - use Yjs document export instead
            this.logger.log(
                `[Manual Save] DEPRECATED: Save for session ${odeSessionId} - use Yjs export instead`,
            );

            // Return success stub - actual export is handled client-side via ElpExporter
            return {
                responseMessage: 'OK',
                message: 'Save handled client-side via Yjs export',
            };
        } catch (error) {
            this.logger.error(
                `[Manual Save] Error during manual save for session ${odeSessionId}:`,
                error,
            );
            return {
                responseMessage: `error: ${error.message}`,
            };
        }
    }

    @Post('api/ode-management/odes/ode/save/auto')
    async saveOdeAuto(@Body() body: any, @Req() req: any) {
        // Auto save endpoint
        // TODO: Implement real autosave to database/file system
        return {
            success: true,
            message: 'Auto save completed (placeholder)',
            timestamp: Date.now(),
        };
    }

    @Get('login/cas')
    async casLogin(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
        const methods = this.authMethods();
        if (!methods.includes('cas')) {
            return res
                .code(404)
                .view('security/error', { error: 'CAS authentication is not enabled.' });
        }

        const casUrl = (this.configService.get<string>('CAS_URL') || '').replace(/\/$/, '');
        const casLoginPath = (this.configService.get<string>('CAS_LOGIN_PATH') || '/login').replace(
            /^\//,
            '',
        );

        if (!casUrl || !casLoginPath) {
            return res
                .code(500)
                .view('security/error', { error: 'CAS authentication is misconfigured.' });
        }

        const serviceUrl = buildAbsoluteUrl(req, '/login/cas/callback');

        if ((req as any).session) {
            (req as any).session.authMethodUsed = 'cas';
            (req as any).session.postLoginRedirect = (req as any).session.targetPath || '/workarea';
        }

        const loginUrl = `${casUrl}/${casLoginPath}?service=${encodeURIComponent(serviceUrl)}`;
        return res.redirect(loginUrl);
    }

    @Get('login/cas/callback')
    async casCallback(@Req() req: FastifyRequest, @Res() res: FastifyReply, @Query('ticket') ticket?: string) {
        const methods = this.authMethods();
        if (!methods.includes('cas')) {
            return res
                .code(404)
                .view('security/error', { error: 'CAS authentication is not enabled.' });
        }

        if (!ticket) {
            return res.code(400).view('security/error', { error: 'Missing CAS ticket.' });
        }

        const casUrl = (this.configService.get<string>('CAS_URL') || '').replace(/\/$/, '');
        const casValidatePath = (
            this.configService.get<string>('CAS_VALIDATE_PATH') || '/p3/serviceValidate'
        ).replace(/^\//, '');
        if (!casUrl || !casValidatePath) {
            return res
                .code(500)
                .view('security/error', { error: 'CAS authentication is misconfigured.' });
        }

        const serviceUrl = buildAbsoluteUrl(req, '/login/cas/callback');
        const fetchFn = (global as any).fetch;

        if (!fetchFn) {
            return res.code(500).view('security/error', {
                error: 'Fetch API is not available to perform CAS validation.',
            });
        }

        try {
            const validateUrl = `${casUrl}/${casValidatePath}?service=${encodeURIComponent(serviceUrl)}&ticket=${encodeURIComponent(ticket)}`;
            const response = await fetchFn(validateUrl);
            const body = await response.text();
            const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
            const parsed = parser.parse(body);
            const authSuccess = parsed?.serviceResponse?.authenticationSuccess;
            const casUser = authSuccess?.user;

            if (!authSuccess || !casUser) {
            return res
                .code(401)
                .view('security/error', { error: 'CAS authentication failed.' });
            }

            const attributes = authSuccess.attributes || {};
            const pickAttribute = (value: any) => (Array.isArray(value) ? value[0] : value);
            const email =
                pickAttribute(attributes.mail) ||
                pickAttribute(attributes.email) ||
                pickAttribute(attributes.mailAddress) ||
                pickAttribute(attributes['cas:mail']);

            // Detect browser locale for new user preference
            const browserLocale = this.localeService.parseAcceptLanguageHeader(req) || 'en';

            const user = await this.authService.findOrCreateExternalUser(
                `cas:${casUser}`,
                email || undefined,
                ['ROLE_USER'],
                browserLocale,
            );

            if ((req as any).session) {
                (req as any).session.userId = user.id;
                (req as any).session.email = user.email;
                (req as any).session.authMethodUsed = 'cas';
                (req as any).session.isGuest = false;
                (req as any).session.casAttributes = attributes;
            }

            return res.redirect(this.targetAfterLogin(req));
        } catch (error) {
            console.error('CAS authentication error:', error);
            return res.code(500).view('security/error', {
                error: 'CAS authentication failed. Please try again later.',
            });
        }
    }

    @Get('login/openid')
    async openidLogin(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
        const methods = this.authMethods();
        if (!methods.includes('openid')) {
            return res
                .code(404)
                .view('security/error', { error: 'OpenID authentication is not enabled.' });
        }

        const authorizeEndpoint = this.configService.get<string>('OIDC_AUTHORIZATION_ENDPOINT');
        if (!authorizeEndpoint) {
            return res
                .code(500)
                .view('security/error', { error: 'OpenID Connect is misconfigured.' });
        }

        const state = randomBytes(16).toString('hex');
        const nonce = randomBytes(16).toString('hex');
        const codeVerifier = randomBytes(32).toString('hex');
        const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
        const redirectUri = buildAbsoluteUrl(req, '/login/openid/callback');
        const scope = this.configService.get<string>('OIDC_SCOPE') || 'openid email';

        if ((req as any).session) {
            (req as any).session.authMethodUsed = 'oidc';
            (req as any).session.oidcState = state;
            (req as any).session.oidcNonce = nonce;
            (req as any).session.oidcCodeVerifier = codeVerifier;
        }

        const params = new URLSearchParams({
            client_id: this.configService.get<string>('OIDC_CLIENT_ID') || '',
            redirect_uri: redirectUri,
            response_type: 'code',
            scope,
            state,
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            prompt: 'consent',
        });

        return res.redirect(`${authorizeEndpoint}?${params.toString()}`);
    }

    @Get('login/openid/callback')
    async openidCallback(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Query() query: Record<string, string>,
    ) {
        const methods = this.authMethods();
        if (!methods.includes('openid')) {
            return res
                .code(404)
                .view('security/error', { error: 'OpenID authentication is not enabled.' });
        }

        if (query.error) {
            return res
                .code(400)
                .view('security/error', { error: query.error_description || query.error });
        }

        if ((req as any).session?.oidcState && query.state !== (req as any).session.oidcState) {
            return res
                .code(400)
                .view('security/error', { error: 'Invalid OpenID Connect state.' });
        }

        const tokenEndpoint = this.configService.get<string>('OIDC_TOKEN_ENDPOINT');
        if (!tokenEndpoint) {
            return res
                .code(500)
                .view('security/error', { error: 'OpenID Connect is misconfigured.' });
        }

        const fetchFn = (global as any).fetch;
        if (!fetchFn) {
            return res.code(500).view('security/error', {
                error: 'Fetch API is not available to perform OpenID Connect flow.',
            });
        }

        try {
            const redirectUri = buildAbsoluteUrl(req, '/login/openid/callback');
            const tokenResponse = await fetchFn(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: this.configService.get<string>('OIDC_CLIENT_ID') || '',
                    client_secret: this.configService.get<string>('OIDC_CLIENT_SECRET') || '',
                    redirect_uri: redirectUri,
                    code: query.code || '',
                    code_verifier: (req as any).session?.oidcCodeVerifier || '',
                }),
            });

            const tokenJson = await tokenResponse.json();
            const accessToken = tokenJson.access_token as string | undefined;
            const idToken = tokenJson.id_token as string | undefined;

            if ((req as any).session) {
                (req as any).session.oidcAccessToken = accessToken;
                (req as any).session.oidcIdToken = idToken;
            }

            let userEmail: string | undefined;
            let subject: string | undefined;
            const idPayload = decodeJwtPayload(idToken);
            if (idPayload) {
                userEmail = idPayload.email || idPayload.preferred_username;
                subject = idPayload.sub;
            }

            if (!userEmail && accessToken) {
                const userinfoEndpoint = this.configService.get<string>('OIDC_USERINFO_ENDPOINT');
                if (userinfoEndpoint) {
                    try {
                        const userinfoResponse = await fetchFn(userinfoEndpoint, {
                            headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        const userinfo = await userinfoResponse.json();
                        userEmail = userinfo.email || userinfo.preferred_username;
                        subject = userinfo.sub || subject;
                    } catch (userinfoError) {
                        console.warn('Failed to load userinfo:', userinfoError);
                    }
                }
            }

            const identifier = `oidc:${subject || userEmail || 'user'}`;

            // Detect browser locale for new user preference
            const browserLocale = this.localeService.parseAcceptLanguageHeader(req) || 'en';

            const user = await this.authService.findOrCreateExternalUser(
                identifier,
                userEmail,
                ['ROLE_USER'],
                browserLocale,
            );

            if ((req as any).session) {
                (req as any).session.userId = user.id;
                (req as any).session.email = user.email;
                (req as any).session.authMethodUsed = 'oidc';
                (req as any).session.isGuest = false;
            }

            const redirectTarget = this.targetAfterLogin(req);
            const redirectUrl = this.appendAccessToken(redirectTarget, accessToken || idToken);

            if ((req as any).session) {
                delete (req as any).session.oidcState;
                delete (req as any).session.oidcCodeVerifier;
            }

            return res.redirect(redirectUrl);
        } catch (error) {
            console.error('OpenID authentication error:', error);
            return res.code(500).view('security/error', {
                error: 'OpenID authentication failed. Please try again later.',
            });
        }
    }

    @Get('logout/redirect')
    async logoutRedirect(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
        const method = (req as any).session?.authMethodUsed;
        const idToken = (req as any).session?.oidcIdToken;
        const accessToken = (req as any).session?.oidcAccessToken;
        const fetchFn = (global as any).fetch;
        let redirectUrl: string | null = null;

        try {
            if (method === 'cas') {
                const casUrl = (this.configService.get<string>('CAS_URL') || '').replace(/\/$/, '');
                const casLogoutPath = (
                    this.configService.get<string>('CAS_LOGOUT_PATH') || '/logout'
                ).replace(/^\//, '');
                if (casUrl && casLogoutPath) {
                    const service = buildAbsoluteUrl(req, '/login');
                    redirectUrl = `${casUrl}/${casLogoutPath}?service=${encodeURIComponent(service)}`;
                }
            } else if (method === 'oidc') {
                const issuer = this.configService.get<string>('OIDC_ISSUER') || '';
                const discoveryUrl = issuer
                    ? `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`
                    : '';
                if (discoveryUrl && fetchFn) {
                    try {
                        const discoveryResponse = await fetchFn(discoveryUrl);
                        const discovery = await discoveryResponse.json();
                        const endSession = discovery.end_session_endpoint;
                        if (endSession) {
                            const params = new URLSearchParams({
                                post_logout_redirect_uri: buildAbsoluteUrl(req, '/login'),
                            });
                            if (idToken) {
                                params.append('id_token_hint', idToken);
                            }
                            const clientId = this.configService.get<string>('OIDC_CLIENT_ID');
                            if (clientId) {
                                params.append('client_id', clientId);
                            }
                            redirectUrl = `${endSession}?${params.toString()}`;
                        }
                    } catch (dsError) {
                        console.warn('OIDC discovery failed during logout:', dsError);
                    }
                }

                if (
                    !redirectUrl &&
                    issuer.includes('accounts.google.com') &&
                    accessToken &&
                    fetchFn
                ) {
                    try {
                        await fetchFn('https://oauth2.googleapis.com/revoke', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({ token: accessToken }),
                        });
                    } catch (revokeError) {
                        console.warn('Failed to revoke Google token:', revokeError);
                    }
                    redirectUrl = prefixPath('/login');
                }
            }
        } finally {
            if ((req as any).session) {
                (req as any).session.destroy(() => {
                    return res.redirect(redirectUrl || prefixPath('/login'));
                });
            } else {
                return res.redirect(redirectUrl || prefixPath('/login'));
            }
        }
    }

    private appendAccessToken(redirectUrl: string, token?: string): string {
        if (!token) return redirectUrl;
        const separator = redirectUrl.includes('?') ? '&' : '?';
        return `${redirectUrl}${separator}access_token=${encodeURIComponent(token)}`;
    }

    // Form-based login endpoints (compatibilidad con Symfony)
    @Post('login_check')
    async loginCheck(
        @Body() body: { email: string; password: string; _csrf_token?: string },
        @Req() req: any,
        @Res() res: FastifyReply,
    ) {
        try {
            console.log('Login attempt:', { email: body.email });

            // Validate user credentials against database
            const user = await this.authService.validateUser(body.email, body.password);

            console.log('User validation result:', user ? 'Found' : 'Not found');

            if (!user) {
                console.log('Invalid credentials for:', body.email);
                return res.redirect( prefixPath('/login?error=invalid_credentials'));
            }

            // Save user info in session
            req.session.userId = user.id;
            req.session.email = user.email;
            req.session.authMethodUsed = 'password';
            req.session.isGuest = false;

            console.log('Login successful for:', body.email);
            return res.redirect( this.targetAfterLogin(req));
        } catch (error) {
            console.error('Login error:', error);
            console.error('Error stack:', error.stack);
            return res.redirect( prefixPath('/login?error=server_error'));
        }
    }

    @Post('login/guest')
    async guestLogin(
        @Body() body: { guest_login_nonce?: string },
        @Req() req: any,
        @Res() res: FastifyReply,
    ) {
        console.log('Guest login attempt');

        // Ensure request and session objects exist (test env may omit session middleware)
        req = req || {};
        req.session = req.session || {};

        if (
            req.session?.guestLoginNonce &&
            body.guest_login_nonce !== req.session.guestLoginNonce
        ) {
            return res
                .code(403)
                .view('security/error', { error: 'Invalid guest login request.' });
        }

        // Detect browser locale for new user preference
        const browserLocale = this.localeService.parseAcceptLanguageHeader(req) || 'en';

        // Generate unique guest identifier
        const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const guestEmail = `${guestId}@guest.local`;

        // Create real user in database (same as CAS/OIDC users)
        // This ensures session.userId is always a numeric DB ID
        const user = await this.authService.findOrCreateExternalUser(
            `guest:${guestId}`,
            guestEmail,
            ['ROLE_GUEST'],
            browserLocale,
        );

        // Set guest session with real user ID from database
        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.isGuest = true; // Keep flag for UI differentiation
        req.session.authMethodUsed = 'guest';

        console.log('Guest login successful:', guestId, '-> DB user ID:', user.id);
        return res.redirect( this.targetAfterLogin(req));
    }

    /**
     * Get resource lock timeout
     * GET /api/resource-lock/get/timeout
     *
     * Returns the timeout in seconds for collaborative editing resource locks.
     * Used by frontend to set inactivity timers for editing sessions.
     */
    @Get('api/resource-lock/get/timeout')
    async getResourceLockTimeout(): Promise<string> {
        return Constants.RESOURCE_LOCK_TIMEOUT_SECONDS.toString();
    }

    /**
     * Import ELP file at root level (end of tree)
     * POST /api/ode-management/odes/ode/import/local/root
     *
     * Imports pages from an ELP file into the target session at root level.
     * Pages are added at the end of the navigation tree.
     *
     * Request body:
     * - odeSessionId: Target session ID
     * - file: Uploaded ELP file (via FormData)
     *
     * Matches Symfony's OdeApiController::importLocalElpPagesInRootAction
     */
    @Post('api/ode-management/odes/ode/import/local/root')
    @HttpCode(HttpStatus.OK)
    async importElpAtRoot(@Body() body: any, @Req() req: any) {
        try {
            const { odeSessionId, filePath, odeFilePath } = body;

            if (!odeSessionId) {
                return {
                    responseMessage: 'error',
                    message: 'Missing odeSessionId',
                };
            }

            // Accept both filePath and odeFilePath (frontend sends odeFilePath)
            const sourceFilePath = filePath || odeFilePath;

            if (!sourceFilePath) {
                return {
                    responseMessage: 'error',
                    message: 'Missing file path',
                };
            }

            if (!this.projectImportService) {
                this.logger.warn('[Import] ProjectImportService not available');
                return {
                    responseMessage: 'error',
                    message: 'Import service not available',
                };
            }

            // Import at root level (parentPageId = null)
            const result = await this.projectImportService.importElpPages({
                targetSessionId: odeSessionId,
                parentPageId: null,
                sourceElpPath: sourceFilePath,
                copyResources: true,
            });

            this.logger.log(
                `✅ [Import] Imported ${result.importedPagesCount} pages at root level for session ${odeSessionId}`,
            );

            return {
                responseMessage: 'OK',
                message: result.message,
                importedPagesCount: result.importedPagesCount,
                createdPageIds: result.createdPageIds,
            };
        } catch (error) {
            this.logger.error(`[Import] Failed to import at root: ${error.message}`, error.stack);
            return {
                responseMessage: 'error',
                message: error.message,
            };
        }
    }

    /**
     * Alternative root import endpoint
     * POST /api/ode-management/odes/ode/local/elp/import-root
     *
     * Alternative endpoint for importing at root level.
     * Functionally identical to /api/ode-management/odes/ode/import/local/root
     */
    @Post('api/ode-management/odes/ode/local/elp/import-root')
    @HttpCode(HttpStatus.OK)
    async importElpAtRootAlt(@Body() body: any, @Req() req: any) {
        // Delegate to the main root import endpoint
        return this.importElpAtRoot(body, req);
    }

    /**
     * Import ELP file under specific navigation node
     * POST /api/nav-structure-management/nav-structures/:odeNavStructureSyncId/import-elp
     *
     * Imports pages from an ELP file as children of the specified navigation node.
     *
     * Request body:
     * - odeSessionId: Target session ID
     * - file: Uploaded ELP file (via FormData)
     *
     * URL param:
     * - odeNavStructureSyncId: Parent navigation node ID
     *
     * Matches Symfony's NavStructureApiController::importElpPagesAction
     */
    @Post('api/nav-structure-management/nav-structures/:odeNavStructureSyncId/import-elp')
    @HttpCode(HttpStatus.OK)
    async importElpAsChild(
        @Param('odeNavStructureSyncId') odeNavStructureSyncId: string,
        @Body() body: any,
        @Req() req: any,
    ) {
        try {
            const { odeSessionId, filePath, odeFilePath } = body;

            if (!odeSessionId) {
                return {
                    responseMessage: 'error',
                    message: 'Missing odeSessionId',
                };
            }

            // Accept both filePath and odeFilePath (frontend sends odeFilePath)
            const sourceFilePath = filePath || odeFilePath;

            if (!sourceFilePath) {
                return {
                    responseMessage: 'error',
                    message: 'Missing file path',
                };
            }

            // For Yjs, we use the pageId directly (not a numeric ID)
            const parentPageId = odeNavStructureSyncId;
            if (!parentPageId) {
                return {
                    responseMessage: 'error',
                    message: 'Invalid odeNavStructureSyncId',
                };
            }

            if (!this.projectImportService) {
                this.logger.warn('[Import] ProjectImportService not available');
                return {
                    responseMessage: 'error',
                    message: 'Import service not available',
                };
            }

            // Import as child of specific node
            const result = await this.projectImportService.importElpPages({
                targetSessionId: odeSessionId,
                parentPageId,
                sourceElpPath: sourceFilePath,
                copyResources: true,
            });

            this.logger.log(
                `✅ [Import] Imported ${result.importedPagesCount} pages under page ${parentPageId} for session ${odeSessionId}`,
            );

            return {
                responseMessage: 'OK',
                message: result.message,
                importedPagesCount: result.importedPagesCount,
                createdPageIds: result.createdPageIds,
            };
        } catch (error) {
            this.logger.error(`[Import] Failed to import as child: ${error.message}`, error.stack);
            return {
                responseMessage: 'error',
                message: error.message,
            };
        }
    }

    /**
     * Import ELP file with direct file upload (root level)
     * POST /api/ode-management/odes/ode/local/elp/import-root
     *
     * Receives file directly via multipart/form-data and imports at root level.
     * Used by navigation menu when importing from "File" menu.
     *
     * Matches Symfony's behavior for direct file upload import.
     */
    @Post('api/ode-management/odes/ode/local/elp/import-root-upload')
    @HttpCode(HttpStatus.OK)
    async importElpAtRootWithUpload(@Req() req: FastifyRequest) {
        try {
            // Handle multipart file upload with Fastify
            if (!(req as any).isMultipart || !(req as any).isMultipart()) {
                return {
                    responseMessage: 'error',
                    message: 'Expected multipart/form-data request',
                };
            }

            const data = await (req as any).file();
            if (!data) {
                this.logger.error('[Import Root] No file received');
                return {
                    responseMessage: 'error',
                    message: 'No file uploaded',
                };
            }

            const fileBuffer = await data.toBuffer();
            const fields = data.fields as Record<string, { value: string }>;
            const odeSessionId = fields.odeSessionId?.value;

            this.logger.debug(`[Import Root] Received file: ${data.filename}`);
            this.logger.debug(`[Import Root] odeSessionId: ${odeSessionId}`);

            if (!odeSessionId) {
                return {
                    responseMessage: 'error',
                    message: 'Missing odeSessionId',
                };
            }

            if (!this.projectImportService) {
                this.logger.warn('[Import] ProjectImportService not available');
                return {
                    responseMessage: 'error',
                    message: 'Import service not available',
                };
            }

            // Save file to temp location for import
            const tempDir = path.join(process.cwd(), 'temp');
            await fs.ensureDir(tempDir);
            const sourceFilePath = path.join(tempDir, `import_${Date.now()}_${data.filename}`);
            await fs.writeFile(sourceFilePath, fileBuffer);

            try {
                // Import at root level (parentPageId = null)
                const result = await this.projectImportService.importElpPages({
                    targetSessionId: odeSessionId,
                    parentPageId: null,
                    sourceElpPath: sourceFilePath,
                    copyResources: true,
                });

                this.logger.log(
                    `✅ [Import] Imported ${result.importedPagesCount} pages at root level for session ${odeSessionId}`,
                );

                return {
                    responseMessage: 'OK',
                    message: result.message,
                    importedPagesCount: result.importedPagesCount,
                    createdPageIds: result.createdPageIds,
                };
            } finally {
                // Clean up temp file
                if (await fs.pathExists(sourceFilePath)) {
                    await fs.remove(sourceFilePath);
                }
            }
        } catch (error) {
            this.logger.error(
                `[Import] Failed to import at root with upload: ${error.message}`,
                error.stack,
            );
            return {
                responseMessage: 'error',
                message: error.message,
            };
        }
    }

    @Get('logout')
    async logout(@Req() req: any, @Res() res: FastifyReply) {
        // Defer cleanup to logout/redirect to preserve provider tokens
        if (req.session) {
            req.session.postLogoutRedirect =
                req.session.postLogoutRedirect || prefixPath('/login');
        }

        return res.redirect( prefixPath('/logout/redirect'));
    }

    /**
     * Get iDevices by session ID for progress report
     * GET /api/games/:odeSessionId/idevices
     *
     * Returns all iDevices in the session with their navigation structure.
     * Used by the progress-report iDevice to display all evaluable activities.
     */
    @Get('api/games/:odeSessionId/idevices')
    async getIdevicesBySessionId(@Param('odeSessionId') odeSessionId: string) {
        this.logger.debug(`[Games] Getting iDevices for session: ${odeSessionId}`);

        if (!odeSessionId || odeSessionId === 'undefined') {
            return { data: [] };
        }

        // Get session from memory (Yjs is source of truth)
        const session = this.projectOpenService?.getSession(odeSessionId);

        if (!session?.structure?.raw?.ode?.odeNavStructures?.odeNavStructure) {
            this.logger.warn(`[Games] No session or structure found for: ${odeSessionId}`);
            return { data: [] };
        }

        const navStructures = session.structure.raw.ode.odeNavStructures.odeNavStructure;
        const navArray = Array.isArray(navStructures) ? navStructures : [navStructures];

        // Transform to the format expected by progress-report
        const result: any[] = [];
        let navOrder = 0;

        for (const nav of navArray) {
            navOrder++;
            const pageId = nav.odePageId;
            const parentPageId = nav.odeParentPageId || null;
            const pageName = nav.pageName || 'Untitled';

            // Get page structures (blocks with components)
            const pagStructures = nav.odePagStructures?.odePagStructure;
            const pagArray = pagStructures
                ? Array.isArray(pagStructures)
                    ? pagStructures
                    : [pagStructures]
                : [];

            if (pagArray.length === 0) {
                // Page without components - still include for structure
                result.push({
                    odePageId: pageId,
                    odeParentPageId: parentPageId,
                    pageName: pageName,
                    navId: pageId,
                    ode_nav_structure_sync_id: pageId,
                    ode_session_id: odeSessionId,
                    ode_nav_structure_sync_order: navOrder,
                    navIsActive: true,
                    componentId: null,
                    htmlViewer: null,
                    jsonProperties: null,
                    ode_idevice_id: null,
                    ode_pag_structure_sync_id: null,
                    componentSessionId: null,
                    componentPageId: null,
                    ode_block_id: null,
                    blockName: null,
                    odeIdeviceTypeName: null,
                    ode_components_sync_order: null,
                    componentIsActive: null,
                });
            } else {
                for (const pag of pagArray) {
                    const blockId = pag.odeBlockId;
                    const blockName = pag.blockName || '';

                    // Get components in this block
                    const components = pag.odeComponents?.odeComponent;
                    const compArray = components
                        ? Array.isArray(components)
                            ? components
                            : [components]
                        : [];

                    if (compArray.length === 0) {
                        // Block without components
                        result.push({
                            odePageId: pageId,
                            odeParentPageId: parentPageId,
                            pageName: pageName,
                            navId: pageId,
                            ode_nav_structure_sync_id: pageId,
                            ode_session_id: odeSessionId,
                            ode_nav_structure_sync_order: navOrder,
                            navIsActive: true,
                            componentId: null,
                            htmlViewer: null,
                            jsonProperties: null,
                            ode_idevice_id: null,
                            ode_pag_structure_sync_id: blockId,
                            componentSessionId: null,
                            componentPageId: pageId,
                            ode_block_id: blockId,
                            blockName: blockName,
                            odeIdeviceTypeName: null,
                            ode_components_sync_order: null,
                            componentIsActive: null,
                        });
                    } else {
                        for (const comp of compArray) {
                            result.push({
                                odePageId: pageId,
                                odeParentPageId: parentPageId,
                                pageName: pageName,
                                navId: pageId,
                                ode_nav_structure_sync_id: pageId,
                                ode_session_id: odeSessionId,
                                ode_nav_structure_sync_order: navOrder,
                                navIsActive: true,
                                componentId: comp.odeIdeviceId || blockId,
                                htmlViewer: comp.htmlView || null,
                                jsonProperties: comp.jsonProperties || null,
                                ode_idevice_id: comp.odeIdeviceId || null,
                                ode_pag_structure_sync_id: blockId,
                                componentSessionId: odeSessionId,
                                componentPageId: pageId,
                                ode_block_id: blockId,
                                blockName: blockName,
                                odeIdeviceTypeName: comp.odeIdeviceTypeName || null,
                                ode_components_sync_order: comp.odeComponentsOrder || 0,
                                componentIsActive: true,
                            });
                        }
                    }
                }
            }
        }

        this.logger.debug(`[Games] Returning ${result.length} iDevice records for session ${odeSessionId}`);
        return { data: result };
    }
}
