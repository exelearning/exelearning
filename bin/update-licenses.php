#!/usr/bin/env php
<?php
declare(strict_types=1);

/**
 * Update /public/libs/README from templates/license/README.tpl
 * - Injects <composer_packages> with entries from composer.lock
 * - Fallback to vendor/composer/installed.json for missing fields
 * - Does NOT generate /public/libs/LICENSES (manual curation as agreed)
 */

error_reporting(E_ALL);

$rootDir       = dirname(__DIR__);
$templatesDir  = $rootDir . '/templates/license';
$outputDir     = $rootDir . '/public/libs';
$readmeTplPath = $templatesDir . '/README.tpl';
$readmeOutPath = $outputDir . '/README';

$lockPath         = $rootDir . '/composer.lock';
$installedJsonA   = $rootDir . '/vendor/composer/installed.json';
$installedJsonB   = $rootDir . '/vendor/installed.json'; // some setups

// --- helpers ---------------------------------------------------------------

/**
 * @param array<int, array<string, mixed>> $authors
 */
function authors_to_names(?array $authors): array {
    if (!is_array($authors)) {
        return [];
    }
    $names = [];
    foreach ($authors as $a) {
        if (isset($a['name']) && is_string($a['name']) && $a['name'] !== '') {
            $names[] = $a['name'];
        }
    }
    return $names;
}

/**
 * @return array<string, array{name:string,authors:array<int,string>,license:array<int,string>,version:?string}>
 */
function read_packages_from_lock(string $lockPath): array {
    if (!is_file($lockPath)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($lockPath), true);
    if (!is_array($data)) {
        return [];
    }
    $all = [];
    foreach (['packages', 'packages-dev'] as $key) {
        if (!empty($data[$key]) && is_array($data[$key])) {
            foreach ($data[$key] as $pkg) {
                if (!isset($pkg['name'])) {
                    continue;
                }
                $name     = (string) $pkg['name'];
                $authors  = authors_to_names($pkg['authors'] ?? null);
                $license  = array_values(array_filter(array_map('strval', (array) ($pkg['license'] ?? []))));
                $version  = isset($pkg['version']) ? (string) $pkg['version'] : null;

                $all[$name] = [
                    'name'    => $name,
                    'authors' => $authors,
                    'license' => $license,
                    'version' => $version,
                ];
            }
        }
    }
    return $all;
}

/**
 * Composer’s installed.json may be:
 *  - an object with "packages": [...]
 *  - or an array of vendor blocks each with "packages"
 *
 * @return array<string, array{name:string,authors:array<int,string>,license:array<int,string>,version:?string}>
 */
function read_packages_from_installed_json(string $path): array {
    if (!is_file($path)) {
        return [];
    }
    $json = json_decode((string) file_get_contents($path), true);
    if (!is_array($json)) {
        return [];
    }

    $extract = function (array $packages): array {
        $out = [];
        foreach ($packages as $pkg) {
            if (!isset($pkg['name'])) {
                continue;
            }
            $name     = (string) $pkg['name'];
            $authors  = authors_to_names($pkg['authors'] ?? null);
            $license  = array_values(array_filter(array_map('strval', (array) ($pkg['license'] ?? []))));
            $version  = isset($pkg['version']) ? (string) $pkg['version'] : null;

            $out[$name] = [
                'name'    => $name,
                'authors' => $authors,
                'license' => $license,
                'version' => $version,
            ];
        }
        return $out;
    };

    // Case 1: {"packages":[...]}
    if (isset($json['packages']) && is_array($json['packages'])) {
        return $extract($json['packages']);
    }

    // Case 2: [ {"packages":[...]}, {"packages":[...]} ]
    $all = [];
    if (array_is_list($json)) {
        foreach ($json as $block) {
            if (isset($block['packages']) && is_array($block['packages'])) {
                $all += $extract($block['packages']);
            }
        }
    }

    return $all;
}

/**
 * Merge lock data with installed.json as fallback (lock wins).
 *
 * @param array<string, array> $base
 * @param array<string, array> $fallback
 * @return array<string, array>
 */
function merge_pkg_maps(array $base, array $fallback): array {
    foreach ($fallback as $name => $pkg) {
        if (!isset($base[$name])) {
            $base[$name] = $pkg;
            continue;
        }
        // Fill missing authors/license/version
        if (empty($base[$name]['authors']) && !empty($pkg['authors'])) {
            $base[$name]['authors'] = $pkg['authors'];
        }
        if (empty($base[$name]['license']) && !empty($pkg['license'])) {
            $base[$name]['license'] = $pkg['license'];
        }
        if (empty($base[$name]['version']) && !empty($pkg['version'])) {
            $base[$name]['version'] = $pkg['version'];
        }
    }
    return $base;
}

/**
 * @param array<string, array{name:string,authors:array<int,string>,license:array<int,string>,version:?string}> $pkgs
 */
function render_markdown_list(array $pkgs): string {
    ksort($pkgs, SORT_NATURAL | SORT_FLAG_CASE);
    $lines = [];
    foreach ($pkgs as $p) {
        $name     = $p['name'];
        $authors  = $p['authors'];
        $licenses = $p['license'];

        $lines[] = "*   Package: {$name}";
        $lines[] = "    *   Copyright: " . (count($authors) ? implode(', ', $authors) : 'Unknown');
        $lines[] = "    *   License: " . (count($licenses) ? implode(', ', $licenses) : 'Unknown');
    }
    return implode("\n", $lines);
}

// --- build -----------------------------------------------------------------

// Read sources
$fromLock   = read_packages_from_lock($lockPath);
$fromInstA  = read_packages_from_installed_json($installedJsonA);
$fromInstB  = read_packages_from_installed_json($installedJsonB);
$packages   = merge_pkg_maps($fromLock, $fromInstA);
$packages   = merge_pkg_maps($packages, $fromInstB);

if (!count($packages)) {
    fwrite(STDERR, "No Composer packages found. Is composer.lock present?\n");
    exit(1);
}

// Render README from template
if (!is_file($readmeTplPath)) {
    fwrite(STDERR, "Template not found: {$readmeTplPath}\n");
    exit(1);
}
$tpl = (string) file_get_contents($readmeTplPath);
$md  = render_markdown_list($packages);

// Inject
$out = str_replace('<composer_packages>', $md, $tpl);

// Ensure output dir
if (!is_dir($outputDir) && !mkdir($outputDir, 0775, true) && !is_dir($outputDir)) {
    fwrite(STDERR, "Unable to create directory: {$outputDir}\n");
    exit(1);
}

file_put_contents($readmeOutPath, $out);

$pkgCount = count($packages);
echo "Updated {$readmeOutPath} with {$pkgCount} Composer packages.\n";
