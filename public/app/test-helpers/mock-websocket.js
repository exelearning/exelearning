/**
 * Mock WebSocket and Y.js providers for frontend tests
 */

export class MockAwareness {
  constructor() {
    this.clientID = 12345;
    this._localState = {};
    this._states = new Map();
    this._listeners = {};
  }

  getLocalState() {
    return this._localState;
  }

  setLocalState(state) {
    this._localState = state;
  }

  setLocalStateField(field, value) {
    if (!this._localState) this._localState = {};
    this._localState[field] = value;
  }

  getStates() {
    return this._states;
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
    }
  }
}

export class MockWebsocketProvider {
  constructor(url, roomName, ydoc, options) {
    this.url = url;
    this.roomName = roomName;
    this.ydoc = ydoc;
    this.options = options;
    this.synced = true;
    this._listeners = {};
    this.awareness = new MockAwareness();
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  once(event, callback) {
    this.on(event, callback);
    if (event === 'sync') {
      setTimeout(() => callback(true), 0);
    }
  }

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
    }
  }

  disconnect() {}
  destroy() {}
}

export class MockIndexeddbPersistence {
  constructor(dbName, ydoc) {
    this.dbName = dbName;
    this.ydoc = ydoc;
    this._listeners = {};
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    // Auto-fire synced event
    if (event === 'synced') {
      setTimeout(() => callback(), 0);
    }
  }

  destroy() {}
}

/**
 * Decode asset messages from WebSocket binary format.
 * AssetWebSocketHandler sends messages as Uint8Array with 0xFF prefix.
 * @param {Uint8Array|string} data - The data to decode
 * @returns {object} Parsed JSON message
 */
export function decodeAssetMessage(data) {
  if (data instanceof Uint8Array) {
    // Check for 0xFF prefix (asset message marker)
    if (data[0] === 0xff) {
      const jsonBytes = data.slice(1);
      return JSON.parse(new TextDecoder().decode(jsonBytes));
    }
    return JSON.parse(new TextDecoder().decode(data));
  }
  return JSON.parse(data);
}
