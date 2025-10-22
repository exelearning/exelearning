<?php

namespace App\Controller\Api\Project;

use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\Project\ProjectProperty;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Service\net\exelearning\Service\FilesDir\FilesDirServiceInterface;
use App\Service\Project\ProjectPropertiesBuilder;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class CreateProjectAction extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserHelper $userHelper,
        private readonly FilesDirServiceInterface $filesDirService,
        private readonly FileHelper $fileHelper,
        private readonly OdeServiceInterface $odeService,
        private readonly ProjectPropertiesBuilder $propsBuilder,
    ) {
    }

    /**
     * Create a project from uploaded ELP, server path, or plain values.
     * Implements precedence: multipart file > JSON path > JSON values.
     */
    public function __invoke(Request $request)
    {
        try {
            $user = $this->getUser();
            $dbUser = $this->userHelper->getDatabaseUser($user);

            // Ensure FILES_DIR structure exists (same as CLI flow).
            $this->filesDirService->checkFilesDir();

            // Resolve mode
            /** @var UploadedFile|null $file */
            $file = $request->files->get('file') ?? $request->files->get('elp');
            $contentType = (string) ($request->headers->get('Content-Type') ?? '');
            $json = [];
            if (!$file && str_starts_with($contentType, 'application/json')) {
                $json = json_decode($request->getContent() ?: '{}', true) ?: [];
            }

            if ($file instanceof UploadedFile) {
                return $this->createFromMultipart($file, $request, $dbUser);
            }

            if (isset($json['path'])) {
                return $this->createFromPath((string) $json['path'], $request, $dbUser);
            }

            if (isset($json['values']) || isset($json['title']) || isset($json['properties'])) {
                $values = $json['values'] ?? $json;

                return $this->createFromValues((array) $values, $dbUser);
            }

            // No valid payload
            if (!str_starts_with($contentType, 'application/json') && empty($request->files->all())) {
                return $this->json(['title' => 'Unsupported Media Type', 'detail' => 'Expecting multipart/form-data or application/json', 'type' => '/errors/415'], 415);
            }

            return $this->json(['title' => 'Bad request', 'detail' => 'Missing file, path, or values', 'type' => '/errors/400'], 400);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }

    /**
     * Handle creation from multipart upload.
     */
    private function createFromMultipart(UploadedFile $file, Request $request, $dbUser): JsonResponse
    {
        // Enforce simple size safeguard (optional stronger checks are done later)
        $maxMb = (int) (\App\Settings::FILE_UPLOAD_MAX_SIZE ?? 100);
        if ($file->getSize() && $file->getSize() > $maxMb * 1024 * 1024) {
            return $this->json(['title' => 'Payload too large', 'detail' => 'File exceeds upload limit', 'type' => '/errors/413'], 413);
        }

        // Only accept ELP/ZIP for this endpoint; reject XML as invalid ELP
        $origName = $file->getClientOriginalName() ?: '';
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if (!in_array($ext, [\App\Constants::FILE_EXTENSION_ELP, 'elp', 'zip'])) {
            return $this->json(['title' => 'Invalid file', 'detail' => 'Unsupported file type', 'type' => '/errors/422'], 422);
        }

        // Move to a temporary safe location
        $tmpDir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'exe_uploads';
        if (!is_dir($tmpDir)) {
            @mkdir($tmpDir, 0777, true);
        }
        $originalName = $file->getClientOriginalName() ?: ('upload_'.Util::generateId().'.elp');
        $file->move($tmpDir, $originalName);
        $tmpPath = $tmpDir.DIRECTORY_SEPARATOR.$originalName;

        return $this->createFromLocalPath($originalName, $tmpPath, $request, $dbUser);
    }

    /**
     * Handle creation from a server filesystem path.
     */
    private function createFromPath(string $path, Request $request, $dbUser): JsonResponse
    {
        $real = realpath($path);
        if (!$real || !is_readable($real)) {
            return $this->json(['title' => 'Path not found', 'detail' => 'File path not found or not readable', 'type' => '/errors/404'], 404);
        }
        // Allow only under FILES_DIR for safety
        $base = realpath($this->fileHelper->getFilesDir());
        if (!$base || !str_starts_with($real, $base.DIRECTORY_SEPARATOR)) {
            return $this->json(['title' => 'Path not allowed', 'detail' => 'The provided path is outside allowed base', 'type' => '/errors/404'], 404);
        }
        $fileName = basename($real);
        $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        if (!in_array($ext, ['elp', 'zip'])) {
            return $this->json(['title' => 'Invalid ELP', 'detail' => 'Unsupported file type', 'type' => '/errors/422'], 422);
        }

        return $this->createFromLocalPath($fileName, $real, $request, $dbUser);
    }

    /**
     * Shared pipeline to validate, create structure, save and persist the project.
     */
    private function createFromLocalPath(string $fileName, string $localPath, Request $request, $dbUser): JsonResponse
    {
        // 1) Validate ELP using same service as CLI
        $check = $this->odeService->checkLocalOdeFile($fileName, $localPath, $dbUser, true);
        if (!isset($check['responseMessage']) || 'OK' !== $check['responseMessage']) {
            return $this->json(['title' => 'Invalid ELP', 'detail' => (string) ($check['responseMessage'] ?? 'Invalid file'), 'type' => '/errors/422'], 422);
        }

        // 2) Create structure + current_ode_users
        $this->odeService->createElpStructureAndCurrentOdeUser(
            $fileName,
            $dbUser,
            $dbUser,
            $request->getClientIp() ?? '127.0.0.1',
            true,
            $check
        );

        // 3) Save and move elp to perm to persist OdeFiles entry
        $odeSessionId = $check['odeSessionId'];

        // Load properties and preferences required to save
        $odeProperties = $this->odeService->getOdePropertiesFromDatabase($odeSessionId, $dbUser);
        $userPreferences = $this->userHelper->getUserPreferencesFromDatabase($dbUser);
        $userPreferencesDtos = [];
        foreach ($userPreferences as $pref) {
            $dto = new \App\Entity\net\exelearning\Dto\UserPreferencesDto();
            $dto->loadFromEntity($pref);
            $userPreferencesDtos[$dto->getKey()] = $dto;
        }

        $save = $this->odeService->saveOde($odeSessionId, $dbUser, true, $odeProperties, $userPreferencesDtos);
        if (!isset($save['responseMessage']) || 'OK' !== $save['responseMessage']) {
            return $this->json(['title' => 'Save failed', 'detail' => (string) ($save['responseMessage'] ?? 'Unknown save error'), 'type' => '/errors/500'], 500);
        }

        $odeId = $save['odeId'] ?? ($check['odeId'] ?? Util::generateId());
        $odeVersionId = $save['odeVersionId'] ?? ($check['odeVersionId'] ?? Util::generateId());
        $odeVersionName = ((int) $this->odeService->getLastVersionNameOdeFiles($odeId)) + 1;
        $odePropertiesName = isset($odeProperties['pp_title']) ? $odeProperties['pp_title']->getValue() : ($check['pp_title'] ?? $fileName);

        $odeResultParameters = [
            'odeId' => $odeId,
            'odeVersionId' => $odeVersionId,
            'odeSessionId' => $odeSessionId,
            'elpFileName' => $save['elpFileName'],
            'odePropertiesName' => $odePropertiesName,
            'odeVersionName' => $odeVersionName,
        ];

        $this->odeService->moveElpFileToPerm($odeResultParameters, $dbUser, true);

        // 4) Build payload using last file
        $odeRepo = $this->em->getRepository(OdeFiles::class);
        $last = $odeRepo->getLastFileForOde($odeId);

        $username = $this->userHelper->getLoggedUserName($dbUser);
        $properties = $this->propsBuilder->build($odeId, $username);

        $payload = [
            'id' => $odeId,
            'odeId' => $odeId,
            'odeVersionId' => $last?->getOdeVersionId(),
            'title' => (string) ($last?->getTitle() ?? ''),
            'versionName' => $last?->getVersionName(),
            'fileName' => (string) ($last?->getFileName() ?? ''),
            'size' => (string) ($last?->getSize() ?? 0),
            'isManualSave' => (bool) ($last?->getIsManualSave() ?? true),
            'updatedAt' => ['timestamp' => $last?->getUpdatedAt()?->getTimestamp()],
            'properties' => $properties,
        ];

        $location = sprintf('/api/v2/projects/%s', $odeId);

        return $this->json($payload, 201, ['Location' => $location]);
    }

    /**
     * Handle creation from plain values (no file).
     */
    private function createFromValues(array $values, $dbUser): JsonResponse
    {
        $title = trim((string) ($values['title'] ?? '')) ?: 'Untitled document';

        $odeId = Util::generateId();
        $odeVersionId = Util::generateId();
        $fileName = sprintf('%s_%s.elp', $odeId, $odeVersionId);

        $username = $this->userHelper->getLoggedUserName($dbUser);

        $of = new OdeFiles();
        $of->setOdeId($odeId);
        $of->setOdeVersionId($odeVersionId);
        $of->setTitle($title);
        $of->setVersionName('1');
        $of->setFileName($fileName);
        $of->setFileType('elp');
        $of->setDiskFilename(OdeFiles::ODE_FILES_FILES_DIR.DIRECTORY_SEPARATOR.'perm'.DIRECTORY_SEPARATOR.$fileName);
        $of->setSize(0);
        $of->setUser($username);
        $of->setIsManualSave(true);

        $this->em->persist($of);

        // Upsert provided properties to v2 store (optional)
        $propertiesInput = isset($values['properties']) && is_array($values['properties']) ? $values['properties'] : [];
        if ($propertiesInput) {
            $ppRepo = $this->em->getRepository(ProjectProperty::class);
            foreach ($propertiesInput as $key => $value) {
                if (is_bool($value)) {
                    $storedValue = $value ? 'true' : 'false';
                } elseif (is_scalar($value)) {
                    $storedValue = (string) $value;
                } else {
                    $storedValue = json_encode($value, JSON_UNESCAPED_UNICODE);
                }
                $ppRepo->upsert($odeId, (string) $key, (string) $storedValue);
            }
        }

        $this->em->flush();

        $properties = $this->propsBuilder->build($odeId, $username);

        $payload = [
            'id' => $odeId,
            'odeId' => $odeId,
            'odeVersionId' => $odeVersionId,
            'title' => $title,
            'versionName' => $of->getVersionName(),
            'fileName' => $fileName,
            'size' => (string) $of->getSize(),
            'isManualSave' => true,
            'updatedAt' => ['timestamp' => $of->getUpdatedAt()?->getTimestamp()],
            'properties' => $properties,
        ];

        $location = sprintf('/api/v2/projects/%s', $odeId);

        return $this->json($payload, 201, ['Location' => $location]);
    }
}
