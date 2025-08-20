#!/usr/bin/env php
<?php

require_once __DIR__ . '/../vendor/autoload.php';

$vendorDir = __DIR__ . '/../vendor';
$templatesDir = __DIR__ . '/../templates/license';
$outputDir = __DIR__ . '/../public/libs';

// 1. Execute composer licenses command
$composerCommand = 'composer licenses --format=json';
$process = new \Symfony\Component\Process\Process(explode(' ', $composerCommand), __DIR__ . '/../');
$process->run();

if (!$process->isSuccessful()) {
    throw new \RuntimeException($process->getErrorOutput());
}

$licensesJson = $process->getOutput();
$licensesData = json_decode($licensesJson, true);

// 2. Process packages for README
$packagesMarkdown = '';
$allLicenses = [];

foreach ($licensesData['dependencies'] as $name => $details) {
    $packagesMarkdown .= "*   Package: {$name}\n";
    $license = implode(', ', $details['license']);
    $packagesMarkdown .= "    *   License: {$license}\n";
    $allLicenses = array_merge($allLicenses, $details['license']);
}

// 3. Process licenses for LICENSES file
$uniqueLicenses = array_unique($allLicenses);
sort($uniqueLicenses);
$licensesMarkdown = "## Server-side packages licenses\n\n";
foreach ($uniqueLicenses as $license) {
    $licensesMarkdown .= "*   License: {$license}\n";
}

// 4. Update README
$readmeTemplate = file_get_contents($templatesDir . '/README.tpl');
$readmeContent = str_replace('<composer_packages>', trim($packagesMarkdown), $readmeTemplate);
file_put_contents($outputDir . '/README', $readmeContent);

// 5. Update LICENSES
$licensesTemplate = file_get_contents($templatesDir . '/LICENSES.tpl');
$licensesContent = str_replace('<server_licenses>', trim($licensesMarkdown), $licensesTemplate);
file_put_contents($outputDir . '/LICENSES', $licensesContent);

echo "eXeLearning licenses updated successfully.\n";
