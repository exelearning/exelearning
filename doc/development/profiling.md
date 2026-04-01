# Profiling and Timing Investigation

This guide documents the internal profiling helpers currently available for export and save flows in the Electron desktop app.

These flags are intended for development and debugging. They are not part of the end-user UI.

## Prerequisites

Run the desktop app:

```bash
make run-app
```

Open the project in Electron and open DevTools in the renderer process.

## ELPX Export Timing Profiler

Use this profiler when investigating delays during:

- Export to `.elpx`
- "Download project" in offline/Electron mode
- Delays before the native save dialog appears

### Enable

```js
window.eXeLearning.config.debugElpxExport = true;
window.eXeLearning.config.debugElpxExportIncludeCaller = true;
```

### Run

Trigger the normal `.elpx` export from the UI.

### Results

After the export finishes or is cancelled:

```js
window.__lastElpxExportSummary
window.__lastElpxExportTimeline
```

### Important summary fields

- `totalElapsedMs`: end-to-end export time
- `zipGenerateMs`: ZIP creation time
- `electronSaveMs`: full Electron save phase
- `electronPromptMs`: native save dialog phase
- `electronNormalizeMs`: renderer payload -> `Buffer` normalization in Electron main
- `electronWriteMs`: final disk write time
- `deflatedFiles` / `storedFiles`: how many files were compressed vs stored as-is
- `deflatedBytes` / `storedBytes`: byte totals for each group

### Useful timeline phases

- `bridge:exporter:run:start/end`
- `exporter:preprocess-pages:start/end`
- `exporter:asset-export-map:start/end`
- `exporter:assets-to-zip:start/end`
- `exporter:zip-generate:start/end`
- `bridge:electron:dialog:start/end`
- `bridge:electron:buffer-normalize:start/end`
- `bridge:electron:write:start/end`

### Quick inspection snippets

Largest phases:

```js
window.__lastElpxExportTimeline
  .slice()
  .sort((a, b) => b.elapsedMs - a.elapsedMs);
```

Only ZIP and Electron save phases:

```js
window.__lastElpxExportTimeline.filter(entry =>
  entry.phase.includes('zip-generate') ||
  entry.phase.includes('bridge:electron:')
);
```

### How to read the data

- If `zipGenerateMs` is dominant, the bottleneck is archive generation/compression.
- If `electronPromptMs` is dominant, the native dialog is the slow phase.
- If `electronNormalizeMs` is dominant, the main-process payload conversion is expensive.
- If `electronWriteMs` is dominant, the bottleneck is disk I/O.

## Save Memory Profiler

Use this profiler when investigating high RAM usage or long save times in the Yjs/Electron save flow.

### Enable

```js
window.eXeLearning.config.debugSaveMemory = true;
```

Optional experiment flags:

```js
window.eXeLearning.config.saveMemoryExperiment = 'auto';
```

Supported values:

- `'auto'`: current default behavior
- `'baseline'`: restore pre-optimization Electron small-asset batching
- `'small-session-batches'`: lower session byte cap
- `'legacy-batches'`: force legacy sequential batches
- `'yjs-only'`: skip asset upload
- `'assets-only'`: skip Yjs upload

Optional batch-size overrides:

```js
window.eXeLearning.config.saveMemorySessionBatchBytes = 5 * 1024 * 1024;
window.eXeLearning.config.saveMemoryBatchBytes = 5 * 1024 * 1024;
```

### Run

Trigger a normal save from the UI.

### Results

```js
window.__lastSaveMemorySummary
window.__lastSaveMemoryTimeline
```

### Important memory fields

- `rss`
- `heapUsed`
- `heapTotal`
- `external`
- `arrayBuffers`
- `rendererWorkingSetSize`
- `rendererPeakWorkingSetSize`
- `rendererPrivateBytes`

### Important save phases

- `save:start`
- `yjs:serialize:start/end`
- `yjs:upload:start/end`
- `assets:metadata:start/end`
- `batch:blob-load:start/end`
- `batch:formdata:start/end`
- `batch:request:start/end`
- `batch:mark-uploaded:start/end`
- `save:end`
- `save:delayed+3000ms`

### How to read the data

- Peak before upload starts usually points to Yjs serialization.
- Peak during blob-load points to asset loading pressure.
- Peak during `formdata` or `request` usually points to multipart/request buffering.
- High delayed samples suggest retained references after save completion.

## Other Useful Helpers

### Keep the logs clean

Reset debug flags after a run:

```js
delete window.eXeLearning.config.debugElpxExport;
delete window.eXeLearning.config.debugElpxExportIncludeCaller;
delete window.eXeLearning.config.debugSaveMemory;
delete window.eXeLearning.config.saveMemoryExperiment;
delete window.eXeLearning.config.saveMemorySessionBatchBytes;
delete window.eXeLearning.config.saveMemoryBatchBytes;
```

### Compare two runs manually

Capture a copy before changing flags:

```js
const run1 = structuredClone(window.__lastElpxExportSummary);
const run2 = structuredClone(window.__lastSaveMemorySummary);
```

### Inspect the last 20 export phases

```js
window.__lastElpxExportTimeline.slice(-20);
```

### Inspect the highest memory samples

```js
window.__lastSaveMemoryTimeline
  .slice()
  .sort((a, b) => (b.rss || 0) - (a.rss || 0))
  .slice(0, 10);
```
