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
globalThis.doQuit = scoFunctions.doQuit;
globalThis.unloadPage = scoFunctions.unloadPage;
globalThis.pinScormVersionFromPage = scoFunctions.pinScormVersionFromPage;
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

  describe('pinScormVersionFromPage', () => {
    afterEach(() => {
      document.body.className = '';
      globalThis.pipwerks.SCORM.version = null;
    });

    // pipwerks auto-detection prefers API_1484_11, so a 1.2 package launched in a
    // host exposing both API generations bound the 2004 one and spoke
    // Initialize/Terminate to it. The exported body carries the version.
    it('pins 1.2 from the exported body class', () => {
      globalThis.pipwerks.SCORM.version = null;
      document.body.className = 'exe-export exe-scorm exe-scorm12';

      expect(globalThis.pinScormVersionFromPage()).toBe('1.2');
      expect(globalThis.pipwerks.SCORM.version).toBe('1.2');
    });

    it('pins 2004 from the exported body class', () => {
      globalThis.pipwerks.SCORM.version = null;
      document.body.className = 'exe-export exe-scorm exe-scorm2004';

      expect(globalThis.pinScormVersionFromPage()).toBe('2004');
    });

    it('never overrides a version already established', () => {
      globalThis.pipwerks.SCORM.version = '2004';
      document.body.className = 'exe-export exe-scorm exe-scorm12';

      globalThis.pinScormVersionFromPage();

      expect(globalThis.pipwerks.SCORM.version).toBe('2004');
    });

    it('leaves auto-detection alone on a page without the marker', () => {
      globalThis.pipwerks.SCORM.version = null;
      document.body.className = 'exe-export exe-web-site';

      globalThis.pinScormVersionFromPage();

      expect(globalThis.pipwerks.SCORM.version).toBeNull();
    });
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
      expect(callArg).toBe('0000:00:00.00'); // Zero time, hundredths zero-padded
    });

    it('handles an uninitialized start date', () => {
      setStartDate(undefined);

      globalThis.computeTime();

      expect(globalThis.pipwerks.SCORM.SetSessionTime).toHaveBeenCalledWith('0000:00:00.00');
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
      // unloadPage's terminal guard reads the status through GetCompletionStatus, which maps to
      // cmi.core.lesson_status in 1.2 and cmi.completion_status in 2004, and only marks a
      // content-only page completed when it has no evaluable entries AND is non-terminal. (#1831)
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('passed');

      globalThis.unloadPage(false);

      // Page already in terminal state; should not be overwritten.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
    });

    it('does not mark completed if page is already in a terminal state (failed)', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      // The guard reads through GetCompletionStatus so it works in both SCORM profiles. (#1831)
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('failed');

      globalThis.unloadPage(false);

      // Page already in terminal state; should not be overwritten.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
    });

    it('does not mark completed if page is already in a terminal state (completed)', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      // The guard reads through GetCompletionStatus so it works in both SCORM profiles. (#1831)
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('completed');

      globalThis.unloadPage(false);

      // Page already in terminal state; should not be overwritten.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
    });

    it('does not re-mark a completed SCORM 2004 content-only page', () => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.version = '2004';
      // In 2004 the status lives in cmi.completion_status. Reading the 1.2 key directly made the
      // terminal guard always miss here and rewrite a page that was already finished. (#1831)
      globalThis.pipwerks.SCORM.GetCompletionStatus.mockReturnValue('completed');

      globalThis.unloadPage(false);

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
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

  // Leaving a page never writes the status of an activity the learner used. The one status write
  // left here is for a page whose SCORM iDevices were never started: it is recorded as
  // "incomplete" on the way out, because LMSFinish makes Moodle promote a SCO still in
  // "not attempted" to "completed" and a page the learner never did must not read as done. (#1831)
  describe('unloadPage / learner interaction gate', () => {
    // suspend_data as registerActivity leaves it on load: every evaluable iDevice inscribed
    // with state 0. States 1 (started) and 2 (finished) only ever come from a learner action.
    function stubActivityState(lmsData) {
      globalThis.window.$exeDevices = {
        iDevice: {
          gamification: {
            scorm: {
              readActivityState: () => lmsData,
              hasAttemptedActivity: (data) =>
                Object.keys(data || lmsData).some((key) => {
                  const state = (data || lmsData)[key].state;
                  return state === 1 || state === 2;
                }),
            },
          },
        },
      };
    }

    beforeEach(() => {
      setExitPageStatus(false);
      setStartDate(new Date().getTime());
      globalThis.pipwerks.SCORM.get.mockReturnValue('1. "Quiz"; Score: 0%; Weight: 100%; Estado: 0');
    });

    afterEach(() => {
      delete globalThis.window.$exeDevices;
    });

    it('records an untouched SCORM page as incomplete and still closes the session', () => {
      stubActivityState({ 1: { state: 0 }, 2: { state: 0 } });

      globalThis.unloadPage(true);

      // "incomplete" is written for one reason only: LMSFinish makes Moodle promote a SCO
      // still in "not attempted" to "completed", and a page the learner never did must not
      // be reported as done.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('incomplete');
      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
      // The session MUST close: an open one makes the next SCO's LMSInitialize fail with 101,
      // after which every write in the rest of the package is silently dropped.
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('closes a started page as resumable without touching its status', () => {
      stubActivityState({ 1: { state: 1 }, 2: { state: 0 } });

      globalThis.unloadPage(true);

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    it('closes a finished page as non-resumable without touching its status', () => {
      stubActivityState({ 1: { state: 2 } });
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('passed');

      globalThis.unloadPage(true);

      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('normal');
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });

    // The DOM scan in exe_export.js runs on a timer, so isSCORM can still be false when the
    // learner leaves quickly. The suspend_data entries are the independent second signal.
    it('recognises a SCORM page from its suspend_data entries when isSCORM is false', () => {
      stubActivityState({ 1: { state: 0 } });

      globalThis.unloadPage(false);

      // Treated as a scored page the learner never started, not as content-only: it must not
      // be marked completed.
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('incomplete');
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
    });

    // pipwerks.nav.goBack/goForward call unloadPage() with no argument. Defaulting to false
    // treated a SCORM page as content-only and wrote "completed" on every in-SCO navigation.
    it('falls back to the registered isSCORM when called with no argument', () => {
      stubActivityState({});
      globalThis.pipwerks.SCORM.get.mockReturnValue('');
      globalThis.window.__exeScormLifecycleState = { finalized: false, isSCORM: true, registered: true };

      globalThis.unloadPage();

      // Handled as a scored page: incomplete, not the content-only "completed".
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('incomplete');
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).not.toHaveBeenCalledWith('completed');
    });

    // Losing the helpers must never strand an attempt the learner did make: without common.js
    // we cannot tell, so we finalize as before rather than silently skipping LMSFinish.
    it('finalizes as before when the shared helpers are unavailable', () => {
      globalThis.unloadPage(true);

      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
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

    describe('untouched SCORM page', () => {
      beforeEach(() => {
        // registerActivity inscribed the iDevice on load; the learner never started it.
        fakeWin.$exeDevices = {
          iDevice: {
            gamification: {
              scorm: {
                readActivityState: () => ({ 1: { state: 0 } }),
                hasAttemptedActivity: () => false,
              },
            },
          },
        };
      });

      it('does not commit when the tab is hidden', () => {
        scoFunctions.registerScormLifecycleHandlers(true, fakeWin, fakeDoc);

        fakeDoc.visibilityState = 'hidden';
        listeners['doc:visibilitychange']();

        // Switching tabs is not an interaction: committing would create LMS tracking mid-visit
        // for a page the learner never started. It is recorded once, on the way out.
        expect(globalThis.pipwerks.SCORM.save).not.toHaveBeenCalled();
        expect(globalThis.pipwerks.SCORM.SetSessionTime).not.toHaveBeenCalled();
      });

      it('does not commit when the page is frozen', () => {
        scoFunctions.registerScormLifecycleHandlers(true, fakeWin, fakeDoc);

        listeners['win:freeze']();

        expect(globalThis.pipwerks.SCORM.save).not.toHaveBeenCalled();
      });

      it('does not commit when pagehide stores the page in bfcache', () => {
        scoFunctions.registerScormLifecycleHandlers(true, fakeWin, fakeDoc);

        listeners['win:pagehide']({ persisted: true });

        expect(globalThis.pipwerks.SCORM.save).not.toHaveBeenCalled();
        expect(globalThis.pipwerks.SCORM.quit).not.toHaveBeenCalled();
      });

      // The session always closes on a real pagehide, whatever the learner did: leaving it open
      // makes the next SCO's LMSInitialize fail with 101 and the package stops saving. (#1831)
      it('still finalizes the session on a real pagehide, recording incomplete', () => {
        scoFunctions.registerScormLifecycleHandlers(true, fakeWin, fakeDoc);

        listeners['win:pagehide']({ persisted: false });

        expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('incomplete');
        expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
      });
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
