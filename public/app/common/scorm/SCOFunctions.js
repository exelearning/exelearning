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

/**
 *
 */
function loadPage() {
  if (pageLoaded) {
    return true;
  }

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
 * @param {*} status
 */
function doContinue(status) {
  // Reinitialize Exit to blank
  scorm.SetExit("");

  var mode = scorm.GetMode();

  if (mode != "review" && mode != "browse") {
    scorm.SetCompletionStatus(status);
    var sucess_status;
    switch (status) {
      case "completed":
        sucess_status = "passed";
      case "incomplete":
        sucess_status = "failed"
      default:
        sucess_status = status
    }
    scorm.SetSuccessStatus(sucess_status);
  }

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
** eXe team: we've added this doLMSSetValue here to get tracking working with Moodle
** cmi.core.lesson_status is now set to 'completed' whenever a sco is unloaded.
** brent simpson. July 7, 2005. exe@auckland.ac.nz
**
**
** New eXeLearning: we add a new parameter (isScorm) with a default value (false)
** In 'normal' pages, the status is set to completed but
** if the page has a SCORM Quizz and the quizz has not been answered,
** the status is set to incomplete.
** José Miguel Andonegi November 17
**
*******************************************************************************/
function unloadPage(isSCORM) {
  if (typeof isSCORM == "undefined") {
    isSCORM = false;
  }
  if (exitPageStatus != true) {
    // Leaving a page must NOT change completion/success: those are owned by the
    // iDevice and only change through learner interaction. Here we only read the
    // status the iDevice already set (read-only) to pick the resume mode, then
    // close the session. A finished SCO exits "normal" (no resume); anything else
    // stays resumable ("suspend"). In SCORM12 completion+success share lesson_status.
    var completionStatus = scorm.GetCompletionStatus();
    var successStatus = scorm.GetSuccessStatus();
    var isScorm2004 = scorm.version == "2004";
    var isCompleted = isScorm2004
      ? completionStatus == "completed"
      : successStatus == "passed" || successStatus == "failed" || successStatus == "completed";
    doQuit(isCompleted ? "normal" : "suspend");
  }
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
    unloadPage(state.isSCORM);
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
        doContinue,
        doQuit,
        unloadPage,
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
