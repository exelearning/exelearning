<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\TranslationListDto;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\IdeviceHelper;
use App\Util\net\exelearning\Util\FileUtil;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/translation-management/translations')]
class TranslationApiController extends DefaultApiController
{
    private $fileHelper;
    private $iDeviceHelper;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        IdeviceHelper $iDeviceHelper,
        SerializerInterface $serializer,
    ) {
        $this->fileHelper = $fileHelper;
        $this->iDeviceHelper = $iDeviceHelper;

        parent::__construct($entityManager, $logger, $serializer);
    }

    #[Route('', methods: ['GET'], name: 'api_translations_lists')]
    public function getTranslationListsAction(Request $request)
    {
        $data = [];
        $translationsParentDir = $this->fileHelper->getTranslationsDir();

        if (file_exists($translationsParentDir)) {
            $translationsDirArray = glob($translationsParentDir.'/*', GLOB_ONLYDIR);

            foreach ($translationsDirArray as $path) {
                // Get the locale from the Request
                $locale = $request->getLocale();

                $dataLang = new TranslationListDto();
                $dataLang->setLocale($locale);

                $clientTranslationFilePathName = $this->fileHelper->getClientTranslationFilePathName(
                    $locale,
                    Constants::TRANSLATION_DEFAULT_FORMAT,
                    false
                );
                $xlfData = FileUtil::readXlfFile($clientTranslationFilePathName, $locale);

                foreach ($xlfData as $key => $value) {
                    // If translation doesn't exists return id
                    if (empty($value)) {
                        $dataLang->addTranslation($key, $key);
                    } else {
                        $dataLang->addTranslation($key, $value);
                    }
                }

                // Get iDevices translations
                $iDevicesData = $this->getIdevicesTranslations($locale);
                foreach ($iDevicesData as $key => $value) {
                    $dataLang->addTranslation($key, $value);
                }

                $data[$locale] = $dataLang->getTranslations();
            }
        } else {
            $this->status = 404;
        }

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{locale}/list', methods: ['GET'], name: 'api_translations_list_by_locale')]
    public function getTranslationListForLocaleAction(Request $request, $locale)
    {
        $data = new TranslationListDto();
        $data->setLocale($locale);

        $clientTranslationFilePathName = $this->fileHelper->getClientTranslationFilePathName($locale, Constants::TRANSLATION_DEFAULT_FORMAT, false);

        // If translation exists
        if (file_exists($clientTranslationFilePathName)) {
            // Get main translations
            $xlfData = FileUtil::readXlfFile($clientTranslationFilePathName, $locale);

            foreach ($xlfData as $key => $value) {
                // If translation doesn't exists return id
                if (empty($value)) {
                    $data->addTranslation($key, $key);
                } else {
                    $data->addTranslation($key, $value);
                }
            }

            // Get iDevices translations
            $iDevicesData = $this->getIdevicesTranslations($locale);

            foreach ($iDevicesData as $key => $value) {
                $data->addTranslation($key, $value);
            }
        } else {
            $this->status = 404;
        }

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * Returns iDevices translations for locale passed as param.
     *
     * @param string $locale
     *
     * @return string[]|string[][]|null[][]
     */
    private function getIdevicesTranslations($locale)
    {
        $userLogged = $this->getUser();

        $iDevicePoData = [];
        $iDevicesDir = $this->fileHelper->getIdevicesDir();

        // Search iDevices to process
        $iDevices = $this->iDeviceHelper->getInstalledIdevices($userLogged);

        foreach ($iDevices as $iDevice) {
            $iDeviceName = $iDevice->getName();
            $filePath = $this->iDeviceHelper->getIdeviceTranslationFilePathName(
                $locale,
                $iDevice->getDirName(),
                $iDeviceName
            );
            $iDeviceAuxXlfData = [];

            if (file_exists($filePath)) {
                $iDeviceAuxXlfData = FileUtil::readXlfFile($filePath, $locale);
            }

            // Process strings
            foreach ($iDeviceAuxXlfData as $key => $value) {
                // If translation doesn't exists return id
                if (empty($value)) {
                    $newValue = $key;
                } else {
                    $newValue = $value;
                }

                // Concatenate iDeviceName to key
                $newKey = $iDeviceName.'.'.$key;

                // Generate key iDeviceName.translationKey
                $iDevicePoData[$newKey] = $newValue;
            }
        }

        return $iDevicePoData;
    }
}
