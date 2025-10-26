<?php
/**
 * Custom router for PHP's built-in server
 * Serves static files for offline mode in eXeLearning
 */

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$requestedFile = __DIR__ . $uri;

/**
 * Map file extensions to MIME types
 */
$mimeTypes = [
    'html'  => 'text/html',
    'htm'   => 'text/html',
    'css'   => 'text/css',
    'js'    => 'application/javascript',
    'json'  => 'application/json',
    'xml'   => 'application/xml',
    'jpg'   => 'image/jpeg',
    'jpeg'  => 'image/jpeg',
    'png'   => 'image/png',
    'gif'   => 'image/gif',
    'svg'   => 'image/svg+xml',
    'pdf'   => 'application/pdf',
    'txt'   => 'text/plain',
    'mp3'   => 'audio/mpeg',
    'mp4'   => 'video/mp4',
    'webm'  => 'video/webm',
    'woff'  => 'font/woff',
    'woff2' => 'font/woff2',
    'ttf'   => 'font/ttf',
    'eot'   => 'application/vnd.ms-fontobject',
    'otf'   => 'font/otf',
];

/**
 * Serve a static file with proper headers
 */
function serveFile(string $path, array $mimeTypes): void {
    if (!file_exists($path)) {
        header('HTTP/1.1 404 Not Found');
        echo "File not found: " . htmlspecialchars($path);
        exit;
    }

    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $contentType = $mimeTypes[$extension] ?? 'application/octet-stream';
	header("Content-Type: {$contentType}; charset=UTF-8");
    readfile($path);
    exit;
}

// Handle versioned asset paths: /assets/vX.Y.Z/... → /public/...
if (preg_match('#^/assets/v[^/]+/(.*)$#', $uri, $matches)) {
    
    $path = __DIR__ . '/' . $matches[1];
    serveFile($path, $mimeTypes);
}

// Handle /files/tmp/... requests using FILES_DIR
if (preg_match('#^/files/tmp/(.*)$#', $uri, $matches)) {
    $filesDir = getenv('FILES_DIR');

    if (!$filesDir) {
        header('HTTP/1.1 500 Internal Server Error');
        echo "Error: FILES_DIR environment variable is not set.";
        exit;
    }

    $path = rtrim($filesDir, '/') . '/tmp/' . $matches[1];
    serveFile($path, $mimeTypes);
}

if (file_exists($requestedFile) && is_file($requestedFile)) {
    serveFile($requestedFile, $mimeTypes);
}

// For all other requests, let the built-in server handle them
return false;
