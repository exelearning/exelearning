/*******************************************************************************
**
** Filename: SCOFunctions.js
**
** File Description: adaptation of SCOFunctions.js file from ADL Technical Team
** SCOFunctions.js works with SCORM12 and SCOFunctions2004.js with SCORM2004
** using SCORM_API_wrapper.js
**
** Adaptation: José Miguel Andonegi jm.andonegi@gmail.com
**
********************************************************************************
**
This software is provided "AS IS," without a warranty of any kind.
ALL EXPRESS OR IMPLIED CONDITIONS, REPRESENTATIONS AND WARRANTIES, INCLUDING
ANY IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE OR
NON-INFRINGEMENT, ARE HEREBY EXCLUDED.  ADL AND ITS LICENSORS SHALL NOT BE LIABLE
FOR ANY DAMAGES SUFFERED BY LICENSEE AS A RESULT OF USING, MODIFYING OR
DISTRIBUTING THE SOFTWARE OR ITS DERIVATIVES.  IN NO EVENT WILL ADL OR ITS LICENSORS
BE LIABLE FOR ANY LOST REVENUE, PROFIT OR DATA, OR FOR DIRECT, INDIRECT, SPECIAL,
CONSEQUENTIAL, INCIDENTAL OR PUNITIVE DAMAGES, HOWEVER CAUSED AND REGARDLESS OF THE
THEORY OF LIABILITY, ARISING OUT OF THE USE OF OR INABILITY TO USE SOFTWARE, EVEN IF
ADL HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
*****************************************************************************
SCOFunctions2004.js code is licensed under the Creative Commons
Attribution-ShareAlike 3.0 Unported License.
To view a copy of this license:
     - Visit http://creativecommons.org/licenses/by-sa/3.0/
     - Or send a letter to
            Creative Commons, 444 Castro Street,  Suite 900, Mountain View,
            California, 94041, USA.
The following is a summary of the full license which is available at:
      - http://creativecommons.org/licenses/by-sa/3.0/legalcode
*****************************************************************************
Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)
You are free to:
     - Share : to copy, distribute and transmit the work
     - Remix : to adapt the work
Under the following conditions:
     - Attribution: You must attribute the work in the manner specified by
       the author or licensor (but not in any way that suggests that they
       endorse you or your use of the work).
     - Share Alike: If you alter, transform, or build upon this work, you
       may distribute the resulting work only under the same or similar
       license to this one.
With the understanding that:
     - Waiver: Any of the above conditions can be waived if you get permission
       from the copyright holder.
     - Public Domain: Where the work or any of its elements is in the public
       domain under applicable law, that status is in no way affected by the license.
     - Other Rights: In no way are any of the following rights affected by the license:
           * Your fair dealing or fair use rights, or other applicable copyright
             exceptions and limitations;
           * The author's moral rights;
           * Rights other persons may have either in the work itself or in how the
             work is used, such as publicity or privacy rights.
     - Notice: For any reuse or distribution, you must make clear to others the
               license terms of this work.
****************************************************************************/
var startDate;
var exitPageStatus;
var pageLoaded = false;

// creating shortcut for less verbose code
var scorm = pipwerks.SCORM;

// Test helpers for accessing internal state
function _getStartDate() { return startDate; }
function _setStartDate(value) { startDate = value; }
function _getExitPageStatus() { return exitPageStatus; }
function _setExitPageStatus(value) { exitPageStatus = value; }
function _getPageLoaded() { return pageLoaded; }
function _setPageLoaded(value) { pageLoaded = value; }
function _resetScormLifecycleState(win) {
  win = win || (typeof window !== "undefined" ? window : undefined);
  if (win && win.__exeScormLifecycleState) {
    delete win.__exeScormLifecycleState;
  }
}

// Marks the SCO as finalized so any post-quit lifecycle event (visibilitychange,
// freeze) does not call LMSCommit on a terminated session.
function _markScormFinalized(win) {
  win = win || (typeof window !== "undefined" ? window : undefined);
  if (win && win.__exeScormLifecycleState) {
    win.__exeScormLifecycleState.finalized = true;
  }
}

// Reach the shared suspend_data helpers in common.js, which owns that format (parseSuspendData /
// getActivityState / hasAttemptedActivity). Returns null when common.js is not loaded, and every
// caller then falls back to the pre-existing behaviour rather than reimplementing the parser here.
function _scormActivityHelpers(win) {
  win = win || (typeof window !== "undefined" ? window : undefined);
  var devices = win ? win.$exeDevices : undefined;
  if (!devices || !devices.iDevice || !devices.iDevice.gamification) {
    return null;
  }
  return devices.iDevice.gamification.scorm || null;
}

// Per-iDevice state stored in cmi.suspend_data, or {} when it cannot be read.
function _readActivityState(win) {
  var helpers = _scormActivityHelpers(win);
  if (!helpers || typeof helpers.readActivityState != "function") {
    return {};
  }
  return helpers.readActivityState() || {};
}

// Has the learner interacted with any evaluable iDevice on this page? Falls back to true (today's
// behaviour: finalize the session) when the helper is unavailable, so a missing common.js can never
// silently strand an attempt the learner did make.
function _hasAttemptedActivity(lmsData, win) {
  var helpers = _scormActivityHelpers(win);
  if (!helpers || typeof helpers.hasAttemptedActivity != "function") {
    return true;
  }
  return helpers.hasAttemptedActivity(lmsData) === true;
}

// Does the page carry evaluable SCORM iDevices? Three independent signals, because getting this
// wrong writes a page status that the learner never earned:
//   - isSCORM: the DOM scan in exe_export.js. It runs on a timer, so it can still be false when
//     the learner leaves quickly.
//   - parsed suspend_data entries: registerActivity inscribes every evaluable iDevice on load.
//   - raw suspend_data: the pre-existing signal, kept as the answer when common.js (and with it
//     the parser) is not loaded. Any tracking data at all means this is not a content-only page.
function _pageHasEvaluableIdevices(isSCORM, lmsData) {
  if (isSCORM === true) {
    return true;
  }
  if (lmsData && Object.keys(lmsData).length > 0) {
    return true;
  }
  var suspendData = pipwerks.SCORM.get("cmi.suspend_data") || "";
  return suspendData.trim() !== "";
}

// Has every evaluable iDevice on the page been finished? This is what decides whether the SCO
// closes as resumable, and it must be read from the per-iDevice states rather than from the SCO
// status, which now carries a live pass/fail verdict and says nothing about progress. Falls back
// to the status only when common.js is unavailable and there is nothing better to go on.
function _isPageFinished(lmsData, win) {
  var helpers = _scormActivityHelpers(win);
  if (helpers && typeof helpers.getActivityState == "function") {
    return helpers.getActivityState(lmsData) === 2;
  }
  var completionStatus = scorm.GetCompletionStatus();
  var successStatus = scorm.GetSuccessStatus();
  if (scorm.version == "2004") {
    return completionStatus == "completed";
  }
  return successStatus == "passed" || successStatus == "failed" || successStatus == "completed";
}

// isSCORM as recorded by registerScormLifecycleHandlers, for callers that pass no argument.
function _getRegisteredIsScorm(win) {
  win = win || (typeof window !== "undefined" ? window : undefined);
  return !!(win && win.__exeScormLifecycleState && win.__exeScormLifecycleState.isSCORM);
}

/**
 * Pin the SCORM version the package was exported for, before any API discovery.
 *
 * pipwerks auto-detects by probing the window tree and PREFERS API_1484_11, so a
 * SCORM 1.2 package launched in a window that also exposes a 2004 API bound the
 * wrong generation and spoke Initialize/Terminate to it — the 1.2 API was never
 * called. The exporters stamp the version on the body (`exe-scorm12` /
 * `exe-scorm2004`), so read it from there. Idempotent and safe to call twice.
 */
function pinScormVersionFromPage(doc) {
  doc = doc || (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.body || !scorm || scorm.version) {
    return scorm ? scorm.version : null;
  }
  var classes = doc.body.className || '';
  if (classes.indexOf('exe-scorm12') !== -1) {
    scorm.version = '1.2';
  } else if (classes.indexOf('exe-scorm2004') !== -1) {
    scorm.version = '2004';
  }
  return scorm.version;
}

/**
 *
 */
function loadPage() {
  if (pageLoaded) {
    return true;
  }

  pinScormVersionFromPage();

  var result = scorm.init();
  if (!result) {
    return result;
  }

  // Entering a page must NOT change the activity status. completion/success are
  // owned by the iDevice and only change through learner interaction (sendScore
  // -> showFinalScore). loadPage only opens and times the session.

  exitPageStatus = false;
  pageLoaded = true;
  startTimer();
  return result;
}

/**
 *
 */
function startTimer() {
  startDate = new Date().getTime();
}

/**
 *
 */
function computeTime() {
  if (startDate != null && startDate != 0) {
    var currentDate = new Date().getTime();
    var elapsedMiliSeconds = (currentDate - startDate);
    var formattedTime = pipwerks.UTILS.convertTotalMiliSeconds(elapsedMiliSeconds);
  }
  else {
    formattedTime = pipwerks.UTILS.convertTotalMiliSeconds(0);
  }

  scorm.SetSessionTime(formattedTime);
}

/**
 *
 */
function doBack() {
  scorm.SetExit("suspend");

  computeTime();
  exitPageStatus = true;

  var result = scorm.save();
  // NOTE: LMSFinish will unload the current SCO.  All processing
  //       relative to the current page must be performed prior to calling LMSFinish.
  result = scorm.quit();
  pageLoaded = false;
  _markScormFinalized();
}

/**
 *
 */
function doQuit(exitStatus) {
  if (typeof exitStatus == "undefined") {
    exitStatus = "suspend";
  }
  scorm.SetExit(exitStatus);

  computeTime();
  exitPageStatus = true;

  var result = scorm.save();
  // NOTE: LMSFinish will unload the current SCO.  All processing
  //       relative to the current page must be performed prior to calling LMSFinish.
  result = scorm.quit();
  pageLoaded = false;
  _markScormFinalized();
}

/*******************************************************************************
** The purpose of this function is to handle cases where the current SCO may be
** unloaded via some user action other than using the navigation controls
** embedded in the content.   This function will be called every time an SCO
** is unloaded.  If the user has caused the page to be unloaded through the
** preferred SCO control mechanisms, the value of the "exitPageStatus" var
** will be true so we'll just allow the page to be unloaded.   If the value
** of "exitPageStatus" is false, we know the user caused to the page to be
** unloaded through use of some other mechanism... most likely the back
** button on the browser.  We'll handle this situation the same way we
** would handle a "quit" - as in the user pressing the SCO's quit button.
**
** New eXeLearning: LEAVING A PAGE NEVER WRITES ITS STATUS. Completion and success
** are owned by the learner's interaction with the SCORM iDevices; this function only
** decides how (and whether) to close the session. Three cases:
**
**   1. Content-only page (no evaluable iDevice): marked "completed" on the way out, so
**      a course made of content pages can still complete. This is the one status write
**      left here and it is deliberate.
**   2. Page with SCORM iDevices the learner never touched: the session is still closed,
**      but "incomplete" is written first. THE SESSION MUST ALWAYS BE CLOSED: SCORM
**      requires a SCO to terminate before the next one initializes, and leaving it open
**      makes the next SCO's LMSInitialize fail with error 101. After that the wrapper
**      never sets connection.isActive, so every LMSSetValue/LMSGetValue/LMSCommit is
**      silently dropped and the WHOLE package stops saving from that page on. And since
**      LMSFinish makes Moodle promote a SCO still in "not attempted" to "completed"
**      (mod/scorm/datamodels/scorm_12.js:621-634), writing "incomplete" on the way out is
**      what stops a page the learner never did from being reported as done. It is the one
**      status write left for scored pages, it happens only on exit and only when there was
**      no interaction at all — entering a page still writes nothing.
**   3. Page with SCORM iDevices the learner did touch: closed as before, reading the
**      status the iDevice already wrote (read-only) to pick the resume mode.
**
** @param {boolean} [isSCORM] - true when the page carries evaluable SCORM iDevices.
**                              Omitted (pipwerks.nav.goBack/goForward), it is read back
**                              from the registered lifecycle state.
** @param {Window} [win] - window holding the shared helpers (defaults to window). The lifecycle
**                         handlers pass the window they were registered against.
*******************************************************************************/
function unloadPage(isSCORM, win) {
  if (typeof isSCORM != "boolean") {
    isSCORM = _getRegisteredIsScorm(win);
  }
  if (exitPageStatus == true) {
    return;
  }

  var lmsData = _readActivityState(win);

  if (!_pageHasEvaluableIdevices(isSCORM, lmsData)) {
    // Read through GetCompletionStatus, which maps to cmi.core.lesson_status in 1.2 and
    // cmi.completion_status in 2004. Reading the 1.2 key directly made this guard always miss
    // on 2004 and rewrite a page that was already finished.
    var status = scorm.GetCompletionStatus();
    var isTerminal = status === "passed" || status === "failed" || status === "completed";
    if (!isTerminal) {
      pipwerks.SCORM.SetCompletionStatus("completed");
    }
    doQuit("normal");
    return;
  }

  if (!_hasAttemptedActivity(lmsData, win)) {
    pipwerks.SCORM.SetCompletionStatus("incomplete");
    doQuit("suspend");
    return;
  }

  // A finished SCO exits "normal" (no resume); anything else stays resumable ("suspend").
  //
  // Resumability must follow whether the ACTIVITY is finished, never the pass/fail verdict. The
  // status reports the score as it stands, so a page reads "passed" from the first good answer;
  // deriving resumability from it closed the attempt as "normal" while the learner was still
  // working, and on re-entry the LMS starts from scratch instead of resuming — the stored
  // progress is lost. The per-iDevice states in suspend_data are the only honest answer: the page
  // is finished when every evaluable iDevice reached state 2. (#1831)
  doQuit(_isPageFinished(lmsData, win) ? "normal" : "suspend");
  // NOTE: don't return anything that resembles a javascript
  //       string from this function or IE will take the liberty of displaying a confirm message box.
}

/*******************************************************************************
** Issue #1831: the SCO used to finalize on the body `onunload`/`onbeforeunload`
** attribute. Chrome is deprecating the `unload` event and blocks it entirely
** under a restrictive Permissions Policy (e.g. SCORM packages running inside a
** Moodle iframe), which prevented LMSFinish from running and lost scores.
**
** We instead register modern lifecycle handlers:
**  - `pagehide`        -> finalize the session once when the page is really
**                         being discarded. If the page enters bfcache
**                         (`event.persisted`), commit only and keep the SCORM
**                         session open.
**  - `visibilitychange`-> when the tab becomes hidden, commit progress only
**                         (no quit), so switching tabs does not terminate the
**                         session prematurely while still persisting data if
**                         `pagehide` is never delivered.
**  - `freeze`          -> commit progress before Chromium freezes the page.
** unloadPage(isSCORM) is still called at most once.
**
** @param {boolean} [isSCORM] - true when the page contains a scored iDevice.
** @param {Window} [win]  - target for pagehide (defaults to window)
** @param {Document} [doc] - target for visibilitychange (defaults to document)
*******************************************************************************/
function registerScormLifecycleHandlers(isSCORM, win, doc) {
  if (typeof isSCORM != "boolean") {
    doc = win;
    win = isSCORM;
    isSCORM = undefined;
  }

  win = win || (typeof window !== "undefined" ? window : undefined);
  doc = doc || (typeof document !== "undefined" ? document : undefined);
  if (!win || typeof win.addEventListener != "function") {
    return;
  }

  if (!win.__exeScormLifecycleState) {
    win.__exeScormLifecycleState = {
      finalized: false,
      isSCORM: false,
      registered: false
    };
  }

  var state = win.__exeScormLifecycleState;

  if (typeof isSCORM == "boolean") {
    state.isSCORM = isSCORM;
  }

  if (state.registered) {
    return;
  }

  state.registered = true;

  function commitProgress() {
    if (state.finalized) {
      return;
    }
    // Nothing to persist on a page the learner never started an activity in: switching tabs or
    // letting the browser freeze the page is not an interaction, and committing would create LMS
    // tracking for it mid-visit. Such a page is recorded once, on the way out, by unloadPage.
    // Content-only pages are exempt from this gate and keep committing their session time.
    var lmsData = _readActivityState(win);
    if (_pageHasEvaluableIdevices(state.isSCORM, lmsData) && !_hasAttemptedActivity(lmsData, win)) {
      return;
    }
    computeTime();
    if (typeof scorm.save == "function") {
      scorm.save();
    }
  }

  function finalizeOnce(event) {
    if (event && event.persisted) {
      commitProgress();
      return;
    }
    if (state.finalized) {
      return;
    }
    state.finalized = true;
    unloadPage(state.isSCORM, win);
  }

  win.addEventListener("pagehide", finalizeOnce, false);
  win.addEventListener("freeze", commitProgress, false);

  if (doc && typeof doc.addEventListener == "function") {
    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState == "hidden") {
        commitProgress();
      }
    }, false);
  }
}

// Auto-register on real browsers; tests invoke registerScormLifecycleHandlers() directly.
if (typeof window !== "undefined" && typeof window.addEventListener == "function") {
  registerScormLifecycleHandlers();
}

/**
 *
 */
function goBack() {
  pipwerks.nav.goBack();
}

/**
 *
 */
function goForward() {
  pipwerks.nav.goForward();
}

// Export for Node.js/CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadPage,
        startTimer,
        computeTime,
        doBack,
        doQuit,
        unloadPage,
        pinScormVersionFromPage,
        registerScormLifecycleHandlers,
        goBack,
        goForward,
        // Test helpers for internal state access
        _getStartDate,
        _setStartDate,
        _getExitPageStatus,
        _setExitPageStatus,
        _getPageLoaded,
        _setPageLoaded,
        _resetScormLifecycleState,
        _markScormFinalized,
    };
}
