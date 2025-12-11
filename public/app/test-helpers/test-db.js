/**
 * SQLite in-memory database helper for isolated tests
 *
 * Usage:
 *   import { createTestDb } from './test-helpers/test-db.js';
 *
 *   describe('MyTest', () => {
 *     let db;
 *     beforeEach(() => { db = createTestDb(); });
 *     afterEach(() => { db.close(); });
 *   });
 */

import { Database } from 'bun:sqlite';

/**
 * Create a fresh in-memory SQLite database for testing
 * Each call returns a completely isolated database instance
 */
export function createTestDb() {
  const db = new Database(':memory:');

  // Enable WAL mode for better concurrent access (optional for in-memory)
  db.exec('PRAGMA journal_mode = WAL');

  return db;
}

/**
 * Create a test database with common schema for asset/project tests
 */
export function createTestDbWithSchema() {
  const db = createTestDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime TEXT,
      size INTEGER,
      hash TEXT,
      data BLOB,
      uploaded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_assets_hash ON assets(hash);
  `);

  return db;
}

/**
 * Helper to seed test data
 */
export function seedTestAsset(db, asset) {
  const defaults = {
    id: `test-${Date.now()}`,
    project_id: 'test-project',
    filename: 'test.png',
    mime: 'image/png',
    size: 1024,
    hash: 'abc123',
    data: null,
    uploaded: 0,
  };

  const data = { ...defaults, ...asset };

  db.run(
    `INSERT INTO assets (id, project_id, filename, mime, size, hash, data, uploaded)
     VALUES ($id, $project_id, $filename, $mime, $size, $hash, $data, $uploaded)`,
    {
      $id: data.id,
      $project_id: data.project_id,
      $filename: data.filename,
      $mime: data.mime,
      $size: data.size,
      $hash: data.hash,
      $data: data.data,
      $uploaded: data.uploaded,
    }
  );

  return data;
}
