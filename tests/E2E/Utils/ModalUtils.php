<?php
declare(strict_types=1);

namespace App\Tests\E2E\Utils;

use App\Tests\E2E\PageObjects\AbstractPageObject;
use Symfony\Component\Panther\Client;
use Facebook\WebDriver\WebDriverBy;

/**
 * Utility class for handling modals in E2E tests.
 * Provides specialized methods for different types of modals.
 * 
 * This is the central place for all modal handling logic in the E2E framework.
 */
class ModalUtils
{
    /**
     * Common selectors for modal buttons
     */
    private static array $confirmButtonSelectors = [
        '.modal-confirm .btn-primary',
        '.modal-confirm .confirm',
        '.modal-dialog .btn-primary',
        '.modal-footer .btn-primary',
        '[data-testid="confirm-action"]',
        'button.confirm',
        'button[type="submit"]'
    ];
    
    private static array $cancelButtonSelectors = [
        '.modal-confirm .btn-secondary',
        '.modal-confirm .cancel',
        '.modal-dialog .btn-secondary',
        '.modal-footer .btn-secondary',
        '[data-testid="cancel-action"]',
        '[data-testid="close-modal"]',
        '[data-testid="close-modal-alert"]',
        '[data-testid="close-modal-info"]',
        '[data-testid="dismiss-modal-alert"]',
        '.modal .btn-close',
        '.modal-footer button[data-bs-dismiss="modal"]',
        '[data-dismiss="modal"]',
        '.close'
    ];
    
    /**
     * Dismisses all visible modals.
     * This is a comprehensive approach that handles various modal types.
     * 
     * This is the main entry point for modal dismissal that should be used by other classes.
     *
     * @param Client $client The Panther client
     * @param bool $takeScreenshot Whether to take a screenshot before dismissal
     * @return bool True if modals were dismissed
     */
    public static function dismissAllModals(Client $client, bool $takeScreenshot = false): bool
    {
        TestLogger::debug("Dismissing all modals via ModalUtils");
        
        try {
            // // Take a screenshot if requested
            // if ($takeScreenshot) {
            //     TestUtils::takeScreenshot($client, 'ModalDismissal', 'before_dismiss');
            // }
            
            // First check if any modals are visible
            $modalVisible = TestUtils::executeScript($client, '
                return document.querySelectorAll(".modal.show, .modal-backdrop").length > 0;
            ');
            
            if (!$modalVisible) {
                return true;
            }
            
            // Log visible modals for debugging
            $visibleModals = TestUtils::executeScript($client, '
                const modals = document.querySelectorAll(".modal.show");
                return Array.from(modals).map(modal => modal.id || "unnamed-modal");
            ');
            
            if (is_array($visibleModals) && !empty($visibleModals)) {
                TestLogger::debug("Dismissing visible modals: " . implode(", ", $visibleModals));
            }
            
            // Check for "Already logged in" modal first (it has modalConfirm ID)
            if (self::handleAlreadyLoggedInModal($client, false)) {
                TestLogger::debug("Successfully handled 'Already logged in' modal");
                
                // Check if all modals are gone after handling this one
                $stillVisible = TestUtils::executeScript($client, '
                    return document.querySelectorAll(".modal.show, .modal-backdrop").length > 0;
                ');
                
                if (!$stillVisible) {
                    return true;
                }
            }
            
            // Try to handle specific known modals
            foreach ($visibleModals as $modalId) {
                if ($modalId === 'modalSessionLogout') {
                    if (self::handleSessionLogoutModal($client, false)) {
                        TestLogger::debug("Successfully handled session logout modal");
                        continue;
                    }
                } else if ($modalId === 'modalConfirm') {
                    if (self::handleConfirmModal($client, false)) {
                        TestLogger::debug("Successfully handled confirm modal");
                        continue;
                    }
                } else if ($modalId === 'modalAlert') {
                    if (self::handleAlertModal($client)) {
                        TestLogger::debug("Successfully handled alert modal");
                        continue;
                    }
                }
                
                // Try generic handling for this modal
                if (self::handleModalById($client, $modalId, false)) {
                    TestLogger::debug("Successfully handled modal #$modalId");
                }
            }
            
            // Check if all modals are gone
            $stillVisible = TestUtils::executeScript($client, '
                return document.querySelectorAll(".modal.show, .modal-backdrop").length > 0;
            ');
            
            if (!$stillVisible) {
                TestLogger::debug("All modals dismissed successfully");
                return true;
            }
            
            // If modals are still visible, try a more aggressive approach
            TestLogger::debug("Modals still visible, using force-close approach");
            return self::forceCloseAllModals($client);
            
        } catch (\Exception $e) {
            TestLogger::error("Error dismissing modals: " . $e->getMessage());
            
            // Try force close as last resort
            try {
                return self::forceCloseAllModals($client);
            } catch (\Exception $e2) {
                TestLogger::error("Force close also failed: " . $e2->getMessage());
                return false;
            }
        }
    }
    
    /**
     * Handles a specific modal by ID.
     *
     * @param Client $client The Panther client
     * @param string $modalId The ID of the modal to handle
     * @param bool $accept Whether to accept (true) or cancel (false) the modal
     * @return bool True if the modal was successfully handled
     */
    public static function handleModalById(Client $client, string $modalId, bool $accept = true): bool
    {
        TestLogger::debug("Handling modal with ID: $modalId, action: " . ($accept ? 'accept' : 'cancel'));
        
        try {
            // Check if the modal is visible
            $modalVisible = TestUtils::executeScript($client, "
                const modal = document.querySelector('#$modalId');
                return modal && modal.classList.contains('show');
            ");
            
            if (!$modalVisible) {
                TestLogger::debug("Modal #$modalId is not visible");
                return false;
            }
            
            // Determine which button to click based on accept/cancel
            $buttonSelectors = $accept ? self::$confirmButtonSelectors : self::$cancelButtonSelectors;
            
            // Try each selector with the modal ID prefix
            foreach ($buttonSelectors as $selector) {
                $modalSpecificSelector = "#$modalId " . $selector;
                
                try {
                    $buttons = $client->getCrawler()->filter($modalSpecificSelector);
                    if ($buttons->count() > 0 && $buttons->isDisplayed()) {
                        TestLogger::debug("Clicking modal button: $modalSpecificSelector");
                        $buttons->click();
                        
                        // Wait for modal to close
                        TestUtils::waitForElement($client, "#$modalId", 'invisibility', 5);
                        return true;
                    }
                } catch (\Exception $e) {
                    // Continue to next selector
                    TestLogger::debug("Error with selector $modalSpecificSelector: " . $e->getMessage());
                }
            }
            
            // If no button found with direct selectors, try JavaScript
            TestLogger::debug("No button found with direct selectors, trying JavaScript");
            $jsSelectors = implode(', ', array_map(function($s) use ($modalId) {
                return "#$modalId " . $s;
            }, $buttonSelectors));
            
            $result = TestUtils::executeScript($client, "
                const buttons = document.querySelectorAll('$jsSelectors');
                if (buttons.length > 0) {
                    buttons[0].click();
                    return true;
                }
                return false;
            ");
            
            if ($result) {
                TestLogger::debug("Successfully clicked button in modal #$modalId via JavaScript");
                TestUtils::waitForElement($client, "#$modalId", 'invisibility', 5);
                return true;
            }
            
            TestLogger::warning("Could not find any button to click in modal #$modalId");
            return false;
        } catch (\Exception $e) {
            TestLogger::error("Error handling modal #$modalId: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Handles a confirmation modal.
     *
     * @param Client $client The Panther client
     * @param bool $confirm Whether to confirm (true) or cancel (false)
     * @return bool True if the modal was successfully handled
     */
    public static function handleConfirmModal(Client $client, bool $confirm = true): bool
    {
        TestLogger::debug("Handling confirmation modal, action: " . ($confirm ? 'confirm' : 'cancel'));
        
        try {
            // Check if the modal is visible
            $modalVisible = TestUtils::executeScript($client, "
                const modal = document.querySelector('#modalConfirm');
                return modal && modal.classList.contains('show');
            ");
            
            if (!$modalVisible) {
                TestLogger::debug("Confirmation modal is not visible");
                return false;
            }
            
            // Take a screenshot for debugging
            ScreenshotUtils::takeScreenshot($client, 'ModalUtils', 'before_handle_confirm_modal');
            
            // Determine which button to click based on confirm/cancel
            $buttonSelector = $confirm 
                ? '[data-testid="confirm-action"], .modal-footer .btn-primary, .confirm.btn.btn-primary' 
                : '[data-testid="cancel-action"], .modal-footer .btn-secondary, .cancel.btn.btn-secondary';
            
            // Use JavaScript to click the button for more reliability
            $buttonClicked = TestUtils::executeScript($client, "
                const button = document.querySelector('$buttonSelector');
                if (button) {
                    try {
                        button.click();
                        return true;
                    } catch(e) {
                        console.error('Error clicking button:', e);
                        return false;
                    }
                }
                return false;
            ");
            
            if ($buttonClicked) {
                TestLogger::debug("Successfully clicked button in confirmation modal via JavaScript");
                
                // Wait for modal to close
                TestUtils::waitForElement($client, "#modalConfirm", 'invisibility', 5);
                return true;
            }
            
            TestLogger::warning("Could not click button in confirmation modal");
            return false;
            
        } catch (\Exception $e) {
            TestLogger::error("Error handling confirmation modal: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Handles an alert modal.
     *
     * @param Client $client The Panther client
     * @return bool True if the modal was successfully dismissed
     */
    public static function handleAlertModal(Client $client): bool
    {
        return self::handleModalById($client, 'modalAlert', false);
    }
    
    /**
     * Handles a session logout modal.
     *
     * @param Client $client The Panther client
     * @param bool $saveBeforeLogout Whether to save before logout
     * @return bool True if the modal was successfully handled
     */
    public static function handleSessionLogoutModal(Client $client, bool $saveBeforeLogout = false): bool
    {
        TestLogger::debug("Handling session logout modal, save: " . ($saveBeforeLogout ? 'yes' : 'no'));
        
        try {
            // Check if the modal is visible
            $modalVisible = TestUtils::executeScript($client, "
                const modal = document.querySelector('#modalSessionLogout');
                return modal && modal.classList.contains('show');
            ");
            
            if (!$modalVisible) {
                TestLogger::debug("Session logout modal is not visible");
                return false;
            }
            
            // Determine which button to click based on save preference
            $buttonSelector = $saveBeforeLogout
                ? "[data-testid=\"session-logout-with-save\"], #modalSessionLogout .session-logout-save.btn.btn-primary"
                : "[data-testid=\"session-logout-without-save\"], #modalSessionLogout .session-logout-without-save.btn.btn-primary";
            
            // Try to click the button
            try {
                $buttons = $client->getCrawler()->filter($buttonSelector);
                if ($buttons->count() > 0) {
                    TestLogger::debug("Clicking session logout button: $buttonSelector");
                    $buttons->click();
                    
                    // Wait for modal to close
                    TestUtils::waitForElement($client, "#modalSessionLogout", 'invisibility', 5);
                    return true;
                }
            } catch (\Exception $e) {
                TestLogger::debug("Error clicking session logout button: " . $e->getMessage());
            }
            
            // Try JavaScript as fallback
            $result = TestUtils::executeScript($client, "
                const button = document.querySelector('$buttonSelector');
                if (button) {
                    button.click();
                    return true;
                }
                return false;
            ");
            
            if ($result) {
                TestLogger::debug("Successfully clicked button in session logout modal via JavaScript");
                TestUtils::waitForElement($client, "#modalSessionLogout", 'invisibility', 5);
                return true;
            }
            
            TestLogger::warning("Could not find button to click in session logout modal");
            return false;
        } catch (\Exception $e) {
            TestLogger::error("Error handling session logout modal: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Handles the "Already logged in" modal that appears when a user tries to log in
     * while already having an active session.
     *
     * @param Client $client The Panther client
     * @param bool $continueWithExisting Whether to continue with existing session (true) or start new (false)
     * @return bool True if the modal was successfully handled
     */
    public static function handleAlreadyLoggedInModal(Client $client, bool $continueWithExisting = false): bool
    {
        TestLogger::debug("Handling 'Already logged in' modal, continue with existing: " . ($continueWithExisting ? 'yes' : 'no'));
        
        try {
            // Check if the modal is visible by looking for its title
            $modalVisible = TestUtils::executeScript($client, "
                const modalTitle = document.querySelector('#modalConfirmTitle');
                if (!modalTitle) return false;
                
                // Check if the title contains text about already being logged in
                const titleText = modalTitle.textContent.toLowerCase();
                return (titleText.includes('ya iniciaste sesión') || 
                        titleText.includes('already logged in')) && 
                       document.querySelector('#modalConfirm.show');
            ");
            
            if (!$modalVisible) {
                TestLogger::debug("'Already logged in' modal is not visible");
                return false;
            }
            
            // Take a screenshot for debugging
            ScreenshotUtils::takeScreenshot($client, 'ModalUtils', 'already_logged_in_modal');
            
            // Determine which button to click based on preference
            // If continueWithExisting is true, click "Yes" (confirm button)
            // If continueWithExisting is false, click "No, start a new one" (cancel button)
            $buttonSelector = $continueWithExisting
                ? "[data-testid=\"confirm-action\"], .modal-footer .btn-primary, .confirm.btn.btn-primary"
                : "[data-testid=\"cancel-action\"], .modal-footer .btn-secondary, .cancel.btn.btn-secondary";
            
            TestLogger::debug("Selecting button: " . ($continueWithExisting ? 'Continue with existing' : 'Start new'));
            
            // Try to click the button using JavaScript for more reliability
            $buttonClicked = TestUtils::executeScript($client, "
                const button = document.querySelector('$buttonSelector');
                if (button) {
                    try {
                        button.click();
                        return true;
                    } catch(e) {
                        console.error('Error clicking button:', e);
                        return false;
                    }
                }
                return false;
            ");
            
            if ($buttonClicked) {
                TestLogger::debug("Successfully clicked button in 'Already logged in' modal");
                
                // Wait for modal to close
                TestUtils::waitForElement($client, "#modalConfirm", 'invisibility', 5);
                
                // Wait a moment for the page to update based on the selection
                usleep(500000); // 500ms
                
                return true;
            }
            
            TestLogger::warning("Could not click button in 'Already logged in' modal");
            
            // As a last resort, try to dismiss the modal
            return self::forceCloseAllModals($client);
            
        } catch (\Exception $e) {
            TestLogger::error("Error handling 'Already logged in' modal: " . $e->getMessage());
            
            // Try to force close as a last resort
            try {
                return self::forceCloseAllModals($client);
            } catch (\Exception $e2) {
                TestLogger::error("Force close also failed: " . $e2->getMessage());
                return false;
            }
        }
    }
    
    /**
     * Checks if any modal is currently visible.
     *
     * @param Client $client The Panther client
     * @return bool True if any modal is visible
     */
    public static function isAnyModalVisible(Client $client): bool
    {
        try {
            return (bool)TestUtils::executeScript($client, '
                return document.querySelectorAll(".modal.show").length > 0;
            ');
        } catch (\Exception $e) {
            TestLogger::error("Error checking for visible modals: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Gets a list of IDs of all visible modals.
     *
     * @param Client $client The Panther client
     * @return array<string> Array of modal IDs
     */
    public static function getVisibleModalIds(Client $client): array
    {
        try {
            $result = TestUtils::executeScript($client, '
                const modals = document.querySelectorAll(".modal.show");
                return Array.from(modals)
                    .map(modal => modal.id || "unnamed-modal")
                    .filter(id => id !== "");
            ');
            
            return is_array($result) ? $result : [];
        } catch (\Exception $e) {
            TestLogger::error("Error getting visible modal IDs: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Force closes all modals using JavaScript.
     * This is a last resort method when normal dismissal fails.
     *
     * @param Client $client The Panther client
     * @return bool True if the operation was successful
     */
    public static function forceCloseAllModals(Client $client): bool
    {
        TestLogger::debug("Force closing all modals");
        
        try {
            // Take a screenshot before force closing
            // \App\Tests\E2E\Utils\ScreenshotUtils::takeScreenshot($client, 'ModalUtils', 'before_force_close');
            
            // First try to identify all visible modals
            $visibleModals = TestUtils::executeScript($client, '
                const modals = document.querySelectorAll(".modal.show");
                return Array.from(modals).map(modal => modal.id || "unnamed-modal");
            ');
            
            if (is_array($visibleModals) && !empty($visibleModals)) {
                TestLogger::debug("Force closing these modals: " . implode(", ", $visibleModals));
            }
            
            // Try a more aggressive approach with multiple techniques
            TestUtils::executeScript($client, '
                // Method 1: Try to use Bootstrap API first
                try {
                    const visibleModals = document.querySelectorAll(".modal.show");
                    visibleModals.forEach(modal => {
                        try {
                            const bootstrapModal = bootstrap.Modal.getInstance(modal);
                            if (bootstrapModal) bootstrapModal.hide();
                        } catch (e) {
                            console.log("Bootstrap API failed for modal: " + (modal.id || "unnamed"));
                        }
                    });
                } catch (e) {
                    console.log("Bootstrap API approach failed: " + e.message);
                }
                
                // Method 2: Manual DOM manipulation
                try {
                    const visibleModals = document.querySelectorAll(".modal.show, .modal[style*=\"display: block\"]");
                    visibleModals.forEach(modal => {
                        modal.classList.remove("show");
                        modal.style.display = "none";
                        modal.setAttribute("aria-hidden", "true");
                        
                        // Try to click any close buttons in this modal
                        const closeButtons = modal.querySelectorAll(".close, .btn-close, [data-bs-dismiss=\"modal\"], .modal-footer .btn-secondary");
                        if (closeButtons.length > 0) {
                            closeButtons[0].click();
                        }
                    });
                } catch (e) {
                    console.log("Manual DOM manipulation failed: " + e.message);
                }
                
                // Method 3: Remove all backdrops
                try {
                    const backdrops = document.querySelectorAll(".modal-backdrop");
                    backdrops.forEach(backdrop => {
                        backdrop.remove();
                    });
                } catch (e) {
                    console.log("Backdrop removal failed: " + e.message);
                }
                
                // Method 4: Clean up body classes and styles
                try {
                    document.body.classList.remove("modal-open");
                    document.body.style.overflow = "";
                    document.body.style.paddingRight = "";
                } catch (e) {
                    console.log("Body cleanup failed: " + e.message);
                }
                
                // Method 5: Force remove specific problematic modals by ID
                try {
                    const problematicModals = ["modalConfirm", "modalAlert", "modalSessionLogout"];
                    problematicModals.forEach(id => {
                        const modal = document.getElementById(id);
                        if (modal) {
                            modal.classList.remove("show");
                            modal.style.display = "none";
                            modal.setAttribute("aria-hidden", "true");
                        }
                    });
                } catch (e) {
                    console.log("Specific modal cleanup failed: " + e.message);
                }
                
                return true;
            ');
            
            // Take a screenshot after force closing
            // \App\Tests\E2E\Utils\ScreenshotUtils::takeScreenshot($client, 'ModalUtils', 'after_force_close');
            
            // Add a small delay to let the DOM update
            usleep(500000); // 500ms
            
            return true;
        } catch (\Exception $e) {
            TestLogger::error("Error force closing modals: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Handles error modals that might appear during file upload or other operations.
     * Returns information about any errors detected.
     *
     * @param Client $client The Panther client
     * @return array Array with 'detected' (bool), 'message' (string), and 'closed' (bool) keys
     */
    public static function handleErrorModals(Client $client): array
    {
        TestLogger::debug("Checking for error modals");
        $result = [
            'detected' => false,
            'message' => '',
            'closed' => false
        ];
        
        try {
            // Check for error modal titles
            $errorModals = $client->getWebDriver()->findElements(
                WebDriverBy::cssSelector('.modal-confirm .modal-title, .modal-alert .modal-title')
            );
            
            foreach ($errorModals as $modal) {
                $modalText = $modal->getText();
                TestLogger::debug("Modal detected with title: " . $modalText);
                
                if (strpos($modalText, 'Import idevice/block elp error') !== false || 
                    strpos($modalText, 'Import error') !== false ||
                    strpos($modalText, 'Error') !== false) {
                    
                    $result['detected'] = true;
                    $result['message'] = $modalText;
                    
                    // Try to get the error message - only get the first one to avoid duplicates
                    $errorMessages = $client->getWebDriver()->findElements(
                        WebDriverBy::cssSelector('.modal-confirm .modal-body, .modal-alert .modal-body')
                    );
                    
                    if (count($errorMessages) > 0) {
                        $messageText = $errorMessages[0]->getText();
                        if (!empty(trim($messageText))) {
                            $result['message'] .= ": " . $messageText;
                            TestLogger::debug("Error message: " . $messageText);
                        }
                    }
                    
                    // Try to close the error modal
                    try {
                        $closeButtons = $client->getWebDriver()->findElements(
                            WebDriverBy::cssSelector('.modal-confirm .modal-footer .btn, .modal-alert .modal-footer .btn')
                        );
                        
                        if (count($closeButtons) > 0) {
                            $closeButtons[0]->click();
                            TestLogger::debug("Closed error modal");
                            $result['closed'] = true;
                        }
                    } catch (\Exception $e) {
                        TestLogger::warning("Could not close error modal: " . $e->getMessage());
                    }
                    
                    break; // Only handle the first error modal
                }
            }
            
            // If no specific error modals found, check for alert elements
            if (!$result['detected']) {
                $alertElements = $client->getWebDriver()->findElements(
                    WebDriverBy::cssSelector('.alert-danger')
                );
                
                if (count($alertElements) > 0) {
                    foreach ($alertElements as $alert) {
                        $alertText = $alert->getText();
                        TestLogger::debug("Alert found: " . $alertText);
                        $result['detected'] = true;
                        $result['message'] = $alertText;
                        break; // Only use the first alert
                    }
                }
            }
            
            return $result;
        } catch (\Exception $e) {
            TestLogger::error("Error checking for error modals: " . $e->getMessage());
            return $result;
        }
    }
}
