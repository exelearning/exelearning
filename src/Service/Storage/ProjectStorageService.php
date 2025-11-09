<?php

namespace App\Service\Storage;

use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\Project\Project;
use App\Helper\net\exelearning\Helper\FileHelper;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Filesystem\Filesystem;

/**
 * Servicio de almacenamiento orientado a proyectos.
 *
 * Proporciona operaciones de almacenamiento centradas en Projects:
 * - Información de almacenamiento por proyecto
 * - Historial de versiones del proyecto
 * - Limpieza de archivos temporales del proyecto
 * - Estadísticas de uso por proyecto
 */
class ProjectStorageService
{
    private EntityManagerInterface $entityManager;
    private FileHelper $fileHelper;
    private LoggerInterface $logger;
    private Filesystem $filesystem;

    public function __construct(
        EntityManagerInterface $entityManager,
        FileHelper $fileHelper,
        LoggerInterface $logger
    ) {
        $this->entityManager = $entityManager;
        $this->fileHelper = $fileHelper;
        $this->logger = $logger;
        $this->filesystem = new Filesystem();
    }

    /**
     * Obtiene información completa de almacenamiento de un proyecto.
     *
     * @param Project|string $project Entidad Project o ID del proyecto
     * @return array Información de almacenamiento
     */
    public function getProjectStorageInfo($project): array
    {
        $projectId = $project instanceof Project ? $project->getId() : $project;

        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);

        // Obtener todas las versiones del proyecto
        $allVersions = $odeFilesRepo->findBy(
            ['odeId' => $projectId],
            ['updatedAt' => 'DESC']
        );

        // Separar autosaves de guardados manuales
        $manualSaves = array_filter($allVersions, fn($v) => $v->getIsManualSave());
        $autoSaves = array_filter($allVersions, fn($v) => !$v->getIsManualSave());

        // Calcular tamaños
        $totalSize = 0;
        $manualSavesSize = 0;
        $autoSavesSize = 0;

        foreach ($allVersions as $version) {
            $filePath = $this->fileHelper->getOdeFilePathByOdeId(
                $version->getOdeId(),
                $version->getOdeVersionId()
            );

            if ($this->filesystem->exists($filePath)) {
                $fileSize = filesize($filePath);
                $totalSize += $fileSize;

                if ($version->getIsManualSave()) {
                    $manualSavesSize += $fileSize;
                } else {
                    $autoSavesSize += $fileSize;
                }
            }
        }

        // Obtener sesiones activas del proyecto
        $currentOdeUsersRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $activeSessions = $currentOdeUsersRepo->findBy(['odeId' => $projectId]);

        // Calcular tamaño de archivos temporales
        $tmpSize = 0;
        foreach ($activeSessions as $session) {
            $tmpDir = $this->fileHelper->getOdeTmpDirByOdeId(
                $session->getOdeId(),
                $session->getOdeSessionId()
            );

            if ($this->filesystem->exists($tmpDir)) {
                $tmpSize += $this->getDirectorySize($tmpDir);
            }
        }

        return [
            'projectId' => $projectId,
            'totalVersions' => count($allVersions),
            'manualSaves' => count($manualSaves),
            'autoSaves' => count($autoSaves),
            'activeSessions' => count($activeSessions),
            'storage' => [
                'total' => $totalSize,
                'totalHuman' => $this->formatBytes($totalSize),
                'manualSaves' => $manualSavesSize,
                'manualSavesHuman' => $this->formatBytes($manualSavesSize),
                'autoSaves' => $autoSavesSize,
                'autoSavesHuman' => $this->formatBytes($autoSavesSize),
                'tmp' => $tmpSize,
                'tmpHuman' => $this->formatBytes($tmpSize),
            ],
            'latestVersion' => !empty($allVersions) ? [
                'versionId' => $allVersions[0]->getOdeVersionId(),
                'updatedAt' => $allVersions[0]->getUpdatedAt(),
                'isManualSave' => $allVersions[0]->getIsManualSave(),
                'user' => $allVersions[0]->getUser(),
            ] : null,
        ];
    }

    /**
     * Obtiene el historial completo de versiones de un proyecto.
     *
     * @param Project|string $project Entidad Project o ID del proyecto
     * @param bool $includeFileInfo Incluir información del archivo físico
     * @return array Historial de versiones
     */
    public function getProjectVersionHistory($project, bool $includeFileInfo = false): array
    {
        $projectId = $project instanceof Project ? $project->getId() : $project;

        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);

        $versions = $odeFilesRepo->findBy(
            ['odeId' => $projectId],
            ['updatedAt' => 'DESC']
        );

        $history = [];

        foreach ($versions as $version) {
            $versionData = [
                'versionId' => $version->getOdeVersionId(),
                'title' => $version->getTitle(),
                'isManualSave' => $version->getIsManualSave(),
                'user' => $version->getUser(),
                'createdAt' => $version->getCreatedAt(),
                'updatedAt' => $version->getUpdatedAt(),
            ];

            if ($includeFileInfo) {
                $filePath = $this->fileHelper->getOdeFilePathByOdeId(
                    $version->getOdeId(),
                    $version->getOdeVersionId()
                );

                $versionData['file'] = [
                    'path' => $filePath,
                    'exists' => $this->filesystem->exists($filePath),
                    'size' => $this->filesystem->exists($filePath) ? filesize($filePath) : 0,
                    'sizeHuman' => $this->filesystem->exists($filePath)
                        ? $this->formatBytes(filesize($filePath))
                        : '0 B',
                ];
            }

            $history[] = $versionData;
        }

        return $history;
    }

    /**
     * Limpia archivos temporales de un proyecto específico.
     *
     * @param Project|string $project Entidad Project o ID del proyecto
     * @param bool $force Forzar limpieza incluso con sesiones activas
     * @return array Estadísticas de limpieza
     */
    public function cleanupProjectTmpFiles($project, bool $force = false): array
    {
        $projectId = $project instanceof Project ? $project->getId() : $project;

        $currentOdeUsersRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $sessions = $currentOdeUsersRepo->findBy(['odeId' => $projectId]);

        $stats = [
            'sessionsFound' => count($sessions),
            'sessionsDeleted' => 0,
            'directoriesRemoved' => 0,
            'bytesFreed' => 0,
        ];

        if (empty($sessions)) {
            return $stats;
        }

        foreach ($sessions as $session) {
            // Si no se fuerza la limpieza, verificar que la sesión esté inactiva
            if (!$force) {
                $inactiveMinutes = $this->getSessionInactiveMinutes($session);
                if ($inactiveMinutes < 60) { // Sesión activa en la última hora
                    continue;
                }
            }

            $tmpDir = $this->fileHelper->getOdeTmpDirByOdeId(
                $session->getOdeId(),
                $session->getOdeSessionId()
            );

            if ($this->filesystem->exists($tmpDir)) {
                $sizeBeforeDelete = $this->getDirectorySize($tmpDir);

                try {
                    $this->filesystem->remove($tmpDir);
                    $stats['directoriesRemoved']++;
                    $stats['bytesFreed'] += $sizeBeforeDelete;

                    $this->logger->info('Cleaned project tmp directory', [
                        'projectId' => $projectId,
                        'sessionId' => $session->getOdeSessionId(),
                        'path' => $tmpDir,
                        'bytesFreed' => $sizeBeforeDelete
                    ]);
                } catch (\Exception $e) {
                    $this->logger->error('Failed to clean project tmp directory', [
                        'projectId' => $projectId,
                        'sessionId' => $session->getOdeSessionId(),
                        'error' => $e->getMessage()
                    ]);
                    continue;
                }
            }

            $this->entityManager->remove($session);
            $stats['sessionsDeleted']++;
        }

        $this->entityManager->flush();

        return $stats;
    }

    /**
     * Obtiene estadísticas de uso de almacenamiento por usuario.
     *
     * @param string $userEmail Email del usuario
     * @return array Estadísticas de almacenamiento
     */
    public function getUserStorageStats(string $userEmail): array
    {
        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);

        // Obtener archivos del usuario
        $userFiles = $odeFilesRepo->findBy(['user' => $userEmail]);

        // Agrupar por proyecto
        $projectsMap = [];
        foreach ($userFiles as $file) {
            $projectId = $file->getOdeId();

            if (!isset($projectsMap[$projectId])) {
                $projectsMap[$projectId] = [
                    'projectId' => $projectId,
                    'title' => $file->getTitle(),
                    'versions' => 0,
                    'size' => 0,
                ];
            }

            $filePath = $this->fileHelper->getOdeFilePathByOdeId(
                $file->getOdeId(),
                $file->getOdeVersionId()
            );

            if ($this->filesystem->exists($filePath)) {
                $projectsMap[$projectId]['size'] += filesize($filePath);
            }

            $projectsMap[$projectId]['versions']++;
        }

        // Calcular totales
        $totalSize = array_sum(array_column($projectsMap, 'size'));
        $totalVersions = array_sum(array_column($projectsMap, 'versions'));

        return [
            'userEmail' => $userEmail,
            'totalProjects' => count($projectsMap),
            'totalVersions' => $totalVersions,
            'totalSize' => $totalSize,
            'totalSizeHuman' => $this->formatBytes($totalSize),
            'projects' => array_values($projectsMap),
        ];
    }

    /**
     * Verifica si un proyecto excede el límite de almacenamiento.
     *
     * @param Project|string $project Entidad Project o ID del proyecto
     * @param int $maxBytes Límite máximo en bytes
     * @return array Información de límite
     */
    public function checkProjectStorageLimit($project, int $maxBytes): array
    {
        $info = $this->getProjectStorageInfo($project);

        $totalSize = $info['storage']['total'];
        $isOverLimit = $totalSize > $maxBytes;
        $percentUsed = ($totalSize / $maxBytes) * 100;

        return [
            'projectId' => $info['projectId'],
            'currentSize' => $totalSize,
            'currentSizeHuman' => $this->formatBytes($totalSize),
            'maxSize' => $maxBytes,
            'maxSizeHuman' => $this->formatBytes($maxBytes),
            'percentUsed' => round($percentUsed, 2),
            'isOverLimit' => $isOverLimit,
            'remainingBytes' => max(0, $maxBytes - $totalSize),
            'remainingBytesHuman' => $this->formatBytes(max(0, $maxBytes - $totalSize)),
        ];
    }

    /**
     * Calcula cuántos minutos lleva inactiva una sesión.
     *
     * @param CurrentOdeUsers $session Sesión
     * @return int Minutos de inactividad
     */
    private function getSessionInactiveMinutes(CurrentOdeUsers $session): int
    {
        $lastAction = $session->getLastAction();
        if (!$lastAction) {
            return PHP_INT_MAX;
        }

        $now = new \DateTime();
        $diff = $now->getTimestamp() - $lastAction->getTimestamp();

        return (int) ($diff / 60);
    }

    /**
     * Calcula el tamaño total de un directorio recursivamente.
     *
     * @param string $directory Ruta del directorio
     * @return int Tamaño en bytes
     */
    private function getDirectorySize(string $directory): int
    {
        $size = 0;

        if (!is_dir($directory)) {
            return 0;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $size += $file->getSize();
            }
        }

        return $size;
    }

    /**
     * Formatea bytes a formato legible (KB, MB, GB).
     *
     * @param int $bytes Cantidad de bytes
     * @param int $precision Decimales a mostrar
     * @return string Tamaño formateado
     */
    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision) . ' ' . $units[$i];
    }
}
