<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Entity\net\exelearning\Dto\UserPreferencesDto;
use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Settings;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/user-management/user')]
class UserApiController extends DefaultApiController
{
    private FileHelper $fileHelper;
    private UserHelper $userHelper;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        UserHelper $userHelper,
        SerializerInterface $serializer,
    ) {
        $this->fileHelper = $fileHelper;
        $this->userHelper = $userHelper;

        parent::__construct($entityManager, $logger, $serializer);
    }

    /**
     * API SERVICES.
     */
    #[Route('/set-lopd-accepted', methods: ['POST'], name: 'api_user_set_lopd_accepted')]
    public function setLopdAcceptedAction(Request $request)
    {
        $responseData = [];

        $userLogged = $this->getUser();
        $userLoggedName = $this->userHelper->getLoggedUserName($userLogged);

        // Check if we have been able to obtain the logged user
        if (!$userLoggedName) {
            $this->logger->error('It was not possible to obtain the mail of the session user', [
                'file:' => $this, 'line' => __LINE__,
            ]);
            $responseData['responseMessage'] = 'error: It was not possible to obtain the mail of the session user';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Get user from database
        $userRepository = $this->entityManager->getRepository(User::class);
        $user = $userRepository->findOneBy(['email' => $userLoggedName]);

        if (!empty($user)) {
            // Update the user to set is_lopd_accepted to 1
            if (!$user->getIsLopdAccepted()) {
                $this->userHelper->setLopdAcceptedToUser($user);
                $responseData['newUser'] = false;
            }
        } else {
            // Create a new user that has accepted lopd
            if ($userLoggedName) {
                $this->userHelper->createNewUserBySessionUser($userLoggedName, true);
                $responseData['newUser'] = true;
            }
        }

        $responseData['responseMessage'] = 'OK';
        $responseData['userLogged'] = $userLoggedName;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/preferences/get', methods: ['GET'], name: 'api_user_preferences_get')]
    public function getPreferencesAction(Request $request)
    {
        $responseData = [];

        $userLogged = $this->getUser();
        $userLoggedName = $this->userHelper->getLoggedUserName($userLogged);

        // Check if we have been able to obtain the logged user
        if (!$userLoggedName) {
            $this->logger->error('It was not possible to obtain the mail of the session user', [
                'file:' => $this, 'line' => __LINE__,
            ]);
            $responseData['responseMessage'] = 'error: It was not possible to obtain the mail of the session user';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Get user preferences
        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($userLogged);

        $userPreferencesDtos = [];
        foreach ($databaseUserPreferences as $userPreference) {
            $userPreferencesDto = new UserPreferencesDto();
            $userPreferencesDto->loadFromEntity($userPreference);
            $userPreferencesDtos[$userPreferencesDto->getKey()] = $userPreferencesDto;
        }

        $responseData['userPreferences'] = $userPreferencesDtos;

        // Detect the user's preferred language from the browser
        $detectedLocale = $request->getLocale();

        // Get allowed locales from Settings
        $allowedLocales = array_keys(Settings::LOCALES);

        // Determine the locale to use
        $localeToUse = in_array($detectedLocale, $allowedLocales) ? $detectedLocale : Settings::DEFAULT_LOCALE;

        // Store the detected locale
        $responseData['userPreferences']['detectedLocale'] = $localeToUse;

        // Set the locale only if it is not already set
        if (empty($responseData['userPreferences']['locale']->getValue())) {
            $responseData['userPreferences']['locale']->setValue($localeToUse);
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/preferences/save', methods: ['PUT'], name: 'api_user_preferences_save')]
    public function saveUserPreferencesAction(Request $request)
    {
        $this->hydrateRequestBody($request);

        $responseData = [];

        $userLogged = $this->getUser();
        $userLoggedName = $this->userHelper->getLoggedUserName($userLogged);

        // Check if we have been able to obtain the logged user
        if (!$userLoggedName) {
            $this->logger->error('It was not possible to obtain the mail of the session user', [
                'file:' => $this, 'line' => __LINE__,
            ]);
            $responseData['responseMessage'] = 'error: It was not possible to obtain the mail of the session user';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $preferencesData = [];

        $databaseUserPreferencesData = $this->userHelper->getUserPreferencesFromDatabase($userLogged);

        foreach ($databaseUserPreferencesData as $userPreferencesConfigKey => $userPreferencesConfigValues) {
            if (isset($databaseUserPreferencesData[$userPreferencesConfigKey])) {
                // Set value to property from request
                $userPreferences = $databaseUserPreferencesData[$userPreferencesConfigKey];
                if (null !== $request->get($userPreferencesConfigKey)) {
                    $userPreferences->setValue($request->get($userPreferencesConfigKey));
                }
                // Save
                $this->entityManager->persist($userPreferences);
                $preferencesData[$userPreferencesConfigKey] = $userPreferences;
            }
        }

        $this->entityManager->flush();

        $responseData['responseMessage'] = 'OK';
        $responseData['userPreferences'] = $preferencesData;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }
}
