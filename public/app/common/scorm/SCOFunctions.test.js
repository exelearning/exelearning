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
    globalThis.pipwerks.SCORM.get = vi.fn(() => ''); // Default: empty suspend_data
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
    it('initializes scorm without changing the activity status when not attempted', () => {
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('not attempted');

      globalThis.loadPage();

      expect(globalThis.pipwerks.SCORM.init).toHaveBeenCalled();
      // Entering the page must not touch completion/success: the iDevice owns them.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
      expect(getExitPageStatus()).toBe(false);
    });

    it('does not change the status while attempting (incomplete)', () => {
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('incomplete');

      globalThis.loadPage();

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
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

    it('marks content-only page completed when leaving a non-scored page', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());

      globalThis.unloadPage(false); // isSCORM=false: no evaluable iDevices

      // Content-only page with no suspend_data should be marked completed at exit.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('completed');
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('does not change completion/success when leaving a scored page', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');

      globalThis.unloadPage(true); // isSCORM=true: page has a scored iDevice

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('does NOT write the page status on exit (the iDevice owns it); only reads it', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      const updateScormPageStatus = vi.fn();
      globalThis.window.$exeExport = { updateScormPageStatus };

      try {
        globalThis.unloadPage(true);

        // Leaving a page must NOT recompute/write the SCO status: writing a page-level status
        // around the lifecycle interferes with the LMS per-attempt score tracking. unloadPage
        // only reads the status the iDevice already set, then closes the session.
        expect(updateScormPageStatus).not.toHaveBeenCalled();
        expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
      } finally {
        delete globalThis.window.$exeExport;
      }
    });

    it('marks a content-only page (no iDevices) completed on exit', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');
      // Default mock returns ''; content-only page has no suspend_data

      globalThis.unloadPage(false); // isSCORM=false: content-only page

      // A content-only page with no suspend_data entries should be marked completed.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('completed');
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('does NOT mark completed if the page has evaluable entries (iDevice results)', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');
      globalThis.pipwerks.SCORM.get.mockReturnValue('1. "Quiz"; Score: 75%;'); // has suspend_data

      globalThis.unloadPage(false); // isSCORM=false but has evaluable entries

      // A page with existing iDevice entries should NOT be forcibly marked completed.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('marks content-only page completed when called without an isSCORM argument', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());

      globalThis.unloadPage(); // No argument: isSCORM defaults to false

      // Content-only page should be marked completed at exit.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('completed');
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('does not mark completed if page is already in a terminal state (passed)', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      // unloadPage's terminal guard reads cmi.core.lesson_status (not GetCompletionStatus) and only
      // marks a content-only page completed when suspend_data is empty AND the status is non-terminal. (#1831)
      globalThis.pipwerks.SCORM.get.mockImplementation((key) =>
        key === 'cmi.core.lesson_status' ? 'passed' : ''
      );

      globalThis.unloadPage(false);

      // Page already in terminal state; should not be overwritten.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
    });

    it('does not mark completed if page is already in a terminal state (failed)', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      // unloadPage's terminal guard reads cmi.core.lesson_status (not GetCompletionStatus). (#1831)
      globalThis.pipwerks.SCORM.get.mockImplementation((key) =>
        key === 'cmi.core.lesson_status' ? 'failed' : ''
      );

      globalThis.unloadPage(false);

      // Page already in terminal state; should not be overwritten.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
    });

    it('does not mark completed if page is already in a terminal state (completed)', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      // unloadPage's terminal guard reads cmi.core.lesson_status (not GetCompletionStatus). (#1831)
      globalThis.pipwerks.SCORM.get.mockImplementation((key) =>
        key === 'cmi.core.lesson_status' ? 'completed' : ''
      );

      globalThis.unloadPage(false);

      // Page already in terminal state; should not be overwritten.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
    });

    it('exits normally and still saves/quits when the page is already completed', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('completed');

      globalThis.unloadPage();

      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('normal');
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

    it('finalizes the session on pagehide without changing the activity status', () => {
      scoFunctions.registerScormLifecycleHandlers(true, fakeWin, fakeDoc);

      listeners['win:pagehide']({ persisted: false });

      // Finalizing the session must not write completion/success — the iDevice owns them.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).not.toHaveBeenCalled();
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
