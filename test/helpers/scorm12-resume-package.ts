/**
 * Builds a compact SCORM 1.2 package that reproduces the iDevice-ready vs
 * loadPage() race: a quiz registers on DOMContentLoaded (before body onload),
 * then the runtime's loadPage() restores cmi.suspend_data. The LMS seed is
 * `cmi.core.score.raw=80` plus an `exe12/` payload, and the SCO must not
 * overwrite that score with `0`.
 *
 * Used as a fixture for unit/integration tests, the Playwright SCO harness,
 * and Moodle verification. The package is built in memory on demand; no zip
 * is ever stored in the repository.
 *
 * The build is deterministic: the same runtime sources always produce the
 * same bytes, whatever the wall clock or time zone of the machine that runs
 * it, so a build can be pinned by hash and only changes when the runtime
 * does.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { zipSync } from 'fflate';
import { buildScorm12RuntimeFiles, SCORM12_RUNTIME_SOURCE_PATHS } from '../../src/shared/export/utils/Scorm12Runtime';

/** Filename used when a test needs the package on disk. */
export const SCORM12_RESUME_FIXTURE_NAME = 'resume-race.scorm.zip';

/** Activity id the fixture SCO registers. */
export const RESUME_RACE_ACTIVITY_ID = 'quiz-1';

const IMSMANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.exelearning.resume-race" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-RESUME">
    <organization identifier="ORG-RESUME">
      <title>Resume race</title>
      <item identifier="ITEM-1" identifierref="RES-SCO">
        <title>Quiz page</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-SCO" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="libs/SCORM_API_wrapper.js"/>
      <file href="libs/SCOFunctions.js"/>
    </resource>
  </resources>
</manifest>
`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Resume race</title>
  <script src="libs/SCORM_API_wrapper.js"></script>
  <script src="libs/SCOFunctions.js"></script>
</head>
<body class="exe-scorm exe-scorm12" onload="loadPage();updateScoreDisplay()">
  <h1>Resume race</h1>
  <p>Score: <span id="score-display">—</span></p>
  <button type="button" id="submit-score">Submit 80</button>
  <script>
  (function () {
    function updateScoreDisplay() {
      if (!window.scorm || !window.scorm.GetScoreRaw) {
        return;
      }
      var raw = window.scorm.GetScoreRaw();
      document.getElementById('score-display').textContent = raw === '' ? '—' : raw;
    }
    window.updateScoreDisplay = updateScoreDisplay;

    function registerLikeAGame() {
      if (!window.scorm || !window.exeScorm12) {
        return;
      }
      // Game iDevices call scorm.init() from jQuery ready, before body onload.
      window.scorm.init();
      window.exeScorm12.activities.register('${RESUME_RACE_ACTIVITY_ID}', {
        evaluable: true,
        completionRequired: true,
        legacyIndex: 1
      });
      var policy = window.exeScorm12.policy;
      var summary = window.exeScorm12.activities.summary();
      var score = summary.score === null ? 0 : summary.score;
      if (!policy.hasAppliedEntry || policy.hasAppliedEntry()) {
        policy.setScoreDetailed(score, 0, 100);
        policy.recordActivityOutcome();
      }
      updateScoreDisplay();
    }

    document.addEventListener('DOMContentLoaded', registerLikeAGame);

    document.getElementById('submit-score').addEventListener('click', function () {
      // Leave the activity incomplete so the LMS suspends the attempt.
      window.exeScorm12.activities.update('${RESUME_RACE_ACTIVITY_ID}', {
        completed: false,
        score: 80
      });
      window.exeScorm12.policy.setScoreDetailed(80, 0, 100);
      window.exeScorm12.policy.recordActivityOutcome();
      window.exeScorm12.policy.persistActivities();
      window.exeScorm12.client.commit();
      updateScoreDisplay();
    });
  })();
  </script>
</body>
</html>
`;

/** Deflate level for every entry, pinned so the bytes never depend on a library default. */
const FIXTURE_ZIP_LEVEL = 6;

/**
 * Modification time stamped on every ZIP entry.
 *
 * ZIP entries carry a DOS timestamp that fflate derives from the *local* date
 * components of the given Date. Building the value from local components at
 * call time (instead of a fixed UTC instant) therefore yields the same bytes
 * in every time zone. Noon keeps clear of DST transitions.
 */
function fixtureEntryMtime(): Date {
    return new Date(2026, 0, 1, 12, 0, 0);
}

function asBytes(content: Uint8Array | string): Uint8Array {
    return typeof content === 'string' ? new TextEncoder().encode(content) : content;
}

/**
 * Assemble a SCORM 1.2 zip from the current runtime sources.
 *
 * No eXeLearning version is passed to the runtime assembler on purpose: the
 * stamp then reads `unknown`, so the fixture bytes depend only on the runtime
 * sources and not on the package.json version of the tree that regenerated it.
 *
 * @returns The package bytes; identical for identical runtime sources.
 */
export function buildResumeRaceScorm12Package(): Uint8Array {
    const scormDir = path.join(process.cwd(), 'public', 'app', 'common', 'scorm');
    const sources = new Map<string, Uint8Array>();
    for (const relative of SCORM12_RUNTIME_SOURCE_PATHS) {
        sources.set(relative, fs.readFileSync(path.join(scormDir, relative)));
    }
    const runtime = buildScorm12RuntimeFiles(sources);
    const wrapper = runtime.get('SCORM_API_wrapper.js');
    const scoFunctions = runtime.get('SCOFunctions.js');
    if (wrapper === undefined || scoFunctions === undefined) {
        throw new Error('SCORM 1.2 runtime assembly did not produce the package files');
    }

    // Entry order is the insertion order below; keep it stable.
    return zipSync(
        {
            'imsmanifest.xml': asBytes(IMSMANIFEST),
            'index.html': asBytes(INDEX_HTML),
            'libs/SCORM_API_wrapper.js': asBytes(wrapper),
            'libs/SCOFunctions.js': asBytes(scoFunctions),
        },
        { level: FIXTURE_ZIP_LEVEL, mtime: fixtureEntryMtime() },
    );
}
