<?php

namespace App\Util\net\exelearning\Util;

/**
 * JsonSanitizer.
 *
 * Utility class for sanitizing strings and arrays to ensure safe JSON encoding.
 * Handles invalid UTF-8 sequences, control characters, broken HTML entities,
 * and other problematic content that could cause json_encode() to fail.
 */
class JsonSanitizer
{
    /** @var string Regex pattern to match control characters that should be removed */
    private const CONTROL_CHARS_PATTERN = '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{FEFF}\x{FFFF}\x{FFFE}]/u';

    /** @var array List of encodings to try when detecting/converting text encoding */
    private const ENCODINGS_TO_TRY = [
        'UTF-8',
        'ISO-8859-1',
        'ISO-8859-15',
        'Windows-1252',
        'CP1252',
        'ASCII',
    ];

    /**
     * Sanitizes a value for safe use in JSON encoding.
     *
     * Applies a pipeline of sanitization steps including encoding fixes,
     * control character removal, and HTML entity normalization.
     *
     * @param mixed $value The value to sanitize (any type)
     *
     * @return string Sanitized string safe for JSON encoding
     */
    public static function sanitizeValue($value): string
    {
        if (null === $value || false === $value) {
            return '';
        }

        $text = self::convertToString($value);

        $text = self::fixEncoding($text);
        $text = self::removeControlCharacters($text);
        $text = self::fixBrokenHtmlEntities($text);
        $text = self::fixBrokenEscapeSequences($text);
        $text = self::normalizeWhitespace($text);
        $text = self::removeInvalidUtf8Sequences($text);

        return $text;
    }

    /**
     * Converts any value to its string representation.
     *
     * @param mixed $value The value to convert
     *
     * @return string String representation of the value
     */
    private static function convertToString($value): string
    {
        if (is_string($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (string) $value;
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_array($value) || is_object($value)) {
            $json = json_encode($value);

            return false !== $json ? $json : '';
        }

        if (is_resource($value)) {
            return '';
        }

        return (string) $value;
    }

    /**
     * Fixes text encoding by converting to valid UTF-8.
     *
     * Attempts multiple encoding detection and conversion strategies,
     * with fallbacks for environments without mbstring extension.
     *
     * @param string $text The text to fix
     *
     * @return string Text converted to valid UTF-8
     */
    private static function fixEncoding(string $text): string
    {
        if (self::isValidUtf8($text)) {
            return $text;
        }

        if (!self::mbstringAvailable()) {
            $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $text);
            if (false !== $converted && self::isValidUtf8($converted)) {
                return $converted;
            }

            return self::forceUtf8($text);
        }

        $detectedEncoding = mb_detect_encoding($text, self::ENCODINGS_TO_TRY, true);

        if ($detectedEncoding && 'UTF-8' !== $detectedEncoding) {
            $converted = mb_convert_encoding($text, 'UTF-8', $detectedEncoding);
            if (self::isValidUtf8($converted)) {
                return $converted;
            }
        }

        foreach (self::ENCODINGS_TO_TRY as $encoding) {
            if ('UTF-8' === $encoding) {
                continue;
            }

            $converted = @mb_convert_encoding($text, 'UTF-8', $encoding);
            if (false !== $converted && self::isValidUtf8($converted)) {
                return $converted;
            }
        }

        $converted = @iconv('UTF-8', 'UTF-8//IGNORE//TRANSLIT', $text);
        if (false !== $converted) {
            return $converted;
        }

        return self::forceUtf8($text);
    }

    /**
     * Checks if the mbstring extension is available.
     *
     * Uses static caching for performance.
     *
     * @return bool True if mbstring functions are available
     */
    private static function mbstringAvailable(): bool
    {
        static $available = null;
        if (null === $available) {
            $available = function_exists('mb_check_encoding')
                && function_exists('mb_detect_encoding')
                && function_exists('mb_convert_encoding');
        }

        return $available;
    }

    /**
     * Validates if a string is valid UTF-8.
     *
     * Falls back to preg_match with /u flag when mbstring is not available.
     *
     * @param string $text The text to validate
     *
     * @return bool True if the text is valid UTF-8
     */
    private static function isValidUtf8(string $text): bool
    {
        if (!self::mbstringAvailable()) {
            return 1 === preg_match('//u', $text);
        }

        return mb_check_encoding($text, 'UTF-8')
            && 1 === preg_match('//u', $text);
    }

    /**
     * Forces text to valid UTF-8 by processing byte-by-byte.
     *
     * Last resort fallback when other encoding methods fail.
     * Extracts only valid ASCII and UTF-8 sequences.
     *
     * @param string $text The text to process
     *
     * @return string Text containing only valid UTF-8 characters
     */
    private static function forceUtf8(string $text): string
    {
        $result = '';
        $length = strlen($text);

        for ($i = 0; $i < $length; ++$i) {
            $char = $text[$i];
            $ord = ord($char);

            if ($ord < 128) {
                $result .= $char;
                continue;
            }

            $sequence = self::getUtf8Sequence($text, $i, $length);
            if (null !== $sequence) {
                $result .= $sequence['chars'];
                $i += $sequence['length'] - 1;
            }
        }

        return $result;
    }

    /**
     * Extracts a valid UTF-8 multi-byte sequence starting at the given position.
     *
     * @param string $text   The source text
     * @param int    $pos    Starting position in the text
     * @param int    $length Total length of the text
     *
     * @return array|null Array with 'chars' and 'length' keys, or null if invalid
     */
    private static function getUtf8Sequence(string $text, int $pos, int $length): ?array
    {
        $byte = ord($text[$pos]);

        if (($byte & 0xE0) === 0xC0) {
            $seqLength = 2;
        } elseif (($byte & 0xF0) === 0xE0) {
            $seqLength = 3;
        } elseif (($byte & 0xF8) === 0xF0) {
            $seqLength = 4;
        } else {
            return null;
        }

        if ($pos + $seqLength > $length) {
            return null;
        }

        $sequence = substr($text, $pos, $seqLength);
        if (1 === preg_match('//u', $sequence)) {
            return ['chars' => $sequence, 'length' => $seqLength];
        }

        return null;
    }

    /**
     * Removes control characters from text.
     *
     * Removes NULL bytes, BOM markers, and other non-printable control characters
     * that could cause issues in JSON encoding.
     *
     * @param string $text The text to clean
     *
     * @return string Text with control characters removed
     */
    private static function removeControlCharacters(string $text): string
    {
        $text = preg_replace(self::CONTROL_CHARS_PATTERN, '', $text);
        $text = str_replace("\0", '', $text);
        $text = self::removeBom($text);

        return $text ?? '';
    }

    /**
     * Removes Byte Order Mark (BOM) from the beginning of text.
     *
     * Handles UTF-8, UTF-16 BE, and UTF-16 LE BOMs.
     *
     * @param string $text The text to process
     *
     * @return string Text with BOM removed
     */
    private static function removeBom(string $text): string
    {
        // UTF-8 BOM
        if ("\xEF\xBB\xBF" === substr($text, 0, 3)) {
            return substr($text, 3);
        }

        // UTF-16 BE BOM
        if ("\xFE\xFF" === substr($text, 0, 2)) {
            return substr($text, 2);
        }

        // UTF-16 LE BOM
        if ("\xFF\xFE" === substr($text, 0, 2)) {
            return substr($text, 2);
        }

        return $text;
    }

    /**
     * Fixes broken or malformed HTML entities.
     *
     * Repairs incomplete entity references and decodes valid entities to UTF-8.
     *
     * @param string $text The text containing HTML entities
     *
     * @return string Text with fixed/decoded HTML entities
     */
    private static function fixBrokenHtmlEntities(string $text): string
    {
        $text = preg_replace('/&#0+;/', '', $text);
        $text = preg_replace('/&#x[^0-9a-fA-F;]+;/', '', $text);

        $text = preg_replace('/&(amp|lt|gt|quot|apos|nbsp)([^;])/i', '&$1;$2', $text);

        $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        if (self::isValidUtf8($decoded)) {
            return $decoded;
        }

        return $text;
    }

    /**
     * Fixes broken JSON escape sequences.
     *
     * Repairs invalid backslash sequences and incomplete unicode escapes
     * that would cause JSON parsing errors.
     *
     * @param string $text The text to fix
     *
     * @return string Text with valid escape sequences
     */
    private static function fixBrokenEscapeSequences(string $text): string
    {
        $pattern1 = '#\\\\(?!["\\\\\/bfnrtu])#';
        $result = preg_replace_callback($pattern1, function ($match) {
            return '\\\\';
        }, $text);

        if (null !== $result) {
            $text = $result;
        }

        $pattern2 = '#\\\\u([0-9a-fA-F]{0,3})(?![0-9a-fA-F])#';
        $result = preg_replace_callback($pattern2, function ($match) {
            if (strlen($match[1]) < 4) {
                return '';
            }

            return $match[0];
        }, $text);

        if (null !== $result) {
            $text = $result;
        }

        $result = preg_replace('#\\\\{3,}"#', '\\"', $text);

        if (null !== $result) {
            $text = $result;
        }

        return $text;
    }

    /**
     * Normalizes whitespace characters.
     *
     * Converts various Unicode space characters to regular spaces
     * and normalizes line endings to Unix style (LF).
     *
     * @param string $text The text to normalize
     *
     * @return string Text with normalized whitespace
     */
    private static function normalizeWhitespace(string $text): string
    {
        $unicodeSpaces = [
            "\xC2\xA0",     // NO-BREAK SPACE
            "\xE2\x80\x80", // EN QUAD
            "\xE2\x80\x81", // EM QUAD
            "\xE2\x80\x82", // EN SPACE
            "\xE2\x80\x83", // EM SPACE
            "\xE2\x80\x84", // THREE-PER-EM SPACE
            "\xE2\x80\x85", // FOUR-PER-EM SPACE
            "\xE2\x80\x86", // SIX-PER-EM SPACE
            "\xE2\x80\x87", // FIGURE SPACE
            "\xE2\x80\x88", // PUNCTUATION SPACE
            "\xE2\x80\x89", // THIN SPACE
            "\xE2\x80\x8A", // HAIR SPACE
            "\xE2\x80\xAF", // NARROW NO-BREAK SPACE
            "\xE2\x81\x9F", // MEDIUM MATHEMATICAL SPACE
            "\xE3\x80\x80", // IDEOGRAPHIC SPACE
        ];

        $text = str_replace($unicodeSpaces, ' ', $text);
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/^[ \t]+$/m', '', $text);

        return $text;
    }

    /**
     * Removes any remaining invalid UTF-8 sequences.
     *
     * Final cleanup step after other sanitization methods.
     *
     * @param string $text The text to clean
     *
     * @return string Text with only valid UTF-8 sequences
     */
    private static function removeInvalidUtf8Sequences(string $text): string
    {
        if (self::isValidUtf8($text)) {
            return $text;
        }

        if (!self::mbstringAvailable()) {
            $cleaned = @iconv('UTF-8', 'UTF-8//IGNORE', $text);
            if (false !== $cleaned) {
                return $cleaned;
            }

            return self::forceUtf8($text);
        }

        $cleaned = mb_convert_encoding($text, 'UTF-8', 'UTF-8');

        if (false !== $cleaned) {
            return $cleaned;
        }

        return $text;
    }

    /**
     * Safely encodes an array to JSON string.
     *
     * Attempts encoding with progressively more aggressive sanitization
     * until successful. Never throws an exception.
     *
     * @param array $data        The data to encode
     * @param bool  $prettyPrint Whether to format output with indentation
     *
     * @return string Valid JSON string (returns error object if all attempts fail)
     */
    public static function safeJsonEncode(array $data, bool $prettyPrint = false): string
    {
        $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
        if ($prettyPrint) {
            $flags |= JSON_PRETTY_PRINT;
        }

        $json = json_encode($data, $flags);
        if (false !== $json && JSON_ERROR_NONE === json_last_error()) {
            return $json;
        }

        $sanitized = self::sanitizeArray($data);
        $json = json_encode($sanitized, $flags);
        if (false !== $json && JSON_ERROR_NONE === json_last_error()) {
            return $json;
        }

        $json = json_encode($sanitized, $flags | JSON_INVALID_UTF8_SUBSTITUTE);
        if (false !== $json) {
            return $json;
        }

        $aggressive = self::aggressiveSanitizeArray($data);
        $json = json_encode($aggressive, $flags | JSON_INVALID_UTF8_IGNORE);
        if (false !== $json) {
            return $json;
        }

        return json_encode([
            '_error' => 'Failed to encode data to JSON',
            '_original_error' => json_last_error_msg(),
        ]);
    }

    /**
     * Recursively sanitizes all string values in an array.
     *
     * Also handles special float values (NaN, Infinity) and resources.
     *
     * @param array $data The array to sanitize
     *
     * @return array Array with all string values sanitized
     */
    public static function sanitizeArray(array $data): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            $cleanKey = is_string($key) ? self::sanitizeValue($key) : $key;

            if (is_array($value)) {
                $result[$cleanKey] = self::sanitizeArray($value);
            } elseif (is_string($value)) {
                $result[$cleanKey] = self::sanitizeValue($value);
            } elseif (is_float($value)) {
                if (is_nan($value)) {
                    $result[$cleanKey] = 0;
                } elseif (is_infinite($value)) {
                    $result[$cleanKey] = $value > 0 ? PHP_INT_MAX : PHP_INT_MIN;
                } else {
                    $result[$cleanKey] = $value;
                }
            } elseif (is_resource($value)) {
                $result[$cleanKey] = null;
            } else {
                $result[$cleanKey] = $value;
            }
        }

        return $result;
    }

    /**
     * Aggressively sanitizes an array by converting all strings to ASCII.
     *
     * Last resort when normal sanitization fails. Loses non-ASCII characters.
     *
     * @param array $data The array to sanitize
     *
     * @return array Array with all strings converted to safe ASCII
     */
    private static function aggressiveSanitizeArray(array $data): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            $cleanKey = is_string($key) ? self::toSafeAscii($key) : $key;

            if (is_array($value)) {
                $result[$cleanKey] = self::aggressiveSanitizeArray($value);
            } elseif (is_string($value)) {
                $result[$cleanKey] = self::toSafeAscii($value);
            } else {
                $result[$cleanKey] = $value;
            }
        }

        return $result;
    }

    /**
     * Converts text to safe ASCII characters only.
     *
     * Uses iconv with TRANSLIT option, falls back to regex removal.
     *
     * @param string $text The text to convert
     *
     * @return string ASCII-safe string
     */
    private static function toSafeAscii(string $text): string
    {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);

        if (false !== $ascii) {
            return $ascii;
        }

        return preg_replace('/[^\x20-\x7E\t\n\r]/', '', $text);
    }

    /**
     * Validates if a string is valid JSON.
     *
     * @param string $json The JSON string to validate
     *
     * @return bool True if the string is valid JSON
     */
    public static function isValidJson(string $json): bool
    {
        if ('' === trim($json)) {
            return false;
        }

        json_decode($json);

        return JSON_ERROR_NONE === json_last_error();
    }

    /**
     * Attempts to repair malformed JSON.
     *
     * Fixes common issues like single quotes, trailing commas,
     * unquoted keys, and unclosed strings/brackets.
     *
     * @param string $json The malformed JSON string
     *
     * @return string Repaired JSON string (or empty object if unrepairable)
     */
    public static function repairJson(string $json): string
    {
        if (self::isValidJson($json)) {
            return $json;
        }

        $repaired = $json;

        $repaired = self::fixJsonQuotes($repaired);
        $repaired = preg_replace('/,\s*([\}\]])/', '$1', $repaired);
        $repaired = preg_replace('/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/', '$1"$2":', $repaired);
        $repaired = preg_replace('/:\s*undefined\b/', ': null', $repaired);
        $repaired = preg_replace('/:\s*NaN\b/', ': 0', $repaired);
        $repaired = preg_replace('/:\s*Infinity\b/', ': 999999999', $repaired);
        $repaired = self::fixUnclosedStrings($repaired);
        $repaired = self::fixUnclosedBrackets($repaired);

        if (self::isValidJson($repaired)) {
            return $repaired;
        }

        return self::extractJsonData($json);
    }

    /**
     * Converts single-quoted JSON strings to double-quoted.
     *
     * @param string $json The JSON string with possible single quotes
     *
     * @return string JSON with double quotes
     */
    private static function fixJsonQuotes(string $json): string
    {
        if (preg_match("/[{,]\s*'[^']*'\s*:/", $json)) {
            $json = preg_replace_callback(
                "/([{,]\s*)'([^']*)'\s*:\s*'([^']*)'/",
                function ($m) {
                    $key = str_replace('"', '\\"', $m[2]);
                    $val = str_replace('"', '\\"', $m[3]);

                    return $m[1].'"'.$key.'": "'.$val.'"';
                },
                $json
            );
        }

        return $json;
    }

    /**
     * Fixes unclosed string literals in JSON.
     *
     * @param string $json The JSON with possible unclosed strings
     *
     * @return string JSON with properly closed strings
     */
    private static function fixUnclosedStrings(string $json): string
    {
        $inString = false;
        $escaped = false;
        $result = '';

        for ($i = 0; $i < strlen($json); ++$i) {
            $char = $json[$i];

            if ($escaped) {
                $escaped = false;
                $result .= $char;
                continue;
            }

            if ('\\' === $char) {
                $escaped = true;
                $result .= $char;
                continue;
            }

            if ('"' === $char) {
                $inString = !$inString;
            }

            $result .= $char;
        }

        if ($inString) {
            $result .= '"';
        }

        return $result;
    }

    /**
     * Fixes unclosed brackets and braces in JSON.
     *
     * @param string $json The JSON with possible unclosed brackets
     *
     * @return string JSON with properly closed brackets
     */
    private static function fixUnclosedBrackets(string $json): string
    {
        $stack = [];
        $inString = false;
        $escaped = false;

        for ($i = 0; $i < strlen($json); ++$i) {
            $char = $json[$i];

            if ($escaped) {
                $escaped = false;
                continue;
            }

            if ('\\' === $char) {
                $escaped = true;
                continue;
            }

            if ('"' === $char) {
                $inString = !$inString;
                continue;
            }

            if ($inString) {
                continue;
            }

            if ('{' === $char || '[' === $char) {
                $stack[] = $char;
            } elseif ('}' === $char) {
                if ('{' === end($stack)) {
                    array_pop($stack);
                }
            } elseif (']' === $char) {
                if ('[' === end($stack)) {
                    array_pop($stack);
                }
            }
        }

        while ($bracket = array_pop($stack)) {
            $json .= ('{' === $bracket) ? '}' : ']';
        }

        return $json;
    }

    /**
     * Extracts key-value pairs from severely malformed JSON.
     *
     * Last resort when other repair methods fail.
     * Uses regex to extract any valid-looking key-value pairs.
     *
     * @param string $json The malformed JSON string
     *
     * @return string Reconstructed JSON object with extracted data
     */
    private static function extractJsonData(string $json): string
    {
        $data = [];
        preg_match_all(
            '/"([^"]+)"\s*:\s*("([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|(-?\d+\.?\d*)|true|false|null)/u',
            $json,
            $matches,
            PREG_SET_ORDER
        );

        foreach ($matches as $match) {
            $key = $match[1];
            if (isset($match[3])) {
                $data[$key] = $match[3];
            } elseif (isset($match[4])) {
                $numVal = $match[4];
                if (is_numeric($numVal)) {
                    $data[$key] = false !== strpos($numVal, '.') ? floatval($numVal) : intval($numVal);
                } else {
                    $data[$key] = $numVal;
                }
            } elseif ('true' === $match[2]) {
                $data[$key] = true;
            } elseif ('false' === $match[2]) {
                $data[$key] = false;
            } elseif ('null' === $match[2]) {
                $data[$key] = null;
            }
        }

        if (!empty($data)) {
            return json_encode($data);
        }

        return '{}';
    }

    /**
     * Sanitizes HTML content for safe inclusion in JSON.
     *
     * Removes scripts, styles, and comments. Normalizes attribute quotes.
     * Supports data-* and aria-* attributes.
     *
     * @param string $html The HTML content to sanitize
     *
     * @return string Sanitized HTML safe for JSON encoding
     */
    public static function sanitizeHtmlForJson(string $html): string
    {
        $html = self::sanitizeValue($html);

        $htmlFixes = [
            '&nbsp;' => ' ',
            '&amp;' => '&',
            '&#160;' => ' ',
            '&#xa0;' => ' ',
        ];

        $html = str_replace(array_keys($htmlFixes), array_values($htmlFixes), $html);

        $html = preg_replace('/<!--[\s\S]*?-->/', '', $html);
        $html = preg_replace('/<script\b[^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = preg_replace('/<style\b[^>]*>[\s\S]*?<\/style>/i', '', $html);

        $html = preg_replace_callback(
            '/(\s+[\w:-]+\s*=\s*)(["\'])([^"\']*)\2/',
            function ($match) {
                $value = str_replace(['\\', '"'], ['\\\\', '\\"'], $match[3]);

                return $match[1].'"'.$value.'"';
            },
            $html
        );

        return $html;
    }

    /**
     * Safely decodes a JSON string with automatic repair.
     *
     * Attempts normal decoding first, then tries to repair if it fails.
     *
     * @param string $json  The JSON string to decode
     * @param bool   $assoc When true, returns associative arrays instead of objects
     *
     * @return mixed Decoded data, or empty array/object on failure
     */
    public static function safeJsonDecode(string $json, bool $assoc = true)
    {
        $data = json_decode($json, $assoc);
        if (JSON_ERROR_NONE === json_last_error()) {
            return $data;
        }

        $repaired = self::repairJson($json);
        $data = json_decode($repaired, $assoc);
        if (JSON_ERROR_NONE === json_last_error()) {
            return $data;
        }

        return $assoc ? [] : new \stdClass();
    }

    /**
     * Diagnoses problems in text that could cause JSON encoding issues.
     *
     * Useful for debugging problematic content.
     *
     * @param string $text The text to analyze
     *
     * @return array List of detected problems (empty if none found)
     */
    public static function diagnoseJsonProblems(string $text): array
    {
        $problems = [];

        if (!self::isValidUtf8($text)) {
            $problems[] = 'Invalid UTF-8 encoding';
        }

        if (preg_match(self::CONTROL_CHARS_PATTERN, $text)) {
            $problems[] = 'Contains control characters';
        }

        if (false !== strpos($text, "\0")) {
            $problems[] = 'Contains NULL bytes';
        }

        if ("\xEF\xBB\xBF" === substr($text, 0, 3)) {
            $problems[] = 'Contains UTF-8 BOM';
        }

        if (preg_match('/\\\\(?!["\\\\/bfnrtu])/', $text)) {
            $problems[] = 'Contains invalid escape sequences';
        }

        if (preg_match('/[^\\\\]".*[^\\\\]".*[^\\\\]"/', $text)) {
            $problems[] = 'Possible unescaped quotes';
        }

        $result = json_encode(['test' => $text]);
        if (false === $result) {
            $problems[] = 'json_encode fails: '.json_last_error_msg();
        }

        return $problems;
    }
}
