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
    // Quickbar iDevice buttons
    public const QUICK_IDEVICE_TEXT = '[data-testid="quick-idevice-text"]';
    // Left menu iDevice testid (fallback)
    public const IDEVICE_TEXT_TESTID = '[data-testid="idevice-text"]';

    // Box and iDevice containers
    public const BOX_ARTICLE      = 'article.box';
    public const BOX_TITLE        = 'article.box > header .box-title';
    public const BOX_HEADER       = 'article.box > header';
    public const BOX_BTN_MOVE_UP  = 'header .btn-move-up';
    public const BOX_BTN_MOVE_DOWN= 'header .btn-move-down';
    public const BOX_BTN_MORE     = 'header button[id^="dropdownMenuButton"]';
    public const BOX_MENU_PROPERTIES = 'button[id^="dropdownBlockMore-button-properties"]';
    public const BOX_MENU_CLONE      = 'button[id^="dropdownBlockMore-button-clone"]';
    public const BOX_MENU_MOVE       = 'button[id^="dropdownBlockMore-button-move"]';
    public const BOX_MENU_EXPORT     = 'button[id^="dropdownBlockMore-button-export"]';
    public const BOX_MENU_DELETE     = 'button[id^="deleteBlock"]';
    public const IDEVICE_NODE     = '.idevice_node';
    public const IDEVICE_TEXT     = '.idevice_node.text';
    public const IDEVICE_NODE_EDITING = '.idevice_node[mode="edition"]';

    // iDevice action buttons (scoped within a single iDevice container)
    public const IDEVICE_ACTIONS_SCOPE    = '.idevice_actions';
    public const IDEVICE_BTN_EDIT         = '.btn-edit-idevice';
    public const IDEVICE_BTN_SAVE         = '.btn-save-idevice';
    public const IDEVICE_BTN_UNDO         = '.btn-undo-idevice';
    public const IDEVICE_BTN_DELETE       = '.btn-delete-idevice';
    public const IDEVICE_BTN_MOVE_UP      = '.btn-move-up-idevice';
    public const IDEVICE_BTN_MOVE_DOWN    = '.btn-move-down-idevice';
    public const IDEVICE_BTN_MORE_ACTIONS = 'button[id^="dropdownMenuButtonIdevice"]';
    public const IDEVICE_MENU_CLONE       = 'button[id^="cloneIdevice"]';

    // Text iDevice content and editor
    public const IDEVICE_TEXT_CONTENT   = '.textIdeviceContent';
    public const TINYMCE_IFRAME         = 'iframe.tox-edit-area__iframe, iframe[id$="_ifr"]';
    public const TINYMCE_CONTAINER      = '.tox.tox-tinymce';

    // Generic modal alert used when an iDevice is already being edited
    public const MODAL_ALERT            = '.modal-alert, .modal.modal-alert.show, .modal-dialog.modal-alert';
    public const MODAL_ALERT_CLOSE_BTN  = '.modal-alert .modal-footer .btn, .modal-alert .close, .modal-dialog.modal-alert .close';
    public const MODAL_CONFIRM_VISIBLE  = '[data-testid="modal-confirm"][data-open="true"], #modalConfirm.show, #modalConfirm[aria-hidden="false"]';
    public const MODAL_CONFIRM_ACTION   = '[data-testid="confirm-action"], #modalConfirm .confirm, #modalConfirm .btn.btn-primary';

    // iDevices menu (left sidebar/panel)
    public const IDEVICES_MENU          = '#menu_idevices';
    public const IDEVICES_MENU_LIST     = '#list_menu_idevices';
    public const IDEVICES_MENU_TEXT     = '#list_menu_idevices #text.idevice_item';

}
