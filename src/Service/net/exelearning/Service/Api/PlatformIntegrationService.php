<?php

namespace App\Service\net\exelearning\Service\Api;

use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Util\net\exelearning\Util\IntegrationUtil;
use App\Util\net\exelearning\Util\SettingsUtil;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\Mime\Part\Multipart\FormDataPart;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

class PlatformIntegrationService implements PlatformIntegrationServiceInterface
{
    private $entityManager;
    private $logger;
    private $fileHelper;
    private $currentOdeUsersService;
    private $userHelper;
    private $integrationUtil;

    public function __construct(EntityManagerInterface $entityManager, LoggerInterface $logger, FileHelper $fileHelper, CurrentOdeUsersServiceInterface $currentOdeUsersService, UserHelper $userHelper)
    {
        $this->entityManager = $entityManager;
        $this->logger = $logger;
        $this->fileHelper = $fileHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->userHelper = $userHelper;
        $this->integrationUtil = new IntegrationUtil($logger);
    }

    /**
     * Petition to upload elp to the platform.
     *
     * @param User   $user
     * @param array  $odeResultParameters
     * @param string $filePathName
     * @param string $jwtToken
     *
     * @return array content
     */
    public function platformPetitionSet($user, $odeResultParameters, $platformIntegrationUrlSet, $filePathName, $jwtToken)
    {
        $decodedJWT = [];
        try {
            $fp = fopen($filePathName, 'rb');
            $binary = fread($fp, filesize($filePathName));
            $fileBase64 = base64_encode($binary);
            $decodedJWT = $this->integrationUtil->decodeJWT($jwtToken);
        } catch (Exception $e) {
            /* TO DO: mandar mensaje de error */
            $this->logger->error('Exception:'.$e->getMessage());
            /* Parar aplicación */
        }

        $httpClient = HttpClient::create();

        $postJson = SettingsUtil::getPlatformJsonStructure();
        $postJson['ode_id'] = $decodedJWT['cmid'];
        $postJson['ode_filename'] = $odeResultParameters['exportProjectName'] ? $odeResultParameters['exportProjectName'] : $odeResultParameters['elpFileName']; // si viene vacío poner  $odeResultParameters['elpFileName'];
        $postJson['ode_file'] = $fileBase64;
        $postJson['ode_user'] = $decodedJWT['userid'];
        $postJson['ode_uri'] = $decodedJWT['returnurl'];
        $postJson['jwt_token'] = $jwtToken;

        $jsonData = $this->getJsonSerialized($postJson);

        $formData = [
            'ode_data' => $jsonData,
        ];
        $formData = new FormDataPart($formData);
        $formData->getParts();

        try {
            $response = $httpClient->request('POST', $platformIntegrationUrlSet, [
                'headers' => $formData->getPreparedHeaders()->toArray(),
                'body' => $formData->bodyToIterable(),
            ]);

            $content = $response->toArray();
        } catch (\Exception $e) {
            $this->logger->error('platform upload error:'.$e->getMessage(), ['className' => get_class($e), 'file:' => $this, 'line' => __LINE__]);
            $content['error'] = 'There was a problem with the upload';
        }

        return $content;
    }

    /**
     * Send petition to get the elp from platform.
     *
     * @param User   $user
     * @param string $odePlatformId
     * @param string $platformIntegrationUrlGet
     * @param string $jwtToken
     *
     * @return array $content
     */
    public function platformPetitionGet($user, $odePlatformId, $platformIntegrationUrlGet, $jwtToken)
    {
        $httpClient = HttpClient::create();

        $postJson = SettingsUtil::getPlatformJsonStructure();
        $postJson['ode_id'] = $odePlatformId;
        $postJson['ode_user'] = $user;
        $postJson['jwt_token'] = $jwtToken;
        $jsonData = $this->getJsonSerialized($postJson);

        try {
            $formData = [
                'ode_data' => $jsonData,
            ];
            $formData = new FormDataPart($formData);
            $formData->getParts();

            $response = $httpClient->request('POST', $platformIntegrationUrlGet, [
                'headers' => $formData->getPreparedHeaders()->toArray(),
                'body' => $formData->bodyToIterable(),
            ]);
            $content = $response->toArray();

            // Debug log petition
            $this->logger->debug('petition get ode file response:', ['content:' => $content, 'file:' => $this, 'line' => __LINE__]);

            // Error get data
            if ('1' == $content['status']) {
                $content['error'] = $content['description'];
            }
        } catch (\Exception $e) {
            $this->logger->error('platform get elp error:'.$e->getMessage(), ['className' => get_class($e), 'file:' => $this, 'line' => __LINE__]);
            $content['error'] = 'Error, couldn\'t get elp';
        }

        return $content;
    }

    /**
     * Converts the data received to json.
     *
     * @return string json
     */
    private function getJsonSerialized($data)
    {
        $encoders = [new JsonEncoder()];
        $normalizers = [new ObjectNormalizer()];

        $serializer = new Serializer($normalizers, $encoders);

        $jsonSerialized = $serializer->serialize($data, 'json');

        return $jsonSerialized;
    }
}
