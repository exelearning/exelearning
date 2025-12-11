/**
 * Mock Y.js types for frontend tests
 */

export class MockYDoc {
  constructor() {
    this.clientID = 12345;
    this._arrays = {};
    this._maps = {};
    this._updateListeners = [];
  }

  getArray(name) {
    if (!this._arrays[name]) {
      this._arrays[name] = new MockYArray();
    }
    return this._arrays[name];
  }

  getMap(name) {
    if (!this._maps[name]) {
      this._maps[name] = new MockYMap();
    }
    return this._maps[name];
  }

  transact(fn) {
    fn();
  }

  on(event, callback) {
    if (event === 'update') {
      this._updateListeners.push(callback);
    }
  }

  off(event, callback) {
    if (event === 'update') {
      this._updateListeners = this._updateListeners.filter((cb) => cb !== callback);
    }
  }

  destroy() {}
}

export class MockYMap {
  constructor(data = {}) {
    this._data = new Map(Object.entries(data));
  }

  get(key) {
    return this._data.get(key);
  }

  set(key, value) {
    this._data.set(key, value);
  }

  has(key) {
    return this._data.has(key);
  }

  delete(key) {
    return this._data.delete(key);
  }

  forEach(callback) {
    this._data.forEach((v, k) => callback(v, k));
  }

  entries() {
    return this._data.entries();
  }

  keys() {
    return this._data.keys();
  }

  values() {
    return this._data.values();
  }

  toJSON() {
    return Object.fromEntries(this._data);
  }

  toString() {
    const content = this.get('content') || this.get('htmlContent');
    return content ? String(content) : '[object MockYMap]';
  }
}

export class MockYArray {
  constructor(items = []) {
    this._items = [...items];
  }

  get length() {
    return this._items.length;
  }

  get(index) {
    return this._items[index];
  }

  push(items) {
    if (Array.isArray(items)) {
      this._items.push(...items);
    } else {
      this._items.push(items);
    }
  }

  insert(index, items) {
    if (Array.isArray(items)) {
      this._items.splice(index, 0, ...items);
    } else {
      this._items.splice(index, 0, items);
    }
  }

  delete(index, length = 1) {
    this._items.splice(index, length);
  }

  forEach(callback) {
    this._items.forEach((item, index) => callback(item, index));
  }

  map(callback) {
    return this._items.map(callback);
  }

  toJSON() {
    return this._items.map((i) => (i.toJSON ? i.toJSON() : i));
  }

  toArray() {
    return [...this._items];
  }

  [Symbol.iterator]() {
    return this._items[Symbol.iterator]();
  }
}

export class MockUndoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  undo() {}
  redo() {}
  destroy() {}
}
