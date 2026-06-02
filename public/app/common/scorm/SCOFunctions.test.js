import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// Load SCORM_API_wrapper first (defines pipwerks)
const pipwerks = require('./SCORM_API_wrapper.js');
globalThis.pipwerks = pipwerks;

// Then load SCOFunctions (depends on pipwerks)
const scoFunctions = require('./SCOFunctions.js');
globalThis.loadPage = scoFunctions.loadPage;
globalThis.startTimer = scoFunctions.startTimer;
globalThis.computeTime = scoFunctions.computeTime;
globalThis.doBack = scoFunctions.doBack;
globalThis.doContinue = scoFunctions.doContinue;
globalThis.doQuit = scoFunctions.doQuit;
globalThis.unloadPage = scoFunctions.unloadPage;
globalThis.goBack = scoFunctions.goBack;
globalThis.goForward = scoFunctions.goForward;

// Test helpers for internal state
const setStartDate = scoFunctions._setStartDate;
const getStartDate = scoFunctions._getStartDate;
const setExitPageStatus = scoFunctions._setExitPageStatus;
const getExitPageStatus = scoFunctions._getExitPageStatus;
const setPageLoaded = scoFunctions._setPageLoaded;
const getPageLoaded = scoFunctions._getPageLoaded;
const resetScormLifecycleState = scoFunctions._resetScormLifecycleState;

describe('SCOFunctions.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset internal state via helpers
    setStartDate(0);
    setExitPageStatus(false);
    setPageLoaded(false);
    resetScormLifecycleState(globalThis.window);

    // Mock the scorm object methods
    globalThis.pipwerks.SCORM.init = vi.fn(() => true);
    globalThis.pipwerks.SCORM.GetCompletionStatus = vi.fn(() => 'not attempted');
    globalThis.pipwerks.SCORM.SetCompletionStatus = vi.fn();
    globalThis.pipwerks.SCORM.SetSuccessStatus = vi.fn();
    globalThis.pipwerks.SCORM.GetSuccessStatus = vi.fn(() => 'unknown');
    globalThis.pipwerks.SCORM.SetSessionTime = vi.fn();
    globalThis.pipwerks.SCORM.save = vi.fn(() => true);
    globalThis.pipwerks.SCORM.quit = vi.fn(() => true);
    globalThis.pipwerks.SCORM.SetExit = vi.fn();
    globalThis.pipwerks.SCORM.GetMode = vi.fn(() => 'normal');
    globalThis.pipwerks.SCORM.version = '1.2';

    // Mock nav functions
    globalThis.pipwerks.nav = {
      goBack: vi.fn(),
      goForward: vi.fn(),
    };

    // Mock API handle for UTILS.convertTotalMiliSeconds
    vi.spyOn(globalThis.pipwerks.SCORM.API, 'getHandle').mockReturnValue({
      LMSGetValue: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadPage', () => {
    it('initializes scorm and sets status if not attempted', () => {
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('not attempted');

      globalThis.loadPage();

      expect(globalThis.pipwerks.SCORM.init).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('unknown');
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).toHaveBeenCalledWith('unknown');
      expect(getExitPageStatus()).toBe(false);
    });

    it('sets status to unknown if incomplete', () => {
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('incomplete');

      globalThis.loadPage();

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('unknown');
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).toHaveBeenCalledWith('unknown');
    });

    it('does not change status if already completed', () => {
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('completed');

      globalThis.loadPage();

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
    });

    it('does not change status if passed', () => {
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('passed');

      globalThis.loadPage();

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
    });

    it('sets exitPageStatus to false', () => {
      setExitPageStatus(true);

      globalThis.loadPage();

      expect(getExitPageStatus()).toBe(false);
    });

    it('starts the timer by setting startDate', () => {
      const beforeTime = new Date().getTime();

      globalThis.loadPage();

      const afterTime = new Date().getTime();
      expect(getStartDate()).toBeGreaterThanOrEqual(beforeTime);
      expect(getStartDate()).toBeLessThanOrEqual(afterTime);
    });

    it('does not initialize twice when loadPage is called more than once', () => {
      globalThis.loadPage();
      globalThis.loadPage();

      expect(globalThis.pipwerks.SCORM.init).toHaveBeenCalledTimes(1);
      expect(getPageLoaded()).toBe(true);
    });
  });

  describe('startTimer', () => {
    it('sets startDate to current time', () => {
      const beforeTime = new Date().getTime();

      globalThis.startTimer();

      const afterTime = new Date().getTime();
      expect(getStartDate()).toBeGreaterThanOrEqual(beforeTime);
      expect(getStartDate()).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('computeTime', () => {
    it('sets session time based on start date', () => {
      setStartDate(new Date().getTime() - 10000); // 10 seconds ago

      globalThis.computeTime();

      expect(globalThis.pipwerks.SCORM.SetSessionTime).toHaveBeenCalled();
      const callArg = globalThis.pipwerks.SCORM.SetSessionTime.mock.calls[0][0];
      expect(callArg).toMatch(/\d{4}:\d{2}:\d{2}/); // Matches SCORM 1.2 time format
    });

    it('handles zero start date', () => {
      setStartDate(0);

      globalThis.computeTime();

      expect(globalThis.pipwerks.SCORM.SetSessionTime).toHaveBeenCalled();
      const callArg = globalThis.pipwerks.SCORM.SetSessionTime.mock.calls[0][0];
      expect(callArg).toBe('0000:00:00.0'); // Zero time
    });

    it('handles an uninitialized start date', () => {
      setStartDate(undefined);

      globalThis.computeTime();

      expect(globalThis.pipwerks.SCORM.SetSessionTime).toHaveBeenCalledWith('0000:00:00.0');
    });

    it('calculates elapsed time correctly', () => {
      // Set startDate to 65 seconds ago (1 min 5 sec)
      setStartDate(new Date().getTime() - 65000);

      globalThis.computeTime();

      expect(globalThis.pipwerks.SCORM.SetSessionTime).toHaveBeenCalled();
      const callArg = globalThis.pipwerks.SCORM.SetSessionTime.mock.calls[0][0];
      // Should be approximately 0000:01:05.XX format
      expect(callArg).toMatch(/0000:01:0[4-6]/); // Allow some variance for test execution time
    });
  });

  describe('doBack', () => {
    it('sets exit to suspend', () => {
      setStartDate(new Date().getTime());

      globalThis.doBack();

      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
    });

    it('computes and saves session time', () => {
      setStartDate(new Date().getTime() - 5000);

      globalThis.doBack();

      expect(globalThis.pipwerks.SCORM.SetSessionTime).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
    });

    it('sets exitPageStatus to true', () => {
      setStartDate(new Date().getTime());

      globalThis.doBack();

      expect(getExitPageStatus()).toBe(true);
    });

    it('calls quit to unload SCO', () => {
      setStartDate(new Date().getTime());

      globalThis.doBack();

      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('marks the SCORM lifecycle as finalized so post-quit events do not commit', () => {
      globalThis.window.__exeScormLifecycleState = { finalized: false, isSCORM: false, registered: true };
      setStartDate(new Date().getTime());

      globalThis.doBack();

      expect(globalThis.window.__exeScormLifecycleState.finalized).toBe(true);
    });
  });

  describe('doContinue', () => {
    it('clears exit status', () => {
      setStartDate(new Date().getTime());

      globalThis.doContinue('completed');

      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('');
    });

    it('sets completion status to completed', () => {
      setStartDate(new Date().getTime());

      globalThis.doContinue('completed');

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('completed');
    });

    it('sets completion status to incomplete', () => {
      setStartDate(new Date().getTime());

      globalThis.doContinue('incomplete');

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('incomplete');
    });

    it('sets success status based on completion', () => {
      setStartDate(new Date().getTime());

      globalThis.doContinue('completed');

      // Note: Due to missing break statement in source, this falls through to default
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).toHaveBeenCalled();
    });

    it('does not change status in review mode', () => {
      globalThis.pipwerks.SCORM.GetMode.mockReturnValue('review');
      setStartDate(new Date().getTime());

      globalThis.doContinue('completed');

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
    });

    it('does not change status in browse mode', () => {
      globalThis.pipwerks.SCORM.GetMode.mockReturnValue('browse');
      setStartDate(new Date().getTime());

      globalThis.doContinue('completed');

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
    });

    it('saves and quits after setting status', () => {
      setStartDate(new Date().getTime());

      globalThis.doContinue('completed');

      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
      expect(getExitPageStatus()).toBe(true);
    });

    it('marks the SCORM lifecycle as finalized so post-quit events do not commit', () => {
      globalThis.window.__exeScormLifecycleState = { finalized: false, isSCORM: false, registered: true };
      setStartDate(new Date().getTime());

      globalThis.doContinue('completed');

      expect(globalThis.window.__exeScormLifecycleState.finalized).toBe(true);
    });
  });

  describe('doQuit', () => {
    it('sets exit to suspend', () => {
      setStartDate(new Date().getTime());

      globalThis.doQuit();

      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
    });

    it('uses an explicit normal exit when provided', () => {
      setStartDate(new Date().getTime());

      globalThis.doQuit('normal');

      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('normal');
    });

    it('computes session time', () => {
      setStartDate(new Date().getTime() - 5000);

      globalThis.doQuit();

      expect(globalThis.pipwerks.SCORM.SetSessionTime).toHaveBeenCalled();
    });

    it('sets exitPageStatus to true', () => {
      setStartDate(new Date().getTime());

      globalThis.doQuit();

      expect(getExitPageStatus()).toBe(true);
    });

    it('saves data and quits', () => {
      setStartDate(new Date().getTime());

      globalThis.doQuit();

      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('marks the SCORM lifecycle as finalized so post-quit events do not commit', () => {
      globalThis.window.__exeScormLifecycleState = { finalized: false, isSCORM: false, registered: true };
      setStartDate(new Date().getTime());

      globalThis.doQuit();

      expect(globalThis.window.__exeScormLifecycleState.finalized).toBe(true);
    });
  });

  describe('unloadPage', () => {
    it('does nothing if exitPageStatus is already true', () => {
      setExitPageStatus(true);

      globalThis.unloadPage();

      expect(globalThis.pipwerks.SCORM.quit).not.toHaveBeenCalled();
    });

    it('sets status to completed if not SCORM and exitPageStatus is false', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');

      globalThis.unloadPage(false);

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('completed');
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).toHaveBeenCalledWith('passed');
    });

    it('sets status to incomplete if isSCORM is true', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');

      globalThis.unloadPage(true);

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('incomplete');
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).toHaveBeenCalledWith('failed');
    });

    it('defaults isSCORM to false when undefined', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');

      globalThis.unloadPage(); // No argument

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('completed');
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).toHaveBeenCalledWith('passed');
    });

    it('does not change status if already passed', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('passed');

      globalThis.unloadPage();

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
    });

    it('does not change status if already failed', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('failed');

      globalThis.unloadPage();

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
    });

    it('does not change status if already completed', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('completed');

      globalThis.unloadPage();

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
    });

    it('exits normally after completing a non-scored page', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');

      globalThis.unloadPage();

      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('normal');
      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('suspends after leaving a scored page incomplete', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');

      globalThis.unloadPage(true);

      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('exits normally when a SCORM 1.2 page already has a terminal status', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('passed');

      globalThis.unloadPage(true);

      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('normal');
    });

    it('does not downgrade a completed SCORM 2004 page when success is still unknown', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.version = '2004';
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('completed');
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');

      globalThis.unloadPage(true);

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('normal');
    });

    it('keeps SCORM 2004 suspended when success is failed but completion is incomplete', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.version = '2004';
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('incomplete');
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('failed');

      globalThis.unloadPage(true);

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
    });
  });

  describe('registerScormLifecycleHandlers (issue #1831)', () => {
    let listeners;
    let fakeWin;
    let fakeDoc;

    beforeEach(() => {
      listeners = {};
      fakeWin = {
        addEventListener: vi.fn((type, cb) => {
          listeners['win:' + type] = cb;
        }),
      };
      fakeDoc = {
        visibilityState: 'visible',
        addEventListener: vi.fn((type, cb) => {
          listeners['doc:' + type] = cb;
        }),
      };
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');
    });

    it('registers pagehide, freeze and visibilitychange instead of the deprecated unload event', () => {
      scoFunctions.registerScormLifecycleHandlers(fakeWin, fakeDoc);

      expect(fakeWin.addEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function), false);
      expect(fakeWin.addEventListener).toHaveBeenCalledWith('freeze', expect.any(Function), false);
      expect(fakeDoc.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function), false);
      expect(fakeWin.addEventListener).not.toHaveBeenCalledWith('unload', expect.anything(), expect.anything());
      expect(fakeWin.addEventListener).not.toHaveBeenCalledWith('beforeunload', expect.anything(), expect.anything());
    });

    it('finalizes the SCORM session exactly once on pagehide', () => {
      scoFunctions.registerScormLifecycleHandlers(fakeWin, fakeDoc);

      listeners['win:pagehide']();
      listeners['win:pagehide'](); // a second pagehide must be a no-op

      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalledTimes(1);
    });

    it('uses the registered isSCORM value when finalizing on pagehide', () => {
      scoFunctions.registerScormLifecycleHandlers(true, fakeWin, fakeDoc);

      listeners['win:pagehide']({ persisted: false });

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('incomplete');
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).toHaveBeenCalledWith('failed');
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalledTimes(1);
    });

    it('commits without quitting when pagehide stores the page in bfcache', () => {
      scoFunctions.registerScormLifecycleHandlers(true, fakeWin, fakeDoc);

      listeners['win:pagehide']({ persisted: true });

      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
    });

    it('commits progress without quitting when the tab becomes hidden', () => {
      scoFunctions.registerScormLifecycleHandlers(fakeWin, fakeDoc);

      fakeDoc.visibilityState = 'hidden';
      listeners['doc:visibilitychange']();

      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).not.toHaveBeenCalled();
    });

    it('does nothing on visibilitychange while the page is still visible', () => {
      scoFunctions.registerScormLifecycleHandlers(fakeWin, fakeDoc);

      fakeDoc.visibilityState = 'visible';
      listeners['doc:visibilitychange']();

      expect(globalThis.pipwerks.SCORM.save).not.toHaveBeenCalled();
    });

    it('commits progress without quitting when the page is frozen', () => {
      scoFunctions.registerScormLifecycleHandlers(fakeWin, fakeDoc);

      listeners['win:freeze']();

      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).not.toHaveBeenCalled();
    });

    it('does not commit again once the session has been finalized', () => {
      scoFunctions.registerScormLifecycleHandlers(fakeWin, fakeDoc);

      listeners['win:pagehide'](); // finalize first
      globalThis.pipwerks.SCORM.save.mockClear();
      fakeDoc.visibilityState = 'hidden';
      listeners['doc:visibilitychange']();

      expect(globalThis.pipwerks.SCORM.save).not.toHaveBeenCalled();
    });

    it('is a safe no-op when addEventListener is unavailable', () => {
      expect(() => scoFunctions.registerScormLifecycleHandlers({}, {})).not.toThrow();
    });
  });

  describe('goBack', () => {
    it('calls pipwerks.nav.goBack', () => {
      globalThis.goBack();

      expect(globalThis.pipwerks.nav.goBack).toHaveBeenCalled();
    });
  });

  describe('goForward', () => {
    it('calls pipwerks.nav.goForward', () => {
      globalThis.goForward();

      expect(globalThis.pipwerks.nav.goForward).toHaveBeenCalled();
    });
  });
});
