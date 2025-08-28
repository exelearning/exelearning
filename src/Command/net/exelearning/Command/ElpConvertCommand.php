<?php

namespace App\Command\net\exelearning\Command;

use App\Constants;
use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Repository\net\exelearning\Repository\UserRepository;
use App\Service\net\exelearning\Service\Api\OdeExportServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Service\net\exelearning\Service\FilesDir\FilesDirServiceInterface;
use App\Util\net\exelearning\Util\FileUtil;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Command to convert old ELP files (contentv2.xml, contentv3.xml) to the current format (content.xml).
 *
 * This command leverages the existing application functionality to open and process ELP files,
 * using the same flow as the web application when opening and exporting files.
 *
 * Supports reading from stdin using "-" as the input argument.
 */
#[AsCommand(
    name: 'elp:convert',
    description: 'Convert old ELP files to the current format',
)]
class ElpConvertCommand extends Command
{
    private OdeServiceInterface $odeService;
    private OdeExportServiceInterface $odeExportService;
    private FileHelper $fileHelper;
    private FilesDirServiceInterface $filesDirService;
    private UserRepository $userRepository;
    private EntityManagerInterface $entityManager;

    /**
     * Constructor with dependency injection.
     */
    public function __construct(
        OdeServiceInterface $odeService,
        OdeExportServiceInterface $odeExportService,
        FileHelper $fileHelper,
        FilesDirServiceInterface $filesDirService,
        UserRepository $userRepository,
        EntityManagerInterface $entityManager,
    ) {
        $this->odeService = $odeService;
        $this->odeExportService = $odeExportService;
        $this->fileHelper = $fileHelper;
        $this->filesDirService = $filesDirService;
        $this->userRepository = $userRepository;
        $this->entityManager = $entityManager;

        parent::__construct();
    }

    /**
     * Configure the command with arguments and options.
     */
    protected function configure(): void
    {
        $this
            ->addArgument('input', InputArgument::REQUIRED, 'Input ELP file path (use "-" for stdin)')
            ->addArgument('output', InputArgument::REQUIRED, 'Output ELP file path')
            ->addOption('debug', 'd', InputOption::VALUE_NONE, 'Enable debug mode');
    }

    /**
     * Execute the command to convert an ELP file.
     *
     * This method follows the same flow as the application when opening and exporting ELP files:
     * 1. Check if the input file exists and is a valid ELP file (or read from stdin if "-" is specified)
     * 2. Create a temporary session directory
     * 3. Use OdeService to open and process the ELP file
     * 4. Use OdeExportService to export the processed file to the output path
     * 5. Clean up temporary files
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $inputPath = $input->getArgument('input');
        $outputPath = $input->getArgument('output');
        $debug = $input->getOption('debug');

        // Create a temporary file for stdin input if needed
        $tempFile = null;
        $useStdin = ('-' === $inputPath);

        if ($useStdin) {
            if ($debug) {
                $io->section('Reading ELP data from stdin');
            }

            // Create a temporary file to store stdin data
            $tempFile = tempnam(sys_get_temp_dir(), 'elp_convert_');
            $tempHandle = fopen($tempFile, 'w');

            // Read from stdin
            $stdinHandle = fopen('php://stdin', 'r');
            stream_copy_to_stream($stdinHandle, $tempHandle);
            fclose($stdinHandle);
            fclose($tempHandle);

            // Use the temporary file as input
            $inputPath = $tempFile;

            if ($debug) {
                $io->text("Stdin data saved to temporary file: $tempFile");
            }
        } else {
            // Validate input file
            if (!file_exists($inputPath)) {
                $io->error("Input file not found: $inputPath");

                return Command::FAILURE;
            }
        }

        if ($debug) {
            $io->section('Starting ELP conversion process');
            $io->text('Input: '.($useStdin ? 'stdin' : $inputPath));
            $io->text("Output file: $outputPath");
        }

        // Always create an ephemeral user for the conversion process
        $user = $this->createEphemeralUser();

        // Generate FILES_DIR directory structure. IMPORTANT, because usually this is created on login WTF!
        $this->filesDirService->checkFilesDir();

        // Generate a unique session ID for this conversion
        $odeSessionId = $this->generateSessionId();

        if ($debug) {
            $io->text("Generated session ID: $odeSessionId");
        }

        // Create session directories
        $sessionDir = $this->fileHelper->getOdeSessionDir($odeSessionId);
        $sessionDistDir = $sessionDir.'dist/';

        if ($debug) {
            $io->text("Created session directory: $sessionDir");
        }

        // Ensure directories exist
        FileUtil::ensureDirectoryExists($sessionDir);
        FileUtil::ensureDirectoryExists($sessionDistDir);

        // Copy input file to session directory
        $inputFileName = $useStdin ? 'stdin.elp' : basename($inputPath);
        $sessionFilePath = $sessionDistDir.$inputFileName;
        FileUtil::copyFile($inputPath, $sessionFilePath);

        if ($debug) {
            $io->text('Copied input file to session directory');
        }

        // Check if the file is a valid ELP file
        $checkResult = $this->odeService->checkLocalOdeFile(
            $inputFileName,
            $sessionFilePath,
            $user,
            true // Force close any previous session
        );

        if ('OK' !== $checkResult['responseMessage']) {
            $io->error('Invalid ELP file: '.$checkResult['responseMessage']);
            $this->cleanupSession($sessionDir);
            // Remove ephemeral user
            $this->removeEphemeralUser($user);
            if ($tempFile) {
                unlink($tempFile);
            }

            return Command::FAILURE;
        }

        if ($debug) {
            $io->success('Input file validated successfully');
            if (isset($checkResult['isOldFormat']) && $checkResult['isOldFormat']) {
                $io->text('Detected old format ELP file');
            }
        }

        // Create ELP structure and process the file
        $result = $this->odeService->createElpStructureAndCurrentOdeUser(
            $inputFileName,
            $user,
            $user,
            '127.0.0.1', // Mock IP address
            true, // Force close any previous session
            $checkResult
        );

        if ($debug) {
            $io->text('ELP structure created with session ID: '.$checkResult['odeSessionId']);
        }

        // Export the processed file
        $exportResult = $this->odeExportService->export(
            $user,                  // UserInterface
            $user,                  // dbUser (the same in this case)
            $checkResult['odeSessionId'],
            false,                  // baseUrl (false because it is not a preview)
            Constants::EXPORT_TYPE_ELP,
            false,                  // preview
            false                   // isIntegration
        );

        if ('OK' !== $exportResult['responseMessage']) {
            // Close ODE session before cleanup
            try {
                $this->odeService->closeOdeSession($checkResult['odeSessionId'] ?? null, 0, $user);
            } catch (\Throwable $e) {
            }
            $io->error('Export failed: '.$exportResult['responseMessage']);
            $this->cleanupSession($sessionDir);
            $this->removeEphemeralUser($user);
            if ($tempFile) {
                unlink($tempFile);
            }

            return Command::FAILURE;
        }

        // Copy the exported file to the output path
        $exportedFilePath = $this->fileHelper->getOdeSessionUserTmpExportDir($checkResult['odeSessionId'], $user).$exportResult['zipFileName'];

        FileUtil::copyFile($exportedFilePath, $outputPath);

        if ($debug) {
            $io->text('Exported file copied to output path');
        }

        // Close ODE session and clean up the session
        try {
            $this->odeService->closeOdeSession($checkResult['odeSessionId'] ?? null, 0, $user);
        } catch (\Throwable $e) {
        }
        $this->cleanupSession($sessionDir);

        // Clean up temporary file if used
        if ($tempFile) {
            unlink($tempFile);
            if ($debug) {
                $io->text('Temporary stdin file removed');
            }
        }

        $io->success("ELP file successfully converted and saved to: $outputPath");

        // Remove ephemeral user
        $this->removeEphemeralUser($user);

        return Command::SUCCESS;
    }

    private function createEphemeralUser(): User
    {
        $user = new User();
        $email = sprintf('tmp+%s@local', bin2hex(random_bytes(6)));
        $userId = bin2hex(random_bytes(20));
        $password = bin2hex(random_bytes(12));

        $user->setEmail($email);
        $user->setUserId($userId);
        $user->setPassword($password);
        $user->setIsLopdAccepted(true);

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $user;
    }

    private function removeEphemeralUser(User $user): void
    {
        try {
            $managed = $this->entityManager->contains($user) ? $user : $this->entityManager->merge($user);
            $this->entityManager->remove($managed);
            $this->entityManager->flush();
        } catch (\Throwable $e) {
            // ignore if already removed
        }
    }

    /**
     * Generate a unique session ID for this conversion.
     */
    private function generateSessionId(): string
    {
        // Create timestamp part in format YYYYMMDDHHmmss
        $timestamp = date('YmdHis');

        // Generate random alphanumeric suffix (5 characters)
        $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $suffix = '';
        for ($i = 0; $i < 5; ++$i) {
            $suffix .= $characters[rand(0, strlen($characters) - 1)];
        }

        // Combine timestamp and suffix
        return $timestamp.$suffix;
    }

    /**
     * Clean up the temporary session directory.
     */
    private function cleanupSession(string $sessionDir): void
    {
        if (file_exists($sessionDir)) {
            FileUtil::removeDir($sessionDir);
        }
    }
}
