<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Exception\net\exelearning\Exception\Logical\UserInsufficientSpaceException;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeComponentsSyncServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeExportServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Route('/api/ode-export')]
class OdeExportApiController extends DefaultApiController
{
    private FileHelper $fileHelper;
    private OdeServiceInterface $odeService;
    private OdeExportServiceInterface $odeExportService;
    private OdeComponentsSyncServiceInterface $odeComponentsSyncService;
    private UserHelper $userHelper;
    private CurrentOdeUsersServiceInterface $currentOdeUsersService;
    private TranslatorInterface $translator;

    /**
     * @param OdeExportServiceInterface $odeService
     */
    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        OdeServiceInterface $odeService,
        OdeExportServiceInterface $odeExportService,
        OdeComponentsSyncServiceInterface $odeComponentsSyncService,
        UserHelper $userHelper,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        TranslatorInterface $translator,
        SerializerInterface $serializer,
    ) {
        $this->fileHelper = $fileHelper;
        $this->odeService = $odeService;
        $this->odeExportService = $odeExportService;
        $this->odeComponentsSyncService = $odeComponentsSyncService;
        $this->userHelper = $userHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->translator = $translator;

        parent::__construct($entityManager, $logger, $serializer);
    }

    #[Route('/{odeSessionId}/{exportType}/download', methods: ['GET'], name: 'api_ode_export_download')]
    public function downloadExportAction(Request $request, $odeSessionId, $exportType)
    {
        if (empty($odeSessionId) || empty($exportType)) {
            $jsonData = $this->getJsonSerialized(['responseMessage' => 'error: invalid data']);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $user = $this->getUser();
        $dbUser = $this->userHelper->getDatabaseUser($user);

        try {
            // Check if exportType is properties
            if ('properties' == $exportType) {
                // Generate export file
                $odeExportResult = $this->odeExportService->exportProperties(
                    $user,
                    $dbUser,
                    $odeSessionId,
                    false,
                    $exportType,
                    false
                );
            } else {
                // Generate export file
                $odeExportResult = $this->odeExportService->export(
                    $user,
                    $dbUser,
                    $odeSessionId,
                    false,
                    $exportType,
                    false,
                    false
                );
            }
        } catch (UserInsufficientSpaceException $e) {
            $this->logger->error('user insufficient space', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);
            $responseData['responseMessage'] = 'error: '.$e->getMessage();

            // Remove save flag active
            $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $jsonData = $this->getJsonSerialized($odeExportResult);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odeSessionId}/preview', methods: ['GET'], name: 'api_ode_export_preview')]
    public function previewExportAction(Request $request, $odeSessionId)
    {
        $exportType = Constants::EXPORT_TYPE_HTML5;

        if (empty($odeSessionId) || empty($exportType)) {
            $jsonData = $this->getJsonSerialized(['responseMessage' => 'error: invalid data']);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $baseUrl = $request->getBaseURL();

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);
        // $tempID= $this->fileHelper->getTempID(4);
        // Generate export file
        $odeExportResult = $this->odeExportService->export(
            $user,
            $databaseUser,
            $odeSessionId,
            $baseUrl,
            $exportType,
            true,
            false,
            bin2hex(random_bytes(6 / 2)).DIRECTORY_SEPARATOR
        );

        $jsonData = $this->getJsonSerialized($odeExportResult);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/files/tmp/{year}/{month}/{day}/{random}/{subdir}/{file}', methods: ['GET'], name: 'preview_export_file')]
    public function previewFile($year, $month, $day, $random, $subdir, $file): Response
    {
        // Fetch the file directory path from the parameter configured in services.yaml removing the trailing slash if present in filesDir to avoid double slashes in the path
        $filesDir = rtrim($this->getParameter('filesdir'), DIRECTORY_SEPARATOR);

        // Build the file path using DIRECTORY_SEPARATOR for cross-platform compatibility
        $filePath = implode(DIRECTORY_SEPARATOR, [$filesDir, $year, $month, $day, $random, $subdir, $file]);

        // Helper: relative path from base
        $relative = $filePath;
        // Truncate if too long
        if (strlen($relative) > 50) {
            $relative = '…'.substr($relative, -47);
        }

        // Check if the file exists before attempting to serve it
        if (!file_exists($filePath)) {
            // Quick and Dirty hack: if we can't find the file in the folder, sometimes is on tmp folder...
            $filePath = implode(DIRECTORY_SEPARATOR, [$filesDir, 'tmp', $year, $month, $day, $random, $subdir, $file]);
            // Check if the file exists before attempting to serve it
            if (!file_exists($filePath)) {
                // Throw a 404 Not Found exception if the file is not found
                throw $this->createNotFoundException(sprintf('The file "%s" does not exist at the specified path.', $relative));
            }
        }

        // If path is a directory, immediately 404
        if (is_dir($filePath)) {
            throw $this->createNotFoundException(sprintf('Attempt to access directory: %s', $relative));
        }

        return new Response(file_get_contents($filePath), 200, [
            'Content-Type' => 'text/html',
        ]);
    }
}
