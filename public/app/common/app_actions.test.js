import Actions from './app_actions.js';

describe('Actions', () => {
  let actions;
  let mockElement;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock DOM element
    mockElement = {
      setAttribute: vi.fn(),
      dispatchEvent: vi.fn()
    };
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

    actions = new Actions({});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty pending array', () => {
      expect(actions.pending).toEqual([]);
    });

    it('should set authorizeAddActions to true', () => {
      expect(actions.authorizeAddActions).toBe(true);
    });

    it('should set authorizeAddActionsTimer to 5000ms', () => {
      expect(actions.authorizeAddActionsTimer).toBe(5000);
    });

    it('should set intervalTime to 100ms', () => {
      expect(actions.intervalTime).toBe(100);
    });

    it('should store app reference', () => {
      const mockApp = { name: 'test' };
      const instance = new Actions(mockApp);
      expect(instance.app).toBe(mockApp);
    });

    it('should start the check actions interval on construction', () => {
      const instance = new Actions({});
      expect(instance.interval).toBeDefined();
    });
  });

  describe('addPendingAction', () => {
    it('should add action to pending queue', () => {
      const action = { element: 'test-element', event: 'click' };
      actions.addPendingAction(action);
      expect(actions.pending).toHaveLength(1);
      expect(actions.pending[0]).toEqual(action);
    });

    it('should set authorizeAddActions to false after adding', () => {
      const action = { element: 'test-element', event: 'click' };
      actions.addPendingAction(action);
      expect(actions.authorizeAddActions).toBe(false);
    });

    it('should not add second action immediately', () => {
      actions.addPendingAction({ element: 'test1', event: 'click' });
      actions.addPendingAction({ element: 'test2', event: 'click' });

      expect(actions.pending).toHaveLength(1);
      expect(actions.pending[0].element).toBe('test1');
    });

    it('should allow adding action after 5 seconds', () => {
      actions.addPendingAction({ element: 'test1', event: 'click' });

      expect(actions.authorizeAddActions).toBe(false);

      vi.advanceTimersByTime(5000);

      expect(actions.authorizeAddActions).toBe(true);

      actions.addPendingAction({ element: 'test2', event: 'click' });
      // After 5000ms, the interval has processed test1 (50 times), so only test2 remains
      expect(actions.pending).toHaveLength(1);
    });

    it('should not allow adding if only 4999ms have passed', () => {
      actions.addPendingAction({ element: 'test1', event: 'click' });

      vi.advanceTimersByTime(4999);

      expect(actions.authorizeAddActions).toBe(false);

      actions.addPendingAction({ element: 'test2', event: 'click' });
      // After 4999ms, the interval has already processed test1 (49 times), so queue is empty
      expect(actions.pending).toHaveLength(0);
    });

    it('should handle multiple actions with proper timing', () => {
      // Temporarily clear interval to test without processing
      clearInterval(actions.interval);

      actions.addPendingAction({ element: 'test1', event: 'click' });
      expect(actions.pending).toHaveLength(1);

      vi.advanceTimersByTime(5000);
      actions.addPendingAction({ element: 'test2', event: 'click' });
      expect(actions.pending).toHaveLength(2);

      vi.advanceTimersByTime(5000);
      actions.addPendingAction({ element: 'test3', event: 'click' });
      expect(actions.pending).toHaveLength(3);
    });

    it('should not add action when authorizeAddActions is false', () => {
      actions.authorizeAddActions = false;
      actions.addPendingAction({ element: 'test', event: 'click' });
      expect(actions.pending).toHaveLength(0);
    });
  });

  describe('addCheckActionsInterval', () => {
    it('should process pending actions every 100ms', () => {
      actions.addPendingAction({ element: 'btn-1', event: 'click' });

      expect(actions.pending).toHaveLength(1);

      vi.advanceTimersByTime(100);

      expect(document.getElementById).toHaveBeenCalledWith('btn-1');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('pending-action', true);
      expect(mockElement.dispatchEvent).toHaveBeenCalled();
      expect(actions.pending).toHaveLength(0);
    });

    it('should not process if pending queue is empty', () => {
      vi.advanceTimersByTime(100);

      expect(document.getElementById).not.toHaveBeenCalled();
      expect(mockElement.setAttribute).not.toHaveBeenCalled();
      expect(mockElement.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should process actions in FIFO order', () => {
      actions.addPendingAction({ element: 'first', event: 'click' });
      vi.advanceTimersByTime(5000);
      actions.addPendingAction({ element: 'second', event: 'focus' });

      vi.advanceTimersByTime(100);
      expect(document.getElementById).toHaveBeenCalledWith('first');

      vi.advanceTimersByTime(100);
      expect(document.getElementById).toHaveBeenCalledWith('second');
    });

    it('should dispatch the correct event type', () => {
      actions.addPendingAction({ element: 'btn-1', event: 'focus' });

      vi.advanceTimersByTime(100);

      const dispatchedEvent = mockElement.dispatchEvent.mock.calls[0][0];
      expect(dispatchedEvent).toBeInstanceOf(Event);
      expect(dispatchedEvent.type).toBe('focus');
    });

    it('should handle multiple actions in queue', () => {
      // Temporarily clear interval to test queue behavior without automatic processing
      clearInterval(actions.interval);

      actions.addPendingAction({ element: 'btn-1', event: 'click' });
      vi.advanceTimersByTime(5000);
      actions.addPendingAction({ element: 'btn-2', event: 'focus' });
      vi.advanceTimersByTime(5000);
      actions.addPendingAction({ element: 'btn-3', event: 'blur' });

      expect(actions.pending).toHaveLength(3);

      // Restart interval to process actions
      actions.addCheckActionsInterval();

      vi.advanceTimersByTime(100);
      expect(actions.pending).toHaveLength(2);

      vi.advanceTimersByTime(100);
      expect(actions.pending).toHaveLength(1);

      vi.advanceTimersByTime(100);
      expect(actions.pending).toHaveLength(0);
    });

    it('should continue processing even if element not found', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);

      actions.addPendingAction({ element: 'nonexistent', event: 'click' });

      expect(() => {
        vi.advanceTimersByTime(100);
      }).toThrow();

      expect(actions.pending).toHaveLength(0);
    });

    it('should set pending-action attribute to true', () => {
      actions.addPendingAction({ element: 'btn-1', event: 'click' });

      vi.advanceTimersByTime(100);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('pending-action', true);
    });

    it('should process actions continuously', () => {
      actions.addPendingAction({ element: 'btn-1', event: 'click' });

      vi.advanceTimersByTime(100);
      expect(mockElement.dispatchEvent).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5000);
      actions.addPendingAction({ element: 'btn-2', event: 'focus' });

      vi.advanceTimersByTime(100);
      expect(mockElement.dispatchEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration', () => {
    it('should handle complete workflow: add action, wait, process', () => {
      const action = { element: 'submit-btn', event: 'click' };

      actions.addPendingAction(action);
      expect(actions.pending).toHaveLength(1);
      expect(actions.authorizeAddActions).toBe(false);

      // Process the action
      vi.advanceTimersByTime(100);

      expect(document.getElementById).toHaveBeenCalledWith('submit-btn');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('pending-action', true);
      expect(mockElement.dispatchEvent).toHaveBeenCalled();
      expect(actions.pending).toHaveLength(0);

      // Wait for authorization to reset (total 5000ms from addPendingAction)
      vi.advanceTimersByTime(4900);
      expect(actions.authorizeAddActions).toBe(true);
    });

    it('should handle burst of actions with proper throttling', () => {
      actions.addPendingAction({ element: 'btn1', event: 'click' });
      actions.addPendingAction({ element: 'btn2', event: 'click' });
      actions.addPendingAction({ element: 'btn3', event: 'click' });

      expect(actions.pending).toHaveLength(1);

      vi.advanceTimersByTime(100);
      expect(actions.pending).toHaveLength(0);
    });
  });
});
