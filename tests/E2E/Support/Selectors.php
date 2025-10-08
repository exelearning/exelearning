<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

/**
 * Centralized CSS/XPath selectors mapped to your current HTML.
 * Update here if the UI changes.
 */
final class Selectors
{
    // Workarea & node container
    public const WORKAREA               = '#workarea';
    public const NODE_CONTENT_CONTAINER = '#node-content-container';
    public const NODE_CONTENT           = '#node-content';
    public const PAGE_TITLE             = '#page-title-node-content';

    // Navigation panel (Structure)
    public const NAV_PANEL        = '#menu_nav';
    public const NAV_ADD_PAGE_BTN = '#menu_nav .action_add';
    public const NAV_NODE_TEXTS   = '#nav_list .nav-element .node-text-span';

    // Add Text quick button inside node content
    public const ADD_TEXT_BUTTON  = '#eXeAddContentBtnWrapper > button';

    // Box and iDevice containers
    public const BOX_ARTICLE      = 'article.box';
    public const BOX_TITLE        = 'article.box > header .box-title';
    public const IDEVICE_NODE     = '.idevice_node';
    public const IDEVICE_TEXT     = '.idevice_node.text';

    /**
     * XPath for a node in the nav tree by its visible name.
     * Example: //span[contains(@class,'node-text-span') and normalize-space()='Nodo 2']
     */
    public static function navNodeByNameXPath(string $name): string
    {
        $safe = self::xpLiteral($name);
        return sprintf("//span[contains(@class,'node-text-span') and normalize-space()=%s]", $safe);
    }

    private static function xpLiteral(string $s): string
    {
        if (!str_contains($s, "'")) {
            return "'" . $s . "'";
        }
        if (!str_contains($s, '"')) {
            return '"' . $s . '"';
        }
        return "concat('" . str_replace("'", "',\"'\",'", $s) . "')";
    }
}
