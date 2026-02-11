import { test, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import { NavigationPage } from '../pages/navigation.page';
import { WorkareaPage } from '../pages/workarea.page';
import { waitForYjsSync } from '../helpers/sync-helpers';
import { openElpFile } from '../helpers/workarea-helpers';
import * as path from 'path';

/**
 * Real-Time Collaboration Tests
 * These tests verify that multiple clients can work on the same project simultaneously
 * with changes syncing in real-time via Yjs WebSocket
 *
 * NOTE: These tests are skipped in static mode as they require WebSocket collaboration
 */

test.describe('Real-Time Collaboration', () => {
    const LOCAL_ELPX_FIXTURE = path.resolve(__dirname, '../../../fixtures/really-simple-test-project.elpx');

    // Collaboration tests need more time for WebSocket sync between clients
    test.setTimeout(120000); // 2 minutes per test

    // Skip all collaboration tests in static mode
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test.describe('Project Sharing Setup', () => {
        test('should allow second client to join via share URL', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Client A creates a project
            const projectTitle = 'Collaboration Test Project';
            const projectUuid = await createProject(authenticatedPage, projectTitle);

            // Navigate Client A to the project
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);

            // Client A gets share URL
            const shareUrl = await getShareUrl(authenticatedPage);
            expect(shareUrl).toContain(projectUuid);

            // Client B joins via share URL
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            // Verify both clients are on the same project
            const clientAUrl = authenticatedPage.url();
            const clientBUrl = secondAuthenticatedPage.url();

            expect(clientAUrl).toContain(projectUuid);
            expect(clientBUrl).toContain(projectUuid);

            // Verify Yjs is connected on both clients
            await waitForYjsSync(authenticatedPage);
            await waitForYjsSync(secondAuthenticatedPage);
        });
    });

    test.describe('Node Creation Sync', () => {
        test('should sync node creation from Client A to Client B', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Setup: Both clients on same project
            const projectUuid = await createProject(authenticatedPage, 'Node Creation Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            const navA = new NavigationPage(authenticatedPage);
            const navB = new NavigationPage(secondAuthenticatedPage);

            // Client A creates a new node
            const nodeName = `Test Node ${Date.now()}`;
            await navA.createNodeAtRoot(nodeName);

            // Client B should see the node appear
            await navB.waitForNodeInNav(nodeName, 30000);

            // Verify node exists in both navigations
            const nodeIdA = await navA.getNodeIdByTitle(nodeName);
            const nodeIdB = await navB.getNodeIdByTitle(nodeName);

            expect(nodeIdA).toBeTruthy();
            expect(nodeIdB).toBe(nodeIdA);
        });

        test('should sync child node creation between clients', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Setup
            const projectUuid = await createProject(authenticatedPage, 'Child Node Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            const navA = new NavigationPage(authenticatedPage);
            const navB = new NavigationPage(secondAuthenticatedPage);

            // Client A creates parent node
            const parentName = `Parent ${Date.now()}`;
            await navA.createNodeAtRoot(parentName);
            await navB.waitForNodeInNav(parentName);

            // Client B creates child node
            const childName = `Child ${Date.now()}`;
            await navB.createChildNode(parentName, childName);

            // Client A should see the child under the correct parent
            await navA.waitForChildrenOrder(parentName, [childName], 30000);

            // Verify hierarchy on both sides
            const childrenA = await navA.getChildrenTitles(parentName);
            const childrenB = await navB.getChildrenTitles(parentName);

            expect(childrenA).toContain(childName);
            expect(childrenB).toContain(childName);
            expect(childrenA).toEqual(childrenB);
        });
    });

    test.describe('Node Deletion Sync', () => {
        test('should sync node deletion from Client A to Client B', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Setup
            const projectUuid = await createProject(authenticatedPage, 'Node Deletion Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            const navA = new NavigationPage(authenticatedPage);
            const navB = new NavigationPage(secondAuthenticatedPage);

            // Client A creates a node
            const nodeName = `To Delete ${Date.now()}`;
            await navA.createNodeAtRoot(nodeName);
            await navB.waitForNodeInNav(nodeName);

            // Client A deletes the node
            await navA.deleteNodeByTitle(nodeName);

            // Client B should see it disappear
            await navB.waitForNodeNotInNav(nodeName, 30000);

            // Verify it's gone from both
            const nodeIdA = await navA.getNodeIdByTitle(nodeName);
            const nodeIdB = await navB.getNodeIdByTitle(nodeName);

            expect(nodeIdA).toBeNull();
            expect(nodeIdB).toBeNull();
        });
    });

    test.describe('Node Reordering Sync', () => {
        test('should sync node reordering between clients', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Setup
            const projectUuid = await createProject(authenticatedPage, 'Node Reordering Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            const navA = new NavigationPage(authenticatedPage);
            const navB = new NavigationPage(secondAuthenticatedPage);

            // Create parent and two children
            const parentName = `Parent ${Date.now()}`;
            const child1Name = `Child 1 ${Date.now()}`;
            const child2Name = `Child 2 ${Date.now()}`;

            await navA.createNodeAtRoot(parentName);
            await navB.waitForNodeInNav(parentName);

            await navA.createChildNode(parentName, child1Name);
            await navB.waitForNodeInNav(child1Name);

            await navA.createChildNode(parentName, child2Name);
            await navB.waitForNodeInNav(child2Name);

            // Get initial order
            const initialOrder = [child1Name, child2Name];
            await navA.waitForChildrenOrder(parentName, initialOrder);
            await navB.waitForChildrenOrder(parentName, initialOrder);

            // Client B moves first child down
            await navB.moveNodeDown(child1Name);

            // Expected new order
            const newOrder = [child2Name, child1Name];

            // Both clients should see new order
            await navA.waitForChildrenOrder(parentName, newOrder, 15000);
            await navB.waitForChildrenOrder(parentName, newOrder, 15000);

            // Verify order persists
            const finalOrderA = await navA.getChildrenTitles(parentName);
            const finalOrderB = await navB.getChildrenTitles(parentName);

            expect(finalOrderA).toEqual(newOrder);
            expect(finalOrderB).toEqual(newOrder);
        });
    });

    test.describe('Block Deletion with Locked iDevices', () => {
        test('should warn when deleting a block containing iDevices locked by another user', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Setup: Both clients on same project
            const projectUuid = await createProject(authenticatedPage, 'Block Delete Lock Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            const navA = new NavigationPage(authenticatedPage);
            const navB = new NavigationPage(secondAuthenticatedPage);
            const workareaA = new WorkareaPage(authenticatedPage);

            // Client A creates a page and adds a text iDevice
            const pageName = `Lock Test Page ${Date.now()}`;
            await navA.createNodeAtRoot(pageName);
            await navB.waitForNodeInNav(pageName);

            await workareaA.addTextIdevice();

            // The iDevice starts in edition mode after being added.
            // Save it with real content first to avoid empty-save validation failures.
            const ideviceBlock = authenticatedPage.locator('#node-content article .idevice_node.text').first();
            await ideviceBlock.waitFor({ timeout: 10000 });
            await workareaA.editFirstTextIdevice(`Lock seed content ${Date.now()}`);

            // Client A enters edit mode on the iDevice (acquires lock)
            const editBtn = ideviceBlock.locator('.btn-edit-idevice');
            await editBtn.waitFor({ timeout: 10000 });
            await editBtn.click();

            // Wait for edition mode to be active
            await authenticatedPage.waitForFunction(
                () => {
                    const el = document.querySelector('#node-content article .idevice_node.text');
                    return el?.getAttribute('mode') === 'edition';
                },
                { timeout: 15000 },
            );

            // Wait for lock to propagate via Yjs
            await authenticatedPage.waitForTimeout(2000);

            // Client B navigates to the same page
            await navB.selectNodeByTitle(pageName);
            await secondAuthenticatedPage.waitForTimeout(2000);

            // Wait for the iDevice to appear on Client B's view
            await secondAuthenticatedPage
                .locator('#node-content article .idevice_node.text')
                .first()
                .waitFor({ timeout: 15000 });

            // Client B: find the block (article.box) containing the iDevice and click Delete box
            const blockArticle = secondAuthenticatedPage.locator('#node-content article.box').first();
            await blockArticle.waitFor({ timeout: 10000 });
            const blockId = await blockArticle.getAttribute('id');

            // Enable advanced mode to see the Delete box option
            await secondAuthenticatedPage.evaluate(() => {
                const advBtn = document.querySelector('.btn-advanced-mode, #btn-advanced-mode');
                if (advBtn) (advBtn as HTMLElement).click();
            });
            await secondAuthenticatedPage.waitForTimeout(300);

            // Open the block dropdown menu
            const dropdownToggle = blockArticle.locator('[data-bs-toggle="dropdown"]').first();
            await dropdownToggle.click();
            await secondAuthenticatedPage.waitForTimeout(300);

            // Click "Delete box" button
            const deleteBtn = secondAuthenticatedPage.locator(`#deleteBlock${blockId}`);
            await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });
            await deleteBtn.click();

            // Assert: confirmation modal appears with warning text
            const confirmModal = secondAuthenticatedPage.locator('#modalConfirm');
            await confirmModal.waitFor({ state: 'visible', timeout: 10000 });

            // Verify the modal contains warning about the other user
            const modalBody = confirmModal.locator('.modal-body');
            const bodyText = await modalBody.textContent();
            expect(bodyText).toContain('Warning');

            // Click Cancel to keep the block intact
            const cancelBtn = confirmModal.locator('button.cancel');
            await cancelBtn.click();
            await secondAuthenticatedPage.waitForTimeout(500);

            // Assert: block is still present after cancelling
            const blockStillExists = await secondAuthenticatedPage.locator(`#${blockId}`).count();
            expect(blockStillExists).toBeGreaterThan(0);
        });
    });

    test.describe('Content Editing Sync', () => {
        test('should sync content edits between clients', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Setup
            const projectUuid = await createProject(authenticatedPage, 'Content Edit Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            const navA = new NavigationPage(authenticatedPage);
            const navB = new NavigationPage(secondAuthenticatedPage);
            const workareaA = new WorkareaPage(authenticatedPage);
            const workareaB = new WorkareaPage(secondAuthenticatedPage);

            // Client A creates a page
            const pageName = `Content Page ${Date.now()}`;
            await navA.createNodeAtRoot(pageName);
            await navB.waitForNodeInNav(pageName);

            // Client A adds text iDevice
            await workareaA.addTextIdevice();

            // Wait a moment for iDevice to be created
            await authenticatedPage.waitForTimeout(500);

            // Client A edits content
            const testContent = `Test content from Client A at ${Date.now()}`;
            await workareaA.editFirstTextIdevice(testContent);

            // Wait for save to complete
            await authenticatedPage.waitForTimeout(1000);

            // Client B navigates to the same page
            await navB.selectNodeByTitle(pageName);
            await workareaB.waitForContentReady(pageName);

            // Client B should see the content
            await workareaB.waitForTextInContent(testContent, 20000);

            // Verify content is present
            const hasContent = await workareaB.hasTextInContent(testContent);
            expect(hasContent).toBeTruthy();
        });
    });

    test.describe('User Presence Sync', () => {
        test('should show collaborator in concurrent users list on initiator', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Initiator creates project
            const projectUuid = await createProject(authenticatedPage, 'User Presence Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsSync(authenticatedPage);

            // Get share URL and have joiner join
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            // Wait for the initiator to see >1 online users via Yjs awareness
            await authenticatedPage.waitForFunction(
                () => {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    const dm = bridge?.documentManager;
                    if (!dm) return false;
                    const users = dm.getOnlineUsers();
                    return users.length > 1;
                },
                { timeout: 30000, polling: 500 },
            );

            // Verify the concurrent users UI shows 2+ users
            await authenticatedPage.waitForFunction(
                () => {
                    const el = document.querySelector('#exe-concurrent-users');
                    const num = parseInt(el?.getAttribute('num') || '0', 10);
                    return num > 1;
                },
                { timeout: 30000, polling: 500 },
            );

            // Also verify on joiner side
            await secondAuthenticatedPage.waitForFunction(
                () => {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    const dm = bridge?.documentManager;
                    if (!dm) return false;
                    const users = dm.getOnlineUsers();
                    return users.length > 1;
                },
                { timeout: 30000, polling: 500 },
            );
        });

        test('should show online users button for both initiator and joiner and keep it visible', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Initiator creates project
            const projectUuid = await createProject(authenticatedPage, 'Online Users Button Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsSync(authenticatedPage);

            // Get share URL and have joiner join
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            // Wait for awareness to propagate (both sides see 2+ users)
            await authenticatedPage.waitForFunction(
                () => {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    return bridge?.documentManager?.getOnlineUsers()?.length > 1;
                },
                { timeout: 30000, polling: 500 },
            );

            await secondAuthenticatedPage.waitForFunction(
                () => {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    return bridge?.documentManager?.getOnlineUsers()?.length > 1;
                },
                { timeout: 30000, polling: 500 },
            );

            // Verify button is visible on JOINER side
            const joinerButton = secondAuthenticatedPage.locator('#button-more-exe-concurrent-users');
            await expect(joinerButton).toBeVisible({ timeout: 15000 });

            // Verify button is visible on INITIATOR side
            const initiatorButton = authenticatedPage.locator('#button-more-exe-concurrent-users');
            await expect(initiatorButton).toBeVisible({ timeout: 15000 });

            // Wait 10 seconds and verify button is STILL visible (no transient hiding)
            await authenticatedPage.waitForTimeout(10000);
            await expect(initiatorButton).toBeVisible();
            await expect(joinerButton).toBeVisible();

            // Verify correct user count on both sides
            const initiatorUserCount = await authenticatedPage.evaluate(() => {
                const el = document.querySelector('#exe-concurrent-users');
                return parseInt(el?.getAttribute('num') || '0', 10);
            });
            expect(initiatorUserCount).toBe(2);

            const joinerUserCount = await secondAuthenticatedPage.evaluate(() => {
                const el = document.querySelector('#exe-concurrent-users');
                return parseInt(el?.getAttribute('num') || '0', 10);
            });
            expect(joinerUserCount).toBe(2);
        });

        test('should show online users button on initiator on first join without page reload', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Initiator opens project alone first
            const projectUuid = await createProject(authenticatedPage, 'No Reload Presence Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsSync(authenticatedPage);

            const initiatorButton = authenticatedPage.locator('#button-more-exe-concurrent-users');
            await expect(initiatorButton).toBeHidden({ timeout: 10000 });

            // Joiner opens the shared link
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            // Initiator must see the users button without any manual reload/edit action
            await expect(initiatorButton).toBeVisible({ timeout: 30000 });

            // Keep idle for a few seconds and ensure it remains visible
            await authenticatedPage.waitForTimeout(8000);
            await expect(initiatorButton).toBeVisible();

            // Check users count on initiator side
            const initiatorUserCount = await authenticatedPage.evaluate(() => {
                const el = document.querySelector('#exe-concurrent-users');
                return parseInt(el?.getAttribute('num') || '0', 10);
            });
            expect(initiatorUserCount).toBe(2);
        });

        test('should show online users button on initiator after opening local .elpx without page reload', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Open workarea and import a local .elpx (creates/reinitializes project without full reload)
            await authenticatedPage.goto('/workarea');
            await openElpFile(authenticatedPage, LOCAL_ELPX_FIXTURE, 1);
            await waitForYjsSync(authenticatedPage);

            // Initiator alone -> users button hidden
            const initiatorButton = authenticatedPage.locator('#button-more-exe-concurrent-users');
            await expect(initiatorButton).toBeHidden({ timeout: 10000 });

            // Joiner opens shared link
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            // Initiator must see joiner without manual F5
            await expect(initiatorButton).toBeVisible({ timeout: 30000 });

            const initiatorUserCount = await authenticatedPage.evaluate(() => {
                const el = document.querySelector('#exe-concurrent-users');
                return parseInt(el?.getAttribute('num') || '0', 10);
            });
            expect(initiatorUserCount).toBeGreaterThan(1);
        });
    });

    test.describe('Bidirectional Content Sync', () => {
        test('should sync joiner content changes to initiator without reload', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // Initiator creates project with a page
            const projectUuid = await createProject(authenticatedPage, 'Bidirectional Sync Test');
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsSync(authenticatedPage);

            const navA = new NavigationPage(authenticatedPage);
            const navB = new NavigationPage(secondAuthenticatedPage);

            // Create a page from initiator
            const pageName = `Shared Page ${Date.now()}`;
            await navA.createNodeAtRoot(pageName);

            // Get share URL and have joiner join
            const shareUrl = await getShareUrl(authenticatedPage);
            await joinSharedProject(secondAuthenticatedPage, shareUrl);

            // Wait for joiner to see the page
            await navB.waitForNodeInNav(pageName, 30000);

            // Joiner creates a child node (this tests joiner→initiator sync)
            const childName = `Joiner Child ${Date.now()}`;
            await navB.createChildNode(pageName, childName);

            // Initiator should see the child WITHOUT reload
            await navA.waitForNodeInNav(childName, 30000);

            // Verify node exists in both navigations
            const nodeIdA = await navA.getNodeIdByTitle(childName);
            const nodeIdB = await navB.getNodeIdByTitle(childName);
            expect(nodeIdA).toBeTruthy();
            expect(nodeIdB).toBe(nodeIdA);
        });
    });
});
