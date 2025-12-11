/**
 * Test Preload Script
 * Sets up the test environment before any tests run.
 * This ensures clean state and proper environment variables.
 */
import { beforeEach, afterAll } from 'bun:test';

// Ensure DB_PATH is set to in-memory for tests
process.env.DB_PATH = ':memory:';
process.env.ELYSIA_FILES_DIR = '/tmp/exelearning-test';

// Import modules that have global state to reset them
// These imports must happen after setting env vars
let roomManagerModule: typeof import('../src/websocket/room-manager') | null = null;
let heartbeatModule: typeof import('../src/websocket/heartbeat') | null = null;
let assetCoordinatorModule: typeof import('../src/websocket/asset-coordinator') | null = null;

// Lazy load modules to allow proper initialization
async function loadModules() {
    if (!roomManagerModule) {
        roomManagerModule = await import('../src/websocket/room-manager');
    }
    if (!heartbeatModule) {
        heartbeatModule = await import('../src/websocket/heartbeat');
    }
    if (!assetCoordinatorModule) {
        assetCoordinatorModule = await import('../src/websocket/asset-coordinator');
    }
}

// Reset global state before each test
beforeEach(async () => {
    try {
        await loadModules();

        // Reset room manager state
        if (roomManagerModule?.closeAllRooms) {
            roomManagerModule.closeAllRooms();
        }

        // Reset heartbeat state
        if (heartbeatModule?.stopAllHeartbeats) {
            heartbeatModule.stopAllHeartbeats();
        }

        // Reset asset coordinator state
        if (assetCoordinatorModule?.cleanupProject) {
            // Cleanup any test projects
            assetCoordinatorModule.cleanupProject('test-project');
            assetCoordinatorModule.cleanupProject('project-1');
            assetCoordinatorModule.cleanupProject('project-2');
        }
    } catch {
        // Modules may not be loaded yet, ignore errors
    }
});

// Cleanup after all tests
afterAll(async () => {
    try {
        await loadModules();

        if (roomManagerModule?.closeAllRooms) {
            roomManagerModule.closeAllRooms();
        }
        if (heartbeatModule?.stopAllHeartbeats) {
            heartbeatModule.stopAllHeartbeats();
        }
    } catch {
        // Ignore cleanup errors
    }
});
