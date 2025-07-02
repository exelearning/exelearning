<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Properties;
use App\Settings;
use App\Util\net\exelearning\Util\UrlUtil;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Route('/api/parameter-management/parameters')]
class ParameterApiController extends DefaultApiController
{
    private $router;
    private $translator;
    private $userHelper;

    public function __construct(EntityManagerInterface $entityManager, LoggerInterface $logger, UrlGeneratorInterface $router, TranslatorInterface $translator, UserHelper $userHelper)
    {
        $this->router = $router;
        $this->translator = $translator;
        $this->userHelper = $userHelper;

        parent::__construct($entityManager, $logger);
    }

    #[Route('/data/list', methods: ['GET'], name: 'api_parameters_data_list')]
    public function getParametersDataAction(Request $request)
    {
        $userLogged = $this->getUser();

        // Get properties of user
        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($userLogged);

        // Override the default locale of the application according to the user's language preferences
        if (!empty($databaseUserPreferences['locale'])) {
            $localeValue = $databaseUserPreferences['locale']->getValue();

            if (empty($localeValue)) {
                // Use default browser locale if user's locale is empty
                $localeValue = $request->getLocale();
            }

            $request->setLocale($localeValue);
            $request->setDefaultLocale($localeValue);
            $this->translator->setLocale($localeValue);
        }

        $data = [];

        $data['detectedLocale'] = $localeValue;
        $data['temporaryContentStorageDirectory'] = UrlUtil::getTemporaryContentStorageUrl();
        $data['generateNewItemKey'] = Constants::GENERATE_NEW_ITEM_KEY;
        $data['locales'] = Settings::LOCALES;
        $data['csvItemSeparator'] = Constants::CSV_ITEM_SEPARATOR;
        $data['versionControl'] = Settings::VERSION_CONTROL;
        $data['autosaveOdeFilesFunction'] = Settings::AUTOSAVE_ODE_FILES_FUNCTION;
        $data['autosaveIntervalTime'] = Settings::PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL;
        $data['countUserAutosave'] = Settings::COUNT_USER_AUTOSAVE_SPACE_ODE_FILES;

        // iDevice info
        $data['ideviceInfoFieldsConfig'] = $this->getProcessedPropertiesConfig(
            Properties::IDEVICE_INFO_FIELDS_CONFIG
        );

        // Theme info
        $data['themeInfoFieldsConfig'] = $this->getProcessedPropertiesConfig(
            Properties::THEME_INFO_FIELDS_CONFIG
        );

        // Theme edition
        $data['themeEditionFieldsConfig'] = $this->getProcessedPropertiesConfig(
            Properties::THEME_EDITION_FIELDS_CONFIG
        );

        // Properties
        $data['odeComponentsSyncPropertiesConfig'] = $this->getProcessedPropertiesConfig(
            Properties::ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG
        );
        $data['odePagStructureSyncPropertiesConfig'] = $this->getProcessedPropertiesConfig(
            Properties::ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG
        );
        $data['odeNavStructureSyncPropertiesConfig'] = $this->getProcessedPropertiesConfig(
            Properties::ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG
        );
        $data['odeProjectSyncPropertiesConfig'] = $this->getProcessedPropertiesOdeConfig(
            Properties::ODE_PROPERTIES_CONFIG
        );
        $data['odeProjectSyncCataloguingConfig'] = $this->getProcessedPropertiesOdeConfig(
            Properties::ODE_CATALOGUING_CONFIG
        );

        // Preferences
        $data['userPreferencesConfig'] = $this->getProcessedPropertiesConfig(
            Properties::USER_PREFERENCES_CONFIG
        );

        $data['routes'] = [];

        $router = $this->router;
        $routes = $router->getRouteCollection();

        $basePath = $this->getParameter('base_path');

        foreach ($routes as $key => $route) {
            $path = $route->getPath();
            if (0 === strpos($path, $basePath.'/api/')) {
                $data['routes'][$key] = [
                    'path' => $path,
                    'methods' => $route->getMethods(),
                ];
            }
        }

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * Returns processed properties config of elements.
     *
     * @param array $configArray
     *
     * @return array
     */
    private function getProcessedPropertiesConfig($configArray)
    {
        $result = [];

        foreach ($configArray as $key => $value) {
            if (is_array($value)) {
                $result[$key] = $this->getProcessedPropertiesConfig($value);
            } else {
                if (
                    (!empty($value))
                    && (0 === strpos($value, Properties::TRANS_PREFIX))
                ) {
                    $value = str_replace(Properties::TRANS_PREFIX, '', $value);
                    $value = $this->translator->trans($value);
                }
                $result[$key] = $value;
            }
        }

        return $result;
    }

    /**
     * Returns processed ode properties config of elements.
     *
     * @param array $configArray
     *
     * @return array
     */
    private function getProcessedPropertiesOdeConfig($configArray)
    {
        $result = [];

        foreach ($configArray as $key => $value) {
            if ('category' == $key) {
                // Set category title
                $value = [$value => Properties::PROPERTIES_CATEGORIES_TITLE[$value]];
            }

            // Translations
            if (is_array($value)) {
                // Ode properties groups
                if ('groups' == $key) {
                    $newGroupsArray = [];
                    foreach ($value as $i => $groupKey) {
                        // Set group title
                        $newGroupsArray[$groupKey] = Properties::GROUPS_TITLE[$groupKey];
                    }
                    $value = $newGroupsArray;
                }
                $result[$key] = $this->getProcessedPropertiesOdeConfig($value);
            } else {
                if (
                    (!empty($value))
                    && (0 === strpos($value, Properties::TRANS_PREFIX))
                ) {
                    $value = str_replace(Properties::TRANS_PREFIX, '', $value);
                    $value = $this->translator->trans($value);
                }
                $result[$key] = $value;
            }
        }

        return $result;
    }

    /**
     * List of translations from properties and preferences arrays.
     */
    private function getProcessedPropertiesOdeConfigTranslations()
    {
        // USER PREFERENCES
        // General settings
        $this->translator->trans('General settings');
        $this->translator->trans('Language');
        $this->translator->trans('You can choose a different language for the current project.');
        $this->translator->trans('License for the new documents');
        $this->translator->trans('You can choose a different licence for the current project.');
        $this->translator->trans('Style theme'); // To review
        $this->translator->trans('Version control');

        // STYLES CONFIG (to review)
        // Edition theme categories
        $this->translator->trans('Information');
        $this->translator->trans('Texts and Links');
        $this->translator->trans('Header');

        // Theme info fields
        $this->translator->trans('Title');
        $this->translator->trans('Description');
        $this->translator->trans('Version');
        $this->translator->trans('Authorship');
        $this->translator->trans('Author URL');
        $this->translator->trans('License');
        $this->translator->trans('License URL');

        // Theme edition fields
        // $this->translator->trans('Title');
        // $this->translator->trans('Description');
        // $this->translator->trans('Version');
        // $this->translator->trans('Authorship');
        // $this->translator->trans('Author URL');
        // $this->translator->trans('License');
        // $this->translator->trans('License URL');
        $this->translator->trans('Text color');
        $this->translator->trans('Links color');
        $this->translator->trans('Header image');
        $this->translator->trans('Logo image');

        // IDEVICE INFO FIELDS
        // $this->translator->trans('Title');
        // $this->translator->trans('Description');
        // $this->translator->trans('Version');
        // $this->translator->trans('Authorship');
        // $this->translator->trans('Author URL');
        // $this->translator->trans('License');
        // $this->translator->trans('License URL');

        // IDEVICE PROPERTIES
        $this->translator->trans('General');
        $this->translator->trans('Visible in export');
        $this->translator->trans('ID');
        $this->translator->trans('CSS Class');

        // BOX PROPERTIES
        // $this->translator->trans('Visible in export');
        $this->translator->trans('Allows to minimize/display content');
        $this->translator->trans('Minimized');
        // $this->translator->trans('ID');
        // $this->translator->trans('CSS Class');

        // PAGES PROPERTIES
        // $this->translator->trans('Title');
        $this->translator->trans('Title HTML');
        $this->translator->trans('Advanced (SEO)');
        $this->translator->trans('Different title on the page');

        $this->translator->trans('Title in page');
        // $this->translator->trans('Visible in export');
        // $this->translator->trans('Description');
        // $this->translator->trans('Advanced (SEO)');

        // PACKAGE PROPERTIES

        // Content metadata
        $this->translator->trans('Properties');
        $this->translator->trans('Content metadata');
        // $this->translator->trans('Title');
        $this->translator->trans('The name given to the resource.');
        // $this->translator->trans('Language');
        $this->translator->trans('Select a language.');
        // $this->translator->trans('Authorship');
        $this->translator->trans('Primary author/s of the resource.');
        // $this->translator->trans('License');
        // $this->translator->trans('Description');

        // Export options
        $this->translator->trans('Export options');
        $this->translator->trans('Editable export');
        $this->translator->trans('The exported content will be editable with eXeLearning.');
        $this->translator->trans('"Made with eXeLearning" link');
        $this->translator->trans('Help us spreading eXeLearning. Checking this option, a "Made with eXeLearning" link will be displayed in your pages.');
        $this->translator->trans('Include a copy of the source file');
        $this->translator->trans('A copy of the eXeLearning file will be included when exporting the content.');
        $this->translator->trans('Page counter');
        $this->translator->trans('A text with the page number will be added on each page.');
        $this->translator->trans('Search bar (Website export only)');
        $this->translator->trans('A search box will be added to every page of the website.');
        $this->translator->trans('Accessibility toolbar');
        $this->translator->trans('The accessibility toolbar allows visitors to manipulate some aspects of your site, such as font and text size.');

        // Custom code
        $this->translator->trans('Custom code');
        $this->translator->trans('HEAD');
        $this->translator->trans('HTML to be included at the end of the HEAD tag: LINK, META, SCRIPT, STYLE...');
        $this->translator->trans('Page footer');
        $this->translator->trans('Type any HTML. It will be placed after every page content. No JavaScript code will be executed inside eXe.');

        // To review (this string should only be in app.js, but it's not extracted)
        $this->translator->trans('eXeLearning %s is a development version. It is not for production use.');
        $this->translator->trans('This is just a demo version. Not for real projects. Days before it expires: %s');
        $this->translator->trans('eXeLearning %s has expired! Please download the latest version.');
    }
}
