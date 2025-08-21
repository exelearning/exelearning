#!/usr/bin/env php
<?php
declare(strict_types=1);

/**
 * Update /public/libs/README from templates/license/README.tpl
 *
 * - Reads Composer metadata from composer.lock (preferred) and vendor/composer/installed.json (fallback).
 * - Renders a list of packages into <composer_packages> placeholder in templates/license/README.tpl.
 * - For each package:
 *     * Package: vendor/package
 *     * Copyright:
 *         - Use Composer authors if present (DO NOT override).
 *         - If no authors, try to read LICENSE/COPYRIGHT to build segments like:
 *             "(c) 2004-2020 Facebook, 2020-present open-source contributors"
 *         - If still empty, try to extract "by ..." authors from README/AUTHORS.
 *         - Else "Unknown".
 *     * License: from Composer metadata.
 *
 * This script DOES NOT generate /public/libs/LICENSES (manual curation).
 */

error_reporting(E_ALL);

/* -------------------------------------------------------------------------
 * Paths
 * ---------------------------------------------------------------------- */
$rootDir       = dirname(__DIR__);
$templatesDir  = $rootDir . '/templates/license';
$outputDir     = $rootDir . '/public/libs';
$readmeTplPath = $templatesDir . '/README.tpl';
$readmeOutPath = $outputDir . '/README';

$composerJsonPath  = $rootDir . '/composer.json';
$composerLockPath  = $rootDir . '/composer.lock';
$installedJsonPath = $rootDir . '/vendor/composer/installed.json';
$installedJsonAlt  = $rootDir . '/vendor/installed.json'; // some setups

$vendorDir = detect_vendor_dir($composerJsonPath, $rootDir);

/* -------------------------------------------------------------------------
 * Build package map
 * ---------------------------------------------------------------------- */
$fromLock  = read_packages_from_lock($composerLockPath);
$fromInst1 = read_packages_from_installed_json($installedJsonPath);
$fromInst2 = read_packages_from_installed_json($installedJsonAlt);
$packages  = merge_pkg_maps($fromLock, $fromInst1);
$packages  = merge_pkg_maps($packages, $fromInst2);

if (!count($packages)) {
    fwrite(STDERR, "[ERROR] No Composer packages found. Is composer.lock present?\n");
    exit(1);
}

/* -------------------------------------------------------------------------
 * Complete ONLY unknown authors with fallbacks from vendor files
 * ---------------------------------------------------------------------- */
foreach ($packages as $name => &$pkg) {
    $hasAuthors = !empty($pkg['authors']);
    if ($hasAuthors) {
        // Keep Composer authors untouched.
        continue;
    }

    $pkgPath = package_install_path($vendorDir, $name);
    if ($pkgPath === null) {
        continue;
    }

    // 1) Try LICENSE/COPYRIGHT → build "(c) YEAR[-YEAR|present] Owner" segments
    $licFiles = find_license_files($pkgPath);
    foreach ($licFiles as $file) {
        $text = read_file_head($file, 131072); // read up to 128 KiB
        if ($text === '') {
            continue;
        }
        $segments = extract_copyright_segments_from_license_text($text);
        if (!empty($segments)) {
            // Store segments; renderer will print them as a single "(c) ..." line.
            $pkg['copyright_segments'] = $segments;
            break;
        }
    }

    if (!empty($pkg['copyright_segments'])) {
        continue; // already have precise segments; no need to guess authors
    }

    // 2) Fallback to README/AUTHORS → try to guess authors ("by ..." etc.)
    $fallbacks = ['AUTHORS', 'AUTHORS.txt', 'AUTHORS.md', 'README', 'README.md'];
    foreach ($fallbacks as $rel) {
        $path = $pkgPath . '/' . $rel;
        if (!is_file($path)) {
            continue;
        }
        $text = read_file_head($path, 65536); // 64 KiB
        if ($text === '') {
            continue;
        }
        $authors = extract_authors_from_text($text);
        if (!empty($authors)) {
            $pkg['authors'] = $authors;
            break;
        }
    }
}
unset($pkg);

/* -------------------------------------------------------------------------
 * Render README from template
 * ---------------------------------------------------------------------- */
if (!is_file($readmeTplPath)) {
    fwrite(STDERR, "[ERROR] Template not found: {$readmeTplPath}\n");
    exit(1);
}

$tpl = (string) file_get_contents($readmeTplPath);
$md  = render_markdown_list($packages);

$out = str_replace('<composer_packages>', $md, $tpl);

if (!is_dir($outputDir) && !mkdir($outputDir, 0775, true) && !is_dir($outputDir)) {
    fwrite(STDERR, "[ERROR] Unable to create directory: {$outputDir}\n");
    exit(1);
}

file_put_contents($readmeOutPath, $out);

echo "Updated {$readmeOutPath} with " . count($packages) . " Composer packages.\n";
exit(0);

/* =========================================================================
 * Helpers
 * ========================================================================= */

/**
 * Detect Composer vendor directory from composer.json ("config.vendor-dir"), default "vendor".
 */
function detect_vendor_dir(string $composerJsonPath, string $rootDir): string
{
    if (is_file($composerJsonPath)) {
        $cfg = json_decode((string) file_get_contents($composerJsonPath), true);
        if (is_array($cfg) && isset($cfg['config']['vendor-dir']) && is_string($cfg['config']['vendor-dir'])) {
            $path = $cfg['config']['vendor-dir'];
            if (!str_starts_with($path, DIRECTORY_SEPARATOR)) {
                $path = $rootDir . DIRECTORY_SEPARATOR . $path;
            }
            return $path;
        }
    }
    return $rootDir . '/vendor';
}

/**
 * Read packages from composer.lock (preferred). Normalizes authors and license.
 *
 * @return array<string, array{name:string,authors:array<int,string>,license:array<int,string>,version:?string}>
 */
function read_packages_from_lock(string $lockPath): array
{
    if (!is_file($lockPath)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($lockPath), true);
    if (!is_array($data)) {
        return [];
    }
    $all = [];
    foreach (['packages', 'packages-dev'] as $key) {
        if (!isset($data[$key]) || !is_array($data[$key])) {
            continue;
        }
        foreach ($data[$key] as $pkg) {
            if (!isset($pkg['name'])) {
                continue;
            }
            $name    = (string) $pkg['name'];
            $authors = authors_to_names($pkg['authors'] ?? null);
            $license = normalize_license($pkg['license'] ?? null);
            $version = isset($pkg['version']) ? (string) $pkg['version'] : null;

            $all[$name] = [
                'name'    => $name,
                'authors' => $authors,
                'license' => $license,
                'version' => $version,
            ];
        }
    }
    return $all;
}

/**
 * Read packages from vendor/composer/installed.json (fallback).
 *
 * @return array<string, array{name:string,authors:array<int,string>,license:array<int,string>,version:?string}>
 */
function read_packages_from_installed_json(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $json = json_decode((string) file_get_contents($path), true);
    if (!is_array($json)) {
        return [];
    }

    $extract = static function (array $packages): array {
        $out = [];
        foreach ($packages as $pkg) {
            if (!isset($pkg['name'])) {
                continue;
            }
            $name    = (string) $pkg['name'];
            $authors = authors_to_names($pkg['authors'] ?? null);
            $license = normalize_license($pkg['license'] ?? null);
            $version = isset($pkg['version']) ? (string) $pkg['version'] : null;

            $out[$name] = [
                'name'    => $name,
                'authors' => $authors,
                'license' => $license,
                'version' => $version,
            ];
        }
        return $out;
    };

    // {"packages":[...]}
    if (isset($json['packages']) && is_array($json['packages'])) {
        return $extract($json['packages']);
    }

    // [ {"packages":[...]}, ... ]
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
 * Merge two package maps; base wins. Only fill missing fields.
 *
 * @param array<string, array> $base
 * @param array<string, array> $fallback
 */
function merge_pkg_maps(array $base, array $fallback): array
{
    foreach ($fallback as $name => $pkg) {
        if (!isset($base[$name])) {
            $base[$name] = $pkg;
            continue;
        }
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
 * Convert Composer authors array to a list of names.
 *
 * @param array<int, array<string, mixed>>|null $authors
 * @return array<int,string>
 */
function authors_to_names(?array $authors): array
{
    if (!is_array($authors)) {
        return [];
    }
    $names = [];
    foreach ($authors as $a) {
        if (isset($a['name']) && is_string($a['name']) && $a['name'] !== '') {
            $names[] = trim($a['name']);
        }
    }
    return $names;
}

/**
 * Normalize license field (string|array|null) to array<string>.
 *
 * @param mixed $license
 * @return array<int,string>
 */
function normalize_license(mixed $license): array
{
    if (is_string($license)) {
        return [$license];
    }
    if (is_array($license)) {
        return array_values(array_filter(array_map('strval', $license)));
    }
    return [];
}

/**
 * Build vendor/<vendor>/<package> absolute path.
 */
function package_install_path(string $vendorDir, string $packageName): ?string
{
    $parts = explode('/', $packageName, 2);
    if (count($parts) !== 2) {
        return null;
    }
    $path = $vendorDir . '/' . $parts[0] . '/' . $parts[1];
    return is_dir($path) ? $path : null;
}

/**
 * Read first N bytes of a file (safe for big files).
 */
function read_file_head(string $file, int $bytes): string
{
    if (!is_file($file) || !is_readable($file)) {
        return '';
    }
    $fh = fopen($file, 'rb');
    if ($fh === false) {
        return '';
    }
    $data = fread($fh, $bytes);
    fclose($fh);
    return is_string($data) ? $data : '';
}

/* -------------------------------------------------------------------------
 * License/README parsing helpers (fallbacks ONLY for Unknown authors)
 * ---------------------------------------------------------------------- */

/**
 * Replace Markdown links, remove URLs, and normalize © markers to "(c)".
 */
function normalize_text_for_scan(string $text): string
{
    $text = preg_replace('/\[[^\]]*\]\([^)]*\)/u', '', $text) ?? $text; // drop [Text](url)
    $text = preg_replace('~https?://\S+~i', '', $text) ?? $text;        // drop raw URLs
    $text = str_ireplace(['©', '(c)', 'c)'], ['(c)', '(c)', '(c)'], $text);
    return $text;
}

/**
 * Return likely LICENSE/COPYRIGHT files for a package.
 *
 * @return array<int,string>
 */
function find_license_files(string $pkgPath): array
{
    $cands = [
        'LICENSE', 'LICENSE.txt', 'LICENSE.md',
        'COPYRIGHT', 'COPYRIGHT.txt', 'COPYRIGHT.md',
        'COPYING', 'COPYING.txt', 'COPYING.md',
    ];
    $files = [];
    foreach ($cands as $c) {
        $p = $pkgPath . '/' . $c;
        if (is_file($p)) {
            $files[] = $p;
        }
    }
    foreach (glob($pkgPath . '/LICENSE*') ?: [] as $g) {
        if (is_file($g) && !in_array($g, $files, true)) {
            $files[] = $g;
        }
    }
    return $files;
}

/**
 * Extract "(c) YEAR[-YEAR|present] Owner" segments from LICENSE/COPYRIGHT lines.
 * Example outputs:
 *   - "2004-2020 Facebook"
 *   - "2020-present open-source contributors"
 *
 * @return array<int,string>
 */
function extract_copyright_segments_from_license_text(string $text): array
{
    $text  = normalize_text_for_scan($text);
    $lines = preg_split('/\R/u', $text) ?: [];
    $lines = array_slice($lines, 0, 200);

    $segments = [];

    foreach ($lines as $line) {
        $l = trim($line);
        if ($l === '') {
            continue;
        }

        // Skip license headings
        if (preg_match('/^\s*(the\s+)?mit\s+license\b/i', $l)) {
            continue;
        }
        if (preg_match('/^\s*(gnu|apache|bsd|mozilla|mpl)\b/i', $l)) {
            continue;
        }

        // Copyright lines
        if (preg_match('/^\s*(?:copyright|\(c\))\s*/i', $l)) {
            $l = preg_replace('/^\s*(?:copyright|\(c\))\s*/i', '', $l) ?? $l;

            // Capture groups: years + owner (multiple groups per line allowed)
            if (preg_match_all('/(\d{4}(?:\s*-\s*(?:\d{4}|present))?)\s*,?\s+([^,.;]+)/i', $l, $m, PREG_SET_ORDER)) {
                foreach ($m as $g) {
                    $years = trim($g[1]);
                    $owner = cleanup_owner_for_copyright(trim($g[2]));
                    if ($years === '' || $owner === '') {
                        continue;
                    }
                    // Cut disclaimer tails from owner
                    $owner = preg_split(
                        '/\b(all rights reserved|permission is hereby|provided\b|without\b|warranty|liability|notice|claim|damages)\b/i',
                        $owner
                    )[0] ?? $owner;
                    $owner = cleanup_owner_for_copyright($owner);
                    if ($owner !== '') {
                        $segments[] = $years . ' ' . $owner;
                    }
                }
            }
        }
    }

    // Unique while preserving order
    $seen = [];
    $segments = array_values(array_filter($segments, function (string $seg) use (&$seen): bool {
        if (isset($seen[$seg])) {
            return false;
        }
        $seen[$seg] = true;
        return true;
    }));

    return $segments;
}

/**
 * Clean a copyright owner token (keep "open-source contributors", remove emails/parentheses).
 */
function cleanup_owner_for_copyright(string $s): string
{
    $s = preg_replace('/<[^>]+>/', '', $s) ?? $s;   // remove emails
    $s = preg_replace('/\([^)]*\)/', '', $s) ?? $s; // remove (...) tails
    $s = trim($s, " \t\n\r\0\x0B,.;&:/-");
    $s = preg_replace('/\s{2,}/', ' ', $s) ?? $s;
    return $s;
}

/**
 * Fallback: extract authors from README/AUTHORS text using "by ..." heuristics.
 *
 * @return array<int,string>
 */
function extract_authors_from_text(string $text): array
{
    $text  = normalize_text_for_scan($text);
    $lines = preg_split('/\R/u', $text) ?: [];
    $lines = array_slice($lines, 0, 100);

    $authors = [];

    foreach ($lines as $line) {
        $l = trim($line);
        if ($l === '') {
            continue;
        }

        // "by Alice, Bob and Carol"
        if (preg_match('/\bby\s+(.+)$/i', $l, $m)) {
            $tail = preg_split('/[.;]| - /', $m[1])[0] ?? $m[1];
            foreach (preg_split('/\s*,\s*|\s+and\s+|\s*&\s*/i', (string) $tail) as $tok) {
                $tok = cleanup_author($tok);
                if (is_valid_author($tok)) {
                    $authors[] = $tok;
                }
            }
            continue;
        }

        // Minimal "Copyright (c) YEAR Owner" fallback
        if (preg_match('/^\s*(copyright|\(c\))\b/i', $l)) {
            $l = preg_replace('/^\s*(?:copyright|\(c\))\s*/i', '', $l) ?? $l;
            $l = preg_replace('/^\s*\d{4}(?:\s*-\s*(?:\d{4}|present))?[,.\s:-]*/i', '', $l) ?? $l;
            $l = cleanup_author($l);
            if (is_valid_author($l)) {
                $authors[] = $l;
            }
        }
    }

    return array_values(array_unique(array_filter($authors, static fn($x) => $x !== '')));
}

function cleanup_author(string $s): string
{
    $s = preg_replace('/<[^>]+>/', '', $s) ?? $s;   // remove emails
    $s = preg_replace('/\([^)]*\)/', '', $s) ?? $s; // remove (...) tails
    $s = preg_replace('/\b(contributor[s]?|author[s]?|maintainer[s]?|team|project\s+contributors?)\b/i', '', $s) ?? $s;
    $s = trim($s, " \t\n\r\0\x0B,.;&:/-");
    $s = preg_replace('/\s{2,}/', ' ', $s) ?? $s;
    return $s;
}

function is_valid_author(string $s): bool
{
    if ($s === '') {
        return false;
    }
    if (!preg_match('/\p{L}/u', $s)) { // must contain letters
        return false;
    }
    // Reject obvious license/disclaimer vocabulary
    $bad = [
        'license','licence','mit','gpl','lgpl','agpl','bsd','apache','mpl',
        'holders','liability','warranty','damages','claim','reserved',
        'permission','notice','merchantability','fitness','noninfringement',
        'open-source','contributors','contributor','graphs','copy','copies','sell','subject to'
    ];
    $low = mb_strtolower($s);
    foreach ($bad as $w) {
        if (str_contains($low, $w)) {
            return false;
        }
    }
    return true;
}

/**
 * Render Markdown list. Prefer authors if present; else use segments; else "Unknown".
 *
 * @param array<string, array{name:string,authors:array<int,string>,license:array<int,string>,version:?string, copyright_segments?:array<int,string>}> $pkgs
 */
function render_markdown_list(array $pkgs): string
{
    ksort($pkgs, SORT_NATURAL | SORT_FLAG_CASE);
    $lines = [];
    foreach ($pkgs as $p) {
        $name     = $p['name'];
        $licenses = $p['license'] ?? [];
        $authors  = $p['authors'] ?? [];

        $lines[] = "*   Package: {$name}";

        if (!empty($authors)) {
            $lines[] = "    *   Copyright: " . implode(', ', $authors);
        } elseif (!empty($p['copyright_segments'])) {
            $lines[] = "    *   Copyright: (c) " . implode(', ', $p['copyright_segments']);
        } else {
            $lines[] = "    *   Copyright: Unknown";
        }

        $lines[] = "    *   License: " . (!empty($licenses) ? implode(', ', $licenses) : 'Unknown');
    }
    return implode("\n", $lines);
}
