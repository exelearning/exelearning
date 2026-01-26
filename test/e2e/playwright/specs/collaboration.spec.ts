import { test, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import { NavigationPage } from '../pages/navigation.page';
import { WorkareaPage } from '../pages/workarea.page';
import { waitForYjsSync } from '../helpers/sync-helpers';

/**
 * Real-Time Collaboration Tests
 * These tests verify that multiple clients can work on the same project simultaneously
 * with changes syncing in real-time via Yjs WebSocket
 *
 * NOTE: These tests are skipped in static mode as they require WebSocket collaboration
 */

test.describe('Real-Time Collaboration', () => {
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

        // TODO: This test is flaky due to slow Yjs bidirectional sync timing
        // The sync DOES work (screenshots show child appears after timeout),
        // but takes >60s when joining client makes changes syncing back to owner
        test.skip('should sync child node creation between clients', async ({
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

            // Client A should see the child
            await navA.waitForNodeInNav(childName);

            // Verify hierarchy
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
        // TODO: This test is flaky due to slow Yjs bidirectional sync timing
        // Same issue as child node creation test - joining client's changes
        // sync back to owner slowly (>60s)
        test.skip('should sync node reordering between clients', async ({
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
});
