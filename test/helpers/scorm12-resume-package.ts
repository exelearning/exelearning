/**
 * Builds a compact SCORM 1.2 package that reproduces the iDevice-ready vs
 * loadPage() race: a quiz registers on DOMContentLoaded (before body onload),
 * then the runtime's loadPage() restores cmi.suspend_data.
 *
 * Used as a fixture for unit/integration tests, the Playwright SCO harness,
 * and Moodle verification.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { zipSync } from '../../src/shared/export';
import { buildScorm12RuntimeFiles, SCORM12_RUNTIME_SOURCE_PATHS } from '../../src/shared/export/utils/Scorm12Runtime';

/** Directory the generated zip is written to for Moodle / manual inspection. */
export const SCORM12_RESUME_FIXTURE_DIR = path.join(process.cwd(), 'test', 'fixtures', 'scorm12');

/** Filename of the generated package. */
export const SCORM12_RESUME_FIXTURE_NAME = 'resume-race.scorm.zip';

export const SCORM12_RESUME_FIXTURE_PATH = path.join(SCORM12_RESUME_FIXTURE_DIR, SCORM12_RESUME_FIXTURE_NAME);

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

function asBytes(content: Uint8Array | string): Uint8Array {
    return typeof content === 'string' ? new TextEncoder().encode(content) : content;
}

/**
 * Assemble a SCORM 1.2 zip from the current runtime sources.
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

    return zipSync({
        'imsmanifest.xml': IMSMANIFEST,
        'index.html': INDEX_HTML,
        'libs/SCORM_API_wrapper.js': asBytes(wrapper),
        'libs/SCOFunctions.js': asBytes(scoFunctions),
    });
}

/**
 * Write the package to test/fixtures/scorm12/resume-race.scorm.zip.
 *
 * @returns Absolute path of the written zip.
 */
export function writeResumeRaceScorm12Fixture(): string {
    fs.mkdirSync(SCORM12_RESUME_FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(SCORM12_RESUME_FIXTURE_PATH, buildResumeRaceScorm12Package());
    return SCORM12_RESUME_FIXTURE_PATH;
}
