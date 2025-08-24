(function () {
  var STORAGE_KEY = 'exeTeacherMode';
  var root = document.documentElement;

  function isEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setEnabled(on) {
    try {
      if (on) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function applyState(on) {
    if (on) root.classList.add('mode-teacher');
    else root.classList.remove('mode-teacher');

    var btn = document.getElementById('teacher-mode-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var label = btn.querySelector('.teacher-mode-toggle-label');
      if (label) {
        // Basic i18n via data attributes if present; fallback texts
        var studentText = btn.getAttribute('data-label-student') || 'Student mode';
        var teacherText = btn.getAttribute('data-label-teacher') || 'Teacher mode';
        label.textContent = on ? teacherText : studentText;
      }
      btn.title = on ? (btn.getAttribute('data-title-on') || 'Teacher mode') : (btn.getAttribute('data-title-off') || 'Student mode');
    }
  }

  function toggle() {
    var on = !isEnabled();
    setEnabled(on);
    applyState(on);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    // Apply initial state
    applyState(isEnabled());

    // Wire toggle
    var btn = document.getElementById('teacher-mode-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  });
})();

