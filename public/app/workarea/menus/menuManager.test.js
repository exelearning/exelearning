import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./navbar/menuNavbar.js', () => ({
  default: function MockMenuNavbar() {
    this.load = vi.fn();
  },
}));

vi.mock('./structure/menuStructure.js', () => ({
  default: function MockMenuStructure(structureEngine) {
    this.engine = structureEngine;
    this.load = vi.fn(() => Promise.resolve());
  },
}));

vi.mock('./idevices/menuIdevices.js', () => ({
  default: function MockMenuIdevices(idevicesList) {
    this.list = idevicesList;
    this.load = vi.fn();
  },
}));

vi.mock('./menuEngine.js', () => ({
  default: function MockMenuEngine() {
    this.behaviour = vi.fn();
  },
}));

import MenuManager from './menuManager.js';

describe('MenuManager orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes all menu subsystems with the expected dependencies', () => {
    const structureEngine = { info: 'structure' };
    const ideviceList = ['i-device'];
    const manager = new MenuManager({
      project: { structure: structureEngine },
      idevices: { list: ideviceList },
    });

    manager.loadJsMenusClasses();

    expect(manager.menuStructure.engine).toBe(structureEngine);
    expect(manager.menuIdevices.list).toBe(ideviceList);
    expect(typeof manager.navbar.load).toBe('function');
    expect(typeof manager.menuEngine.behaviour).toBe('function');
  });

  it('loads menus and runs their lifecycle hooks', async () => {
    const structureEngine = { info: 'structure' };
    const manager = new MenuManager({
      project: { structure: structureEngine },
      idevices: { list: ['idevice'] },
    });

    await manager.load();

    expect(manager.menuStructure.load).toHaveBeenCalled();
    expect(manager.menuIdevices.load).toHaveBeenCalled();
    expect(manager.navbar.load).toHaveBeenCalled();
    expect(manager.menuEngine.behaviour).toHaveBeenCalled();
  });
});
