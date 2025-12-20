import MenuStructure from './menuStructure.js';
import MenuStructureCompose from './menuStructureCompose.js';
import MenuStructureBehaviour from './menuStructureBehaviour.js';

// Mock MenuStructureCompose
vi.mock('./menuStructureCompose.js', () => {
  return {
    default: vi.fn().mockImplementation(function(engine) {
      this.engine = engine;
      this.compose = vi.fn();
    })
  };
});

// Mock MenuStructureBehaviour
vi.mock('./menuStructureBehaviour.js', () => {
  return {
    default: vi.fn().mockImplementation(function(engine) {
      this.engine = engine;
      this.behaviour = vi.fn();
    })
  };
});

describe('MenuStructure', () => {
  let menuStructure;
  let mockEngine;
  let mockMenuElement;

  beforeEach(() => {
    // Mock DOM element
    mockMenuElement = {
      id: 'menu_nav',
    };

    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '#main #menu_nav') return mockMenuElement;
      return null;
    });

    // Mock structure engine
    mockEngine = {
      name: 'test-engine',
    };

    menuStructure = new MenuStructure(mockEngine);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should store engine reference', () => {
      expect(menuStructure.engine).toBe(mockEngine);
    });

    it('should query menu structure element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#main #menu_nav');
    });

    it('should store menu structure element reference', () => {
      expect(menuStructure.menuStructure).toBe(mockMenuElement);
    });
  });

  describe('load', () => {
    it('should call compose', async () => {
      const spy = vi.spyOn(menuStructure, 'compose');
      await menuStructure.load();

      expect(spy).toHaveBeenCalled();
    });

    it('should call behaviour', async () => {
      const spy = vi.spyOn(menuStructure, 'behaviour');
      await menuStructure.load();

      expect(spy).toHaveBeenCalled();
    });

    it('should call compose before behaviour', async () => {
      const composeSpy = vi.spyOn(menuStructure, 'compose');
      const behaviourSpy = vi.spyOn(menuStructure, 'behaviour');

      await menuStructure.load();

      expect(composeSpy).toHaveBeenCalledBefore(behaviourSpy);
    });
  });

  describe('compose', () => {
    it('should create MenuStructureCompose instance', () => {
      menuStructure.compose();

      expect(MenuStructureCompose).toHaveBeenCalledWith(mockEngine);
      expect(menuStructure.menuStructureCompose).toBeDefined();
    });

    it('should call compose on MenuStructureCompose', () => {
      menuStructure.compose();

      expect(menuStructure.menuStructureCompose.compose).toHaveBeenCalled();
    });
  });

  describe('behaviour', () => {
    it('should create MenuStructureBehaviour instance', () => {
      menuStructure.behaviour();

      expect(MenuStructureBehaviour).toHaveBeenCalledWith(mockEngine);
      expect(menuStructure.menuStructureBehaviour).toBeDefined();
    });

    it('should call behaviour with true parameter', () => {
      menuStructure.behaviour();

      expect(menuStructure.menuStructureBehaviour.behaviour).toHaveBeenCalledWith(true);
    });
  });

  describe('integration', () => {
    it('should initialize compose and behaviour on load', async () => {
      await menuStructure.load();

      expect(menuStructure.menuStructureCompose).toBeDefined();
      expect(menuStructure.menuStructureCompose.compose).toHaveBeenCalled();
      expect(menuStructure.menuStructureBehaviour).toBeDefined();
      expect(menuStructure.menuStructureBehaviour.behaviour).toHaveBeenCalledWith(true);
    });
  });
});
