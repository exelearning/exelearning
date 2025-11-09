<?php

namespace App\Service\Storage;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Helper\net\exelearning\Helper\FileHelper;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Filesystem\Filesystem;

/**
 * Servicio de limpieza proactiva de archivos temporales y versiones antiguas.
 *
 * Responsabilidades:
 * - Limpiar sesiones temporales abandonadas
 * - Eliminar versiones antiguas de autosave
 * - Liberar espacio en disco
 * - Generar métricas de uso de almacenamiento
 */
class ProactiveCleanupService
{
    private EntityManagerInterface $entityManager;
    private FileHelper $fileHelper;
    private LoggerInterface $logger;
    private Filesystem $filesystem;

    // Configuración por defecto
    private int $sessionMaxInactiveHours;
    private int $autosaveVersionsToKeep;
    private int $manualSaveVersionsToKeep;

    public function __construct(
        EntityManagerInterface $entityManager,
        FileHelper $fileHelper,
        LoggerInterface $logger,
        int $sessionMaxInactiveHours = 24,
        int $autosaveVersionsToKeep = 5,
        int $manualSaveVersionsToKeep = 20
    ) {
        $this->entityManager = $entityManager;
        $this->fileHelper = $fileHelper;
        $this->logger = $logger;
        $this->filesystem = new Filesystem();
        $this->sessionMaxInactiveHours = $sessionMaxInactiveHours;
        $this->autosaveVersionsToKeep = $autosaveVersionsToKeep;
        $this->manualSaveVersionsToKeep = $manualSaveVersionsToKeep;
    }

    /**
     * Ejecuta todas las tareas de limpieza.
     *
     * @return array Estadísticas de la limpieza realizada
     */
    public function runFullCleanup(): array
    {
        $stats = [
            'abandonedSessions' => $this->cleanAbandonedSessions(),
            'oldAutosaves' => $this->cleanOldAutosaveVersions(),
            'orphanedFiles' => $this->cleanOrphanedTmpFiles(),
        ];

        $this->logger->info('ProactiveCleanup completed', $stats);

        return $stats;
    }

    /**
     * Limpia sesiones temporales abandonadas.
     *
     * Una sesión se considera abandonada si:
     * - No tiene actividad (last_action) en las últimas X horas
     * - Los archivos temporales asociados existen en /tmp
     *
     * @return array Estadísticas de limpieza
     */
    public function cleanAbandonedSessions(): array
    {
        $cutoffTime = new \DateTime();
        $cutoffTime->modify("-{$this->sessionMaxInactiveHours} hours");

        $repo = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $qb = $repo->createQueryBuilder('cou');

        $abandonedSessions = $qb
            ->where('cou.lastAction < :cutoffTime')
            ->setParameter('cutoffTime', $cutoffTime)
            ->getQuery()
            ->getResult();

        $stats = [
            'sessionsFound' => count($abandonedSessions),
            'sessionsDeleted' => 0,
            'directoriesRemoved' => 0,
            'bytesFreed' => 0,
        ];

        foreach ($abandonedSessions as $session) {
            $odeId = $session->getOdeId();
            $sessionId = $session->getOdeSessionId();

            // Obtener directorio temporal de la sesión
            $tmpDir = $this->fileHelper->getOdeTmpDirByOdeId($odeId, $sessionId);

            if ($this->filesystem->exists($tmpDir)) {
                // Calcular tamaño antes de eliminar
                $sizeBeforeDelete = $this->getDirectorySize($tmpDir);

                try {
                    // Eliminar directorio temporal
                    $this->filesystem->remove($tmpDir);
                    $stats['directoriesRemoved']++;
                    $stats['bytesFreed'] += $sizeBeforeDelete;

                    $this->logger->info('Removed abandoned session directory', [
                        'odeId' => $odeId,
                        'sessionId' => $sessionId,
                        'path' => $tmpDir,
                        'bytesFreed' => $sizeBeforeDelete
                    ]);
                } catch (\Exception $e) {
                    $this->logger->error('Failed to remove session directory', [
                        'odeId' => $odeId,
                        'sessionId' => $sessionId,
                        'path' => $tmpDir,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            // Eliminar registro de la base de datos
            $this->entityManager->remove($session);
            $stats['sessionsDeleted']++;
        }

        $this->entityManager->flush();

        return $stats;
    }

    /**
     * Limpia versiones antiguas de autosave, manteniendo solo las últimas N por proyecto.
     *
     * @return array Estadísticas de limpieza
     */
    public function cleanOldAutosaveVersions(): array
    {
        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);

        // Obtener todos los archivos
        $allFiles = $odeFilesRepo->findAll();

        // Extraer IDs únicos de proyectos
        $projectIds = [];
        foreach ($allFiles as $file) {
            $odeId = $file->getOdeId();
            if (!in_array($odeId, $projectIds)) {
                $projectIds[] = $odeId;
            }
        }

        $stats = [
            'projectsProcessed' => 0,
            'autosavesDeleted' => 0,
            'bytesFreed' => 0,
        ];

        foreach ($projectIds as $projectId) {
            // Procesar autosaves
            $deletedAutosaves = $this->cleanOldVersionsForProject(
                $projectId,
                false, // is_manual_save = false (autosaves)
                $this->autosaveVersionsToKeep
            );

            $stats['autosavesDeleted'] += $deletedAutosaves['filesDeleted'];
            $stats['bytesFreed'] += $deletedAutosaves['bytesFreed'];

            $stats['projectsProcessed']++;
        }

        return $stats;
    }

    /**
     * Limpia versiones antiguas de un proyecto específico.
     *
     * @param string $projectId ID del proyecto
     * @param bool $isManualSave true para guardados manuales, false para autosaves
     * @param int $versionsToKeep Cantidad de versiones a mantener
     * @return array Estadísticas de limpieza
     */
    private function cleanOldVersionsForProject(string $projectId, bool $isManualSave, int $versionsToKeep): array
    {
        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);

        // Obtener todas las versiones del proyecto
        $allVersions = $odeFilesRepo->findBy(
            [
                'odeId' => $projectId,
                'isManualSave' => $isManualSave
            ],
            ['updatedAt' => 'DESC']
        );

        $stats = [
            'filesDeleted' => 0,
            'bytesFreed' => 0,
        ];

        // Mantener solo las últimas N versiones
        $versionsToDelete = array_slice($allVersions, $versionsToKeep);

        foreach ($versionsToDelete as $version) {
            /** @var OdeFiles $version */
            $fileName = $version->getFileName();
            $permDir = $this->fileHelper->getPermanentContentStorageOdesDir();

            // Construir path: /perm/odes/YYYY/MM/DD/filename.elpx
            // Extraer estructura de fecha desde odeVersionId
            $versionId = $version->getOdeVersionId();
            if (preg_match('/^(\d{4})(\d{2})(\d{2})/', $versionId, $matches)) {
                $year = $matches[1];
                $month = $matches[2];
                $day = $matches[3];
                $filePath = $permDir . $year . DIRECTORY_SEPARATOR .
                           $month . DIRECTORY_SEPARATOR .
                           $day . DIRECTORY_SEPARATOR . $fileName;
            } else {
                // Si no coincide el patrón, skip este archivo
                continue;
            }

            if ($this->filesystem->exists($filePath)) {
                $fileSize = filesize($filePath);

                try {
                    $this->filesystem->remove($filePath);
                    $stats['bytesFreed'] += $fileSize;

                    $this->logger->info('Removed old version file', [
                        'projectId' => $projectId,
                        'versionId' => $version->getOdeVersionId(),
                        'isManualSave' => $isManualSave,
                        'path' => $filePath,
                        'bytesFreed' => $fileSize
                    ]);
                } catch (\Exception $e) {
                    $this->logger->error('Failed to remove version file', [
                        'projectId' => $projectId,
                        'versionId' => $version->getOdeVersionId(),
                        'path' => $filePath,
                        'error' => $e->getMessage()
                    ]);
                    continue;
                }
            }

            // Eliminar registro de la base de datos
            $this->entityManager->remove($version);
            $stats['filesDeleted']++;
        }

        $this->entityManager->flush();

        return $stats;
    }

    /**
     * Limpia archivos huérfanos en /tmp que no tienen sesión asociada.
     *
     * @return array Estadísticas de limpieza
     */
    public function cleanOrphanedTmpFiles(): array
    {
        $stats = [
            'directoriesScanned' => 0,
            'orphanedDirectories' => 0,
            'bytesFreed' => 0,
        ];

        $tmpBaseDir = $this->fileHelper->getTemporaryContentStorageDir();

        if (!$this->filesystem->exists($tmpBaseDir)) {
            return $stats;
        }

        // Obtener todos los sessionIds activos de la base de datos
        $repo = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $activeSessions = $repo->findAll();
        $activeSessionIds = array_map(fn($s) => $s->getOdeSessionId(), $activeSessions);

        // Escanear directorios en /tmp
        $this->scanTmpDirectoriesRecursive($tmpBaseDir, $activeSessionIds, $stats);

        return $stats;
    }

    /**
     * Escanea recursivamente directorios temporales buscando huérfanos.
     *
     * @param string $directory Directorio a escanear
     * @param array $activeSessionIds IDs de sesiones activas
     * @param array &$stats Estadísticas de limpieza (por referencia)
     */
    private function scanTmpDirectoriesRecursive(string $directory, array $activeSessionIds, array &$stats): void
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        $dirsToCheck = [];

        foreach ($iterator as $file) {
            if ($file->isDir()) {
                $dirname = $file->getFilename();
                $dirPath = $file->getPathname();

                // Si el nombre del directorio coincide con el formato de sessionId
                if (preg_match('/^\d{14}[A-Za-z0-9]{6}$/', $dirname)) {
                    $dirsToCheck[] = [
                        'sessionId' => $dirname,
                        'path' => $dirPath
                    ];
                }
            }
        }

        foreach ($dirsToCheck as $dirInfo) {
            $stats['directoriesScanned']++;

            if (!in_array($dirInfo['sessionId'], $activeSessionIds)) {
                // Directorio huérfano
                $sizeBeforeDelete = $this->getDirectorySize($dirInfo['path']);

                try {
                    $this->filesystem->remove($dirInfo['path']);
                    $stats['orphanedDirectories']++;
                    $stats['bytesFreed'] += $sizeBeforeDelete;

                    $this->logger->info('Removed orphaned tmp directory', [
                        'sessionId' => $dirInfo['sessionId'],
                        'path' => $dirInfo['path'],
                        'bytesFreed' => $sizeBeforeDelete
                    ]);
                } catch (\Exception $e) {
                    $this->logger->error('Failed to remove orphaned directory', [
                        'sessionId' => $dirInfo['sessionId'],
                        'path' => $dirInfo['path'],
                        'error' => $e->getMessage()
                    ]);
                }
            }
        }
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
     * Obtiene métricas de uso de almacenamiento.
     *
     * @return array Métricas de almacenamiento
     */
    public function getStorageMetrics(): array
    {
        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);
        $currentOdeUsersRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);

        // Contar archivos y versiones
        $totalFiles = $odeFilesRepo->count([]);
        $totalSessions = $currentOdeUsersRepo->count([]);

        // Calcular tamaño total en /perm
        $permDir = $this->fileHelper->getPermanentContentStorageOdesDir();
        $permSize = $this->filesystem->exists($permDir) ? $this->getDirectorySize($permDir) : 0;

        // Calcular tamaño total en /tmp
        $tmpDir = $this->fileHelper->getTemporaryContentStorageDir();
        $tmpSize = $this->filesystem->exists($tmpDir) ? $this->getDirectorySize($tmpDir) : 0;

        return [
            'totalFiles' => $totalFiles,
            'activeSessions' => $totalSessions,
            'permStorageBytes' => $permSize,
            'tmpStorageBytes' => $tmpSize,
            'totalStorageBytes' => $permSize + $tmpSize,
            'permStorageHuman' => $this->formatBytes($permSize),
            'tmpStorageHuman' => $this->formatBytes($tmpSize),
            'totalStorageHuman' => $this->formatBytes($permSize + $tmpSize),
        ];
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
