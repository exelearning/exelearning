import AulaSecreta3D from './aulaSecreta3d.js';

describe('AulaSecreta3D', () => {
  let game;
  let mockCanvas;
  let mockCtx;
  let mockElements;
  let onCloseMock;

  beforeEach(() => {
    mockCtx = {
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };

    mockCanvas = {
      getContext: vi.fn(() => mockCtx),
      getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600 })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      width: 800,
      height: 600,
      focus: vi.fn(),
    };

    mockElements = {
      statsEl: document.createElement('div'),
      timerEl: document.createElement('div'),
      overlayEl: document.createElement('div'),
      overlayTitleEl: document.createElement('div'),
      overlayTextEl: document.createElement('div'),
      startButton: document.createElement('button'),
      closeButton: document.createElement('button'),
    };

    onCloseMock = vi.fn();

    game = new AulaSecreta3D({
      canvas: mockCanvas,
      ...mockElements,
      onClose: onCloseMock,
    });

    // Mock performance.now and requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => setTimeout(cb, 16));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => clearTimeout(id));
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default player position and state', () => {
      expect(game.player.x).toBe(8.5);
      expect(game.player.y).toBe(13.5);
      expect(game._running).toBe(false);
      expect(game._paused).toBe(true);
    });
  });

  describe('start/stop', () => {
    it('should start the game and attach event listeners', () => {
      const attachSpy = vi.spyOn(game, 'attach');
      game.start();
      expect(game._running).toBe(true);
      expect(attachSpy).toHaveBeenCalled();
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    it('should stop the game and detach event listeners', () => {
      const detachSpy = vi.spyOn(game, 'detach');
      game.start();
      game.stop();
      expect(game._running).toBe(false);
      expect(detachSpy).toHaveBeenCalled();
    });
  });

  describe('overlays', () => {
    it('should show start overlay with instructions', () => {
      game.showStartOverlay();
      expect(mockElements.overlayTitleEl.textContent).toContain('huevo de pascua');
      expect(mockElements.overlayEl.classList.contains('hidden')).toBe(false);
    });

    it('should hide overlay when action is triggered', () => {
      game.showStartOverlay();
      game._onStartClick();
      expect(game._paused).toBe(false);
      expect(mockElements.overlayEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('input handling', () => {
    it('should track keys down on keydown', () => {
      const event = new KeyboardEvent('keydown', { key: 'w' });
      game.onKeyDown(event);
      expect(game.keysDown.has('w')).toBe(true);
    });

    it('should remove keys from set on keyup', () => {
      game.keysDown.add('w');
      const event = new KeyboardEvent('keyup', { key: 'w' });
      game.onKeyUp(event);
      expect(game.keysDown.has('w')).toBe(false);
    });

    it('should toggle map on "m" key', () => {
      expect(game.showMap).toBe(false);
      game.onKeyDown(new KeyboardEvent('keydown', { key: 'm' }));
      expect(game.showMap).toBe(true);
      game.onKeyDown(new KeyboardEvent('keydown', { key: 'm' }));
      expect(game.showMap).toBe(false);
    });

    it('should call onClose on escape key', () => {
      game.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('game logic', () => {
    it('should update remaining time', () => {
      game.remainingTime = 90;
      game.update(0.5);
      expect(game.remainingTime).toBe(89.5);
    });

    it('should show lose overlay when time runs out', () => {
      const loseSpy = vi.spyOn(game, 'showLoseOverlay');
      game.remainingTime = 0.1;
      game.update(0.2);
      expect(game._lost).toBe(true);
      expect(loseSpy).toHaveBeenCalled();
    });

    it('should collect pickups when player is near', () => {
      // First pickup is at { x: 4.5, y: 2.5 }
      game.player.x = 4.5;
      game.player.y = 2.55;
      game.checkPickups();
      expect(game.pickups[0].collected).toBe(true);
    });

    it('should win the game when all pickups collected and reaching exit', () => {
      const winSpy = vi.spyOn(game, 'showWinOverlay');
      game.pickups.forEach(p => p.collected = true);
      game.player.x = game.exit.x;
      game.player.y = game.exit.y;
      game.checkExit();
      expect(game._won).toBe(true);
      expect(winSpy).toHaveBeenCalled();
    });
  });

  describe('collision', () => {
    it('should return true for wall cells', () => {
      // Wall at 0,0
      expect(game.isSolid(0.5, 0.5)).toBe(true);
    });

    it('should return false for empty cells', () => {
      // Empty space at 1,1
      expect(game.isSolid(1.5, 1.5)).toBe(false);
    });
  });

  describe('rendering', () => {
    it('should perform raycasting and draw columns', () => {
      game.start();
      game.render();
      // Should have called fillRect many times for floor/ceiling and columns
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should render minimap when enabled', () => {
      game.showMap = true;
      game.render();
      // minimap uses arc for player and pickups
      expect(mockCtx.arc).toHaveBeenCalled();
    });
  });
});
