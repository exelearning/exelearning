<?php

namespace App\Command\Storage;

use App\Service\Storage\ProactiveCleanupService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:storage:cleanup',
    description: 'Limpia archivos temporales abandonados y versiones antiguas de autosave'
)]
class CleanupStorageCommand extends Command
{
    private ProactiveCleanupService $cleanupService;

    public function __construct(ProactiveCleanupService $cleanupService)
    {
        parent::__construct();
        $this->cleanupService = $cleanupService;
    }

    protected function configure(): void
    {
        $this
            ->addOption(
                'sessions',
                's',
                InputOption::VALUE_NONE,
                'Limpiar solo sesiones abandonadas'
            )
            ->addOption(
                'autosaves',
                'a',
                InputOption::VALUE_NONE,
                'Limpiar solo versiones antiguas de autosave'
            )
            ->addOption(
                'orphaned',
                'o',
                InputOption::VALUE_NONE,
                'Limpiar solo archivos huérfanos en /tmp'
            )
            ->addOption(
                'metrics',
                'm',
                InputOption::VALUE_NONE,
                'Mostrar solo métricas de almacenamiento sin limpiar'
            )
            ->setHelp(<<<'HELP'
Este comando ejecuta tareas de limpieza proactiva del sistema de almacenamiento:

<info>Limpieza completa (por defecto):</info>
  php bin/console app:storage:cleanup

<info>Limpieza selectiva:</info>
  php bin/console app:storage:cleanup --sessions     # Solo sesiones abandonadas
  php bin/console app:storage:cleanup --autosaves    # Solo versiones antiguas
  php bin/console app:storage:cleanup --orphaned     # Solo archivos huérfanos

<info>Ver métricas sin limpiar:</info>
  php bin/console app:storage:cleanup --metrics

<info>Uso recomendado con cron:</info>
  # Cada hora: limpiar sesiones abandonadas
  0 * * * * php /app/bin/console app:storage:cleanup --sessions

  # Cada día a las 3 AM: limpieza completa
  0 3 * * * php /app/bin/console app:storage:cleanup
HELP
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('Limpieza de Almacenamiento - eXeLearning');

        // Mostrar métricas antes de la limpieza
        $metricsBefore = $this->cleanupService->getStorageMetrics();

        if ($input->getOption('metrics')) {
            $this->displayMetrics($io, $metricsBefore);

            return Command::SUCCESS;
        }

        $io->section('Métricas antes de la limpieza');
        $this->displayMetrics($io, $metricsBefore);

        // Determinar qué tareas ejecutar
        $runSessions = $input->getOption('sessions');
        $runAutosaves = $input->getOption('autosaves');
        $runOrphaned = $input->getOption('orphaned');

        // Si no se especifica ninguna opción, ejecutar todas las tareas
        $runAll = !$runSessions && !$runAutosaves && !$runOrphaned;

        $totalStats = [
            'sessionsDeleted' => 0,
            'autosavesDeleted' => 0,
            'orphanedDirectories' => 0,
            'totalBytesFreed' => 0,
        ];

        // Ejecutar limpieza de sesiones abandonadas
        if ($runAll || $runSessions) {
            $io->section('Limpiando sesiones abandonadas');
            $stats = $this->cleanupService->cleanAbandonedSessions();

            $io->text([
                "Sesiones encontradas: {$stats['sessionsFound']}",
                "Sesiones eliminadas: {$stats['sessionsDeleted']}",
                "Directorios eliminados: {$stats['directoriesRemoved']}",
                'Espacio liberado: '.$this->formatBytes($stats['bytesFreed']),
            ]);

            $totalStats['sessionsDeleted'] = $stats['sessionsDeleted'];
            $totalStats['totalBytesFreed'] += $stats['bytesFreed'];
        }

        // Ejecutar limpieza de autosaves antiguos
        if ($runAll || $runAutosaves) {
            $io->section('Limpiando versiones antiguas de autosave');
            $stats = $this->cleanupService->cleanOldAutosaveVersions();

            $io->text([
                "Proyectos procesados: {$stats['projectsProcessed']}",
                "Autosaves eliminados: {$stats['autosavesDeleted']}",
                'Espacio liberado: '.$this->formatBytes($stats['bytesFreed']),
            ]);

            $totalStats['autosavesDeleted'] = $stats['autosavesDeleted'];
            $totalStats['totalBytesFreed'] += $stats['bytesFreed'];
        }

        // Ejecutar limpieza de archivos huérfanos
        if ($runAll || $runOrphaned) {
            $io->section('Limpiando archivos huérfanos en /tmp');
            $stats = $this->cleanupService->cleanOrphanedTmpFiles();

            $io->text([
                "Directorios escaneados: {$stats['directoriesScanned']}",
                "Directorios huérfanos eliminados: {$stats['orphanedDirectories']}",
                'Espacio liberado: '.$this->formatBytes($stats['bytesFreed']),
            ]);

            $totalStats['orphanedDirectories'] = $stats['orphanedDirectories'];
            $totalStats['totalBytesFreed'] += $stats['bytesFreed'];
        }

        // Mostrar métricas después de la limpieza
        $metricsAfter = $this->cleanupService->getStorageMetrics();

        $io->section('Métricas después de la limpieza');
        $this->displayMetrics($io, $metricsAfter);

        // Resumen final
        $io->section('Resumen de limpieza');
        $io->table(
            ['Categoría', 'Eliminados'],
            [
                ['Sesiones abandonadas', $totalStats['sessionsDeleted']],
                ['Versiones de autosave', $totalStats['autosavesDeleted']],
                ['Directorios huérfanos', $totalStats['orphanedDirectories']],
            ]
        );

        $io->success([
            'Limpieza completada exitosamente',
            'Espacio total liberado: '.$this->formatBytes($totalStats['totalBytesFreed']),
        ]);

        return Command::SUCCESS;
    }

    /**
     * Muestra las métricas de almacenamiento en formato tabla.
     */
    private function displayMetrics(SymfonyStyle $io, array $metrics): void
    {
        $io->table(
            ['Métrica', 'Valor'],
            [
                ['Total de archivos', number_format($metrics['totalFiles'])],
                ['Sesiones activas', number_format($metrics['activeSessions'])],
                ['Almacenamiento permanente (/perm)', $metrics['permStorageHuman']],
                ['Almacenamiento temporal (/tmp)', $metrics['tmpStorageHuman']],
                ['<info>Total almacenamiento</info>', "<info>{$metrics['totalStorageHuman']}</info>"],
            ]
        );
    }

    /**
     * Formatea bytes a formato legible.
     */
    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; ++$i) {
            $bytes /= 1024;
        }

        return round($bytes, $precision).' '.$units[$i];
    }
}
