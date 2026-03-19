/**
 * ProgressTracker
 *
 * Unified progress tracker for smooth save operations.
 * Calculates progress weights based on total bytes to transfer,
 * providing proportional progress updates without jumps.
 *
 * Shows progress bar with percentage and current phase label.
 */
class ProgressTracker {
  /**
   * @param {Toast|null} toast - Toast to update with progress
   * @param {Object} weights - Weight allocation for each phase
   * @param {number} weights.yjs - Weight for Yjs upload (0-1)
   * @param {number} weights.assets - Weight for assets upload (0-1)
   * @param {number} weights.finalize - Weight for finalization (0-1)
   * @param {Object} options - Additional options
   * @param {number} options.totalBytes - Total bytes to upload (Yjs + assets)
   * @param {number} options.yjsBytes - Bytes for Yjs document
   * @param {number} options.assetBytes - Bytes for assets
   */
  constructor(toast, weights, options = {}) {
    this.toast = toast;
    this.weights = weights;
    this.phase = 'yjs'; // 'yjs' | 'assets' | 'finalize'
    this.phaseProgress = 0;
    this.lastReportedProgress = 0;
    this.phaseLabel = '';
    this.phaseDetail = '';

    // Byte tracking for progress display
    this.totalBytes = options.totalBytes || 0;  // Total bytes (Yjs + assets)
    this.yjsBytes = options.yjsBytes || 0;      // Yjs document bytes
    this.assetBytes = options.assetBytes || 0;  // Asset bytes only
    this.uploadedAssetBytes = 0;                // Bytes of assets uploaded so far
  }

  /**
   * Calculate progress weights based on total bytes
   * @param {number} yjsBytes - Size of Yjs document
   * @param {number} assetBytes - Total size of pending assets
   * @returns {Object} Weight allocation for each phase
   */
  static calculateWeights(yjsBytes, assetBytes) {
    const totalBytes = yjsBytes + assetBytes;

    if (totalBytes === 0) {
      // No data to upload, distribute evenly with quick finalization
      return { yjs: 0.45, assets: 0.45, finalize: 0.10 };
    }

    // Reserve 5% for finalization
    const uploadWeight = 0.95;

    return {
      yjs: (yjsBytes / totalBytes) * uploadWeight,
      assets: (assetBytes / totalBytes) * uploadWeight,
      finalize: 0.05,
    };
  }

  /**
   * Format bytes to human-readable string
   * @param {number} bytes
   * @returns {string}
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Set the current phase with a label
   * @param {'yjs' | 'assets' | 'finalize'} phase
   * @param {string} label - Human-readable phase label
   */
  setPhase(phase, label = '') {
    this.phase = phase;
    this.phaseProgress = 0;
    this.phaseLabel = label;
    this.phaseDetail = '';
    this._updateToast();
  }

  /**
   * Set detail text for current phase (e.g., "3/10 files")
   * @param {string} detail
   */
  setPhaseDetail(detail) {
    this.phaseDetail = detail;
    this._updateToast();
  }

  /**
   * Update asset upload progress
   * @param {number} _uploadedAssets - Number of assets uploaded (unused, kept for API compatibility)
   * @param {number} uploadedBytes - Bytes uploaded so far (including partial)
   * @param {number} _inProgressAssets - Number of assets in progress (unused, kept for API compatibility)
   */
  updateAssetProgress(_uploadedAssets, uploadedBytes, _inProgressAssets = 0) {
    this.uploadedAssetBytes = uploadedBytes;

    // Calculate phase progress based on bytes
    if (this.assetBytes > 0) {
      const percent = (uploadedBytes / this.assetBytes) * 100;
      this.updatePhaseProgress(percent);
    }
  }

  /**
   * Update progress within current phase (0-100)
   * @param {number} percent - Phase progress percentage (0-100)
   */
  updatePhaseProgress(percent) {
    this.phaseProgress = Math.min(Math.max(0, percent), 100);
    this._updateToast();
  }

  /**
   * Calculate and report total progress to toast
   * Progress only increases, never decreases
   */
  _updateToast() {
    let total = 0;

    if (this.phase === 'yjs') {
      total = (this.phaseProgress / 100) * this.weights.yjs;
    } else if (this.phase === 'assets') {
      total = this.weights.yjs + (this.phaseProgress / 100) * this.weights.assets;
    } else if (this.phase === 'finalize') {
      total = this.weights.yjs + this.weights.assets + (this.phaseProgress / 100) * this.weights.finalize;
    }

    const progressPercent = Math.round(total * 100);

    // Progress never decreases
    if (progressPercent > this.lastReportedProgress || this.phaseLabel) {
      if (progressPercent > this.lastReportedProgress) {
        this.lastReportedProgress = progressPercent;
      }

      if (this.toast) {
        // Update progress bar
        this.toast.setProgress(this.lastReportedProgress);

        // Build status message
        let message = this.phaseLabel || this._getDefaultPhaseLabel();

        // Show bytes progress in ALL phases (not just assets)
        if (this.totalBytes > 0) {
          // Calculate total bytes uploaded so far (Yjs + assets)
          let currentUploadedBytes = 0;
          if (this.phase === 'yjs') {
            // During Yjs phase: estimate Yjs bytes based on phase progress
            currentUploadedBytes = Math.round((this.phaseProgress / 100) * this.yjsBytes);
          } else if (this.phase === 'assets') {
            // During assets phase: Yjs complete + asset bytes uploaded
            currentUploadedBytes = this.yjsBytes + this.uploadedAssetBytes;
          } else if (this.phase === 'finalize') {
            // Finalize: all bytes uploaded
            currentUploadedBytes = this.totalBytes;
          }
          const bytesInfo = `${ProgressTracker.formatBytes(currentUploadedBytes)} / ${ProgressTracker.formatBytes(this.totalBytes)}`;
          message = `${message} (${bytesInfo})`;
        }

        // Update toast body with message and percentage
        this.toast.toastBody.innerHTML = `${message} <strong>${this.lastReportedProgress}%</strong>`;
      }
    }
  }

  /**
   * Get default label for current phase
   * @returns {string}
   */
  _getDefaultPhaseLabel() {
    switch (this.phase) {
      case 'yjs': return _('Saving document...');
      case 'assets': return _('Uploading assets...');
      case 'finalize': return _('Finalizing...');
      default: return _('Saving...');
    }
  }

  /**
   * Get current total progress percentage
   * @returns {number}
   */
  getProgress() {
    return this.lastReportedProgress;
  }
}

/**
 * SaveManager
 *
 * Coordinates saving a project to the server:
 * 1. Serializes Yjs document state
 * 2. Saves Yjs state to server
 * 3. Uploads pending assets in batches
 * 4. Updates project metadata
 *
 * Uses the progress modal to show save status.
 */
class SaveManager {
  /**
   * @param {YjsProjectBridge} bridge - The YjsProjectBridge instance
   * @param {Object} options - Configuration options
   * @param {string} options.apiUrl - Base API URL (e.g., http://localhost:3001/api)
   * @param {string} options.token - JWT authentication token
   */
  constructor(bridge, options = {}) {
    this.bridge = bridge;
    this.apiUrl = options.apiUrl || `${window.location.origin}/api`;
    this.token = options.token || '';
    this.progressModal = null;
    this._saveMemoryTrace = null;

    // ==========================================
    // Upload Configuration Constants
    // ==========================================
    // These constants control the upload pipeline for optimal performance
    // across different network conditions and file sizes. Values are tuned
    // to balance throughput, memory usage, and server load.

    /**
     * Maximum files per batch for legacy REST uploads.
     * Reduced from server limit (200) to improve reliability and allow
     * size-based batching (MAX_BATCH_BYTES) to take precedence for
     * better upload progress tracking.
     */
    this.MAX_BATCH_FILES = 30;

    /**
     * Maximum total bytes per batch (20MB).
     * Sized to complete in ~2s on 10Mbps connections, providing responsive
     * progress updates. Backend processes files in parallel, so larger
     * batches don't improve throughput but do increase memory pressure.
     */
    this.MAX_BATCH_BYTES = 20 * 1024 * 1024;

    /**
     * Maximum concurrent batch uploads.
     * Set to 10 for aggressive parallelization - most browsers support
     * 6-8 concurrent connections per domain. Excess batches queue in the
     * browser's connection pool without blocking JS execution.
     */
    this.MAX_CONCURRENT_BATCHES = 2;

    /**
     * Threshold for chunked uploads (20MB).
     * Files larger than this use chunked upload with resumability.
     * Matches MAX_BATCH_BYTES so that large files bypass batch processing
     * entirely, preventing single large files from blocking other uploads.
     */
    this.CHUNK_UPLOAD_THRESHOLD = 20 * 1024 * 1024;

    /**
     * Chunk size for large file uploads (5MB).
     * Provides ~4 progress updates per large file while keeping request
     * overhead low. Larger chunks = fewer requests but coarser progress.
     */
    this.CHUNK_SIZE = 5 * 1024 * 1024;

    /**
     * Maximum concurrent chunk uploads per large file.
     * Set to 6 to saturate a typical connection without overwhelming it.
     * More parallelism helps on high-bandwidth connections but can cause
     * timeouts on slower networks.
     */
    this.MAX_CONCURRENT_CHUNKS = 6;

    /**
     * Maximum concurrent large file uploads.
     * Limited to 2 to prevent memory exhaustion when multiple large files
     * are pending. Each large file may use MAX_CONCURRENT_CHUNKS connections,
     * so 2 files × 6 chunks = 12 active uploads maximum.
     */
    this.MAX_CONCURRENT_LARGE_FILES = 1;

    // Saving state
    this.isSaving = false;

    // Priority queue reference (set externally)
    this.priorityQueue = null;

    // WebSocket handler reference for priority signaling
    this.wsHandler = null;

    // Static mode detection (cached)
    // Uses app.capabilities as single source of truth (derived from RuntimeConfig)
    this._isStaticMode = null;
  }

  /**
   * Check if running in static (offline) mode.
   * Uses app.capabilities as single source of truth.
   * @returns {boolean}
   */
  isStaticMode() {
    if (this._isStaticMode === null) {
      // Use capabilities as single source of truth (derived from RuntimeConfig)
      const capabilities = window.eXeLearning?.app?.capabilities;
      if (capabilities) {
        // Static mode = no remote storage capability
        this._isStaticMode = !capabilities.storage.remote;
      } else {
        // capabilities should always be available after app initialization
        // Log warning if accessed too early
        console.warn('[SaveManager] isStaticMode called before capabilities available');
        this._isStaticMode = false;
      }
    }
    return this._isStaticMode;
  }

  /**
   * Handle save in static mode
   * In static mode, Yjs auto-saves to IndexedDB. We show a toast
   * informing the user to use File > Export to save their project.
   *
   * @param {Object} options - Save options
   * @returns {{success: boolean, message: string}}
   */
  async _handleStaticModeSave(options = {}) {
    const { silent = false } = options;

    Logger.log('[SaveManager] Static mode: Project is auto-saved to browser storage');

    if (!silent && eXeLearning?.app?.toasts) {
      const toastData = {
        title: typeof _ === 'function' ? _('Offline Mode') : 'Offline Mode',
        body: typeof _ === 'function'
          ? _('Your project is automatically saved in your browser. Use File > Export to download a copy.')
          : 'Your project is automatically saved in your browser. Use File > Export to download a copy.',
        icon: 'info',
        remove: 5000,
      };
      eXeLearning.app.toasts.createToast(toastData);
    }

    return {
      success: true,
      message: 'Static mode: Project saved to IndexedDB (use Export to download)',
    };
  }

  /**
   * Set the priority queue reference
   * @param {AssetPriorityQueue} queue
   */
  setPriorityQueue(queue) {
    this.priorityQueue = queue;
    Logger.log('[SaveManager] Priority queue attached');
  }

  /**
   * Set the WebSocket handler reference
   * @param {AssetWebSocketHandler} handler
   */
  setWebSocketHandler(handler) {
    this.wsHandler = handler;
    Logger.log('[SaveManager] WebSocket handler attached');
  }

  // ===== Upload Session Methods (Optimized Batch Upload) =====

  /**
   * Maximum files per session batch.
   * Set to 200 to match server's upload-session endpoint limit.
   * This is higher than MAX_BATCH_FILES because session-based uploads
   * use a single authenticated connection with server-side streaming,
   * reducing per-file overhead significantly.
   */
  SESSION_BATCH_SIZE = 200;

  /**
   * Maximum total bytes per upload-session batch.
   * Session uploads still use a single multipart request, so they need the
   * same kind of byte ceiling as legacy batches to avoid large FormData spikes.
   */
  SESSION_BATCH_BYTES = 20 * 1024 * 1024;

  /**
   * Check if WebSocket-based upload sessions are available
   * @returns {boolean}
   */
  isUploadSessionAvailable() {
    return !!(this.wsHandler && this.wsHandler.connected && typeof this.wsHandler.createUploadSession === 'function');
  }

  /**
   * Divide assets into chunks for session-based upload
   * @param {Array} assets - Assets to divide
   * @param {number} maxPerBatch - Maximum files per batch (default: SESSION_BATCH_SIZE)
   * @param {number} maxBytesPerBatch - Maximum bytes per batch (default: SESSION_BATCH_BYTES)
   * @returns {Array<Array>} Array of chunks
   */
  createSessionChunks(assets, maxPerBatch = this.SESSION_BATCH_SIZE, maxBytesPerBatch = this.SESSION_BATCH_BYTES) {
    const chunks = [];
    let currentChunk = [];
    let currentBytes = 0;

    for (const asset of assets) {
      const assetSize = asset.size || asset.blob?.size || 0;
      const exceedsFileLimit = currentChunk.length >= maxPerBatch;
      const exceedsByteLimit = currentChunk.length > 0 && currentBytes + assetSize > maxBytesPerBatch;

      if (currentChunk.length > 0 && (exceedsFileLimit || exceedsByteLimit)) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentBytes = 0;
      }

      currentChunk.push(asset);
      currentBytes += assetSize;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Detect desktop/offline Electron mode where peak memory matters more than max throughput.
   * @returns {boolean}
   */
  isDesktopLikeUploadMode() {
    return !!window.electronAPI;
  }

  /**
   * Get the debug configuration for save-memory investigation.
   * These flags are intentionally internal and can be set from devtools or
   * test code without changing the normal save UI.
   * @returns {Object}
   */
  getSaveMemoryDebugConfig() {
    const config = window.eXeLearning?.config || {};
    return {
      enabled: config.debugSaveMemory === true,
      experiment: config.saveMemoryExperiment || 'auto',
      sessionBatchBytes:
        typeof config.saveMemorySessionBatchBytes === 'number'
          ? config.saveMemorySessionBatchBytes
          : null,
      batchBytes:
        typeof config.saveMemoryBatchBytes === 'number'
          ? config.saveMemoryBatchBytes
          : null,
    };
  }

  /**
   * @returns {string}
   */
  getSaveMemoryExperiment() {
    return this.getSaveMemoryDebugConfig().experiment;
  }

  /**
   * @returns {boolean}
   */
  isSaveMemoryInstrumentationEnabled() {
    return this.getSaveMemoryDebugConfig().enabled;
  }

  /**
   * @returns {number}
   */
  getSessionBatchByteLimit() {
    const config = this.getSaveMemoryDebugConfig();
    if (typeof config.sessionBatchBytes === 'number') {
      return config.sessionBatchBytes;
    }
    if (config.experiment === 'small-session-batches') {
      return 5 * 1024 * 1024;
    }
    return this.SESSION_BATCH_BYTES;
  }

  /**
   * @returns {number}
   */
  getDesktopLegacyBatchByteLimit() {
    const config = this.getSaveMemoryDebugConfig();
    if (typeof config.batchBytes === 'number') {
      return config.batchBytes;
    }
    if (config.experiment === 'legacy-batches') {
      return 5 * 1024 * 1024;
    }
    return this.MAX_BATCH_BYTES;
  }

  /**
   * @returns {boolean}
   */
  shouldSkipYjsUploadForExperiment() {
    return this.getSaveMemoryExperiment() === 'assets-only';
  }

  /**
   * @returns {boolean}
   */
  shouldSkipAssetUploadForExperiment() {
    return this.getSaveMemoryExperiment() === 'yjs-only';
  }

  /**
   * @returns {boolean}
   */
  shouldForceLegacyBatches() {
    return this.getSaveMemoryExperiment() === 'legacy-batches';
  }

  /**
   * Electron defaults to one-file-per-request for small assets because it
   * minimizes multipart request body size and reduces Chromium buffering spikes.
   * The baseline experiment can temporarily restore the previous behavior.
   * @returns {boolean}
   */
  shouldUseDesktopSingleAssetUploads() {
    if (!this.isDesktopLikeUploadMode()) {
      return false;
    }
    const experiment = this.getSaveMemoryExperiment();
    return experiment !== 'baseline' && experiment !== 'legacy-batches';
  }

  /**
   * @returns {number}
   */
  getMemoryTimestampMs() {
    if (globalThis.performance?.now) {
      return globalThis.performance.now();
    }
    return Date.now();
  }

  /**
   * Start a memory trace for the current save.
   */
  startSaveMemoryTrace() {
    if (!this.isSaveMemoryInstrumentationEnabled()) {
      this._saveMemoryTrace = null;
      return;
    }

    this._saveMemoryTrace = {
      startedAt: new Date().toISOString(),
      startedMs: this.getMemoryTimestampMs(),
      experiment: this.getSaveMemoryExperiment(),
      entries: [],
    };
  }

  /**
   * Read memory metrics from Electron and browser APIs when available.
   * @returns {Promise<Object>}
   */
  async collectSaveMemoryUsage() {
    let electronMetrics = null;
    let browserMetrics = null;
    let uaMetrics = null;

    if (typeof window.electronAPI?.getMemoryUsage === 'function') {
      try {
        electronMetrics = await window.electronAPI.getMemoryUsage();
      } catch (error) {
        Logger.log(`[SaveManager] getMemoryUsage failed: ${error.message}`);
      }
    }

    if (typeof globalThis.performance?.measureUserAgentSpecificMemory === 'function') {
      try {
        uaMetrics = await globalThis.performance.measureUserAgentSpecificMemory();
      } catch (_error) {
        uaMetrics = null;
      }
    }

    if (globalThis.performance?.memory) {
      browserMetrics = globalThis.performance.memory;
    }

    return {
      rss: electronMetrics?.process?.rss ?? null,
      heapUsed:
        electronMetrics?.process?.heapUsed ??
        browserMetrics?.usedJSHeapSize ??
        null,
      heapTotal:
        electronMetrics?.process?.heapTotal ??
        browserMetrics?.totalJSHeapSize ??
        null,
      external: electronMetrics?.process?.external ?? null,
      arrayBuffers: electronMetrics?.process?.arrayBuffers ?? null,
      rendererWorkingSetSize: electronMetrics?.renderer?.workingSetSize ?? null,
      rendererPeakWorkingSetSize: electronMetrics?.renderer?.peakWorkingSetSize ?? null,
      rendererPrivateBytes: electronMetrics?.renderer?.privateBytes ?? null,
      rendererSharedBytes: electronMetrics?.renderer?.sharedBytes ?? null,
      uaBytes: uaMetrics?.bytes ?? null,
    };
  }

  /**
   * Sample and log save-memory metrics for a phase.
   * @param {string} phase
   * @param {Object} context
   * @returns {Promise<void>}
   */
  async sampleSaveMemory(phase, context = {}, traceOverride = null) {
    const trace = traceOverride || this._saveMemoryTrace;
    if (!trace) {
      return;
    }

    const entry = {
      phase,
      ts: new Date().toISOString(),
      elapsedMs: Math.round(this.getMemoryTimestampMs() - trace.startedMs),
      ...await this.collectSaveMemoryUsage(),
      ...context,
    };

    trace.entries.push(entry);
    Logger.log(`[SaveManager][Memory] ${JSON.stringify(entry)}`);
  }

  /**
   * Log a compact peak summary for the current trace.
   * @param {string} outcome
   */
  logSaveMemorySummary(outcome) {
    if (!this._saveMemoryTrace) {
      return;
    }

    const { entries, experiment } = this._saveMemoryTrace;
    const peakFor = (field) => {
      return entries.reduce((peak, entry) => {
        if (typeof entry[field] !== 'number') return peak;
        if (!peak || entry[field] > peak[field]) return entry;
        return peak;
      }, null);
    };

    const summary = {
      outcome,
      experiment,
      samples: entries.length,
      peakRss: peakFor('rss'),
      peakHeapUsed: peakFor('heapUsed'),
      peakExternal: peakFor('external'),
      peakArrayBuffers: peakFor('arrayBuffers'),
    };

    window.__lastSaveMemoryTimeline = entries;
    window.__lastSaveMemorySummary = summary;
    Logger.log(`[SaveManager][MemorySummary] ${JSON.stringify(summary)}`);
  }

  /**
   * Schedule one delayed sample after save completion so that post-upload
   * retention can be observed without blocking the save result.
   * @param {string} outcome
   */
  scheduleDelayedSaveMemorySample(outcome) {
    if (!this._saveMemoryTrace) {
      return;
    }

    const trace = this._saveMemoryTrace;
    window.setTimeout(() => {
      this.sampleSaveMemory('save:delayed+3000ms', { outcome }, trace).catch(() => {});
    }, 3000);
  }

  /**
   * Upload assets using the optimized upload session system
   * Uses WebSocket for session creation and progress, HTTP for bulk upload
   *
   * @param {string} projectId - Project UUID
   * @param {AssetManager} assetManager
   * @param {Array} pendingAssets - Array of assets to upload
   * @param {Toast|null} toast - Progress toast (unused, kept for API compatibility)
   * @param {Object} progressOpts - Progress options
   * @param {Function} progressOpts.onProgress - Progress callback (uploadedFiles, uploadedBytes)
   * @returns {Promise<{uploaded: number, failed: number}>}
   */
  async uploadWithSession(projectId, assetManager, pendingAssets, toast, progressOpts = {}) {
    const { onProgress } = progressOpts;
    const totalFiles = pendingAssets.length;
    const totalBytes = pendingAssets.reduce((sum, a) => sum + (a.size || a.blob?.size || 0), 0);
    const pendingAssetsById = new Map(pendingAssets.map(asset => [asset.id, asset]));

    Logger.log(
      `[SaveManager] Starting session upload: ${totalFiles} files, ` +
        `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
    );

    // Progress tracking
    let uploadedFiles = 0;
    let uploadedBytes = 0;
    let failedFiles = 0;

    // Build manifest for session creation
    const manifest = pendingAssets.map(asset => ({
      clientId: asset.id,
      filename: asset.filename || `asset-${asset.id}`,
      size: asset.size || asset.blob?.size || 0,
      mimeType: asset.mime || 'application/octet-stream',
    }));

    // Create upload session via WebSocket
    let session;
    try {
      session = await this.wsHandler.createUploadSession(manifest);
      Logger.log(`[SaveManager] Upload session created: ${session.sessionToken.substring(0, 8)}...`);
    } catch (err) {
      console.error('[SaveManager] Failed to create upload session:', err);
      throw err;
    }

    // Cumulative progress tracking across all batches
    let cumulativeUploaded = 0;
    let cumulativeFailed = 0;
    let cumulativeBytes = 0;

    // Set up progress listeners
    const onFileProgress = (data) => {
      const { clientId, bytesWritten, totalBytes: fileBytes, status, error } = data;

      // Find file info
      const asset = pendingAssetsById.get(clientId);
      const currentFile = asset?.filename || clientId.substring(0, 8) + '...';

      if (status === 'complete') {
        uploadedFiles++;
        uploadedBytes += fileBytes;
      } else if (status === 'error') {
        failedFiles++;
        console.warn(`[SaveManager] File upload error: ${currentFile} - ${error}`);
      }

      // Update unified progress (uploadedFiles, uploadedBytes)
      if (onProgress) {
        const totalFilesUploaded = cumulativeUploaded + uploadedFiles;
        const totalBytesUploaded = cumulativeBytes + uploadedBytes;
        onProgress(totalFilesUploaded, totalBytesUploaded);
      }
    };

    const onBatchComplete = async (data) => {
      const { uploaded, failed, results } = data;
      Logger.log(`[SaveManager] Session batch complete: ${uploaded} uploaded, ${failed} failed`);

      // Mark successful uploads
      for (const result of results) {
        if (result.success) {
          try {
            await this.sampleSaveMemory('save:session-batch:before-mark-uploaded', {
              assetId: result.clientId,
            });
            await assetManager.markAssetUploaded(result.clientId);
            await this.sampleSaveMemory('save:session-batch:after-mark-uploaded', {
              assetId: result.clientId,
            });
          } catch (err) {
            console.warn(`[SaveManager] Failed to mark asset uploaded: ${result.clientId}`, err);
          }
        }
      }
    };

    // Register listeners
    this.wsHandler.on('uploadFileProgress', onFileProgress);
    this.wsHandler.on('uploadBatchComplete', onBatchComplete);

    try {
      // Split assets into chunks to respect server's 200-file limit per request
      const sessionBatchBytes = this.getSessionBatchByteLimit();
      const chunks = this.createSessionChunks(
        pendingAssets,
        this.SESSION_BATCH_SIZE,
        sessionBatchBytes
      );
      Logger.log(
        `[SaveManager] Uploading ${pendingAssets.length} files in ${chunks.length} session batches ` +
        `(max ${this.SESSION_BATCH_SIZE} files / ${(sessionBatchBytes / (1024 * 1024)).toFixed(0)} MB per batch)`
      );

      const basePath = window.eXeLearning?.config?.basePath || '';
      const uploadUrl = `${basePath}${session.config.endpoints.batch}`;

      // Upload each chunk sequentially (same session token, multiple HTTP requests)
      // Load blobs per-chunk to avoid loading all blobs into memory at once
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        await this.sampleSaveMemory('save:session-batch:before-blob-load', {
          batchIndex: chunkIndex + 1,
          totalBatches: chunks.length,
          batchFiles: chunk.length,
        });
        let chunkWithBlobs = await assetManager.getPendingAssetsBatch(chunk, { restoreToMemory: false });
        const chunkBytes = chunkWithBlobs.reduce((sum, a) => sum + (a.blob?.size || 0), 0);
        await this.sampleSaveMemory('save:session-batch:after-blob-load', {
          batchIndex: chunkIndex + 1,
          totalBatches: chunks.length,
          batchFiles: chunkWithBlobs.length,
          batchBytes: chunkBytes,
        });

        Logger.log(
          `[SaveManager] Uploading session batch ${chunkIndex + 1}/${chunks.length} ` +
          `(${chunkWithBlobs.length} files, ${(chunkBytes / (1024 * 1024)).toFixed(1)} MB)`
        );

        // Reset per-batch counters (cumulative tracking handles overall progress)
        uploadedFiles = 0;
        uploadedBytes = 0;
        failedFiles = 0;

        // Build FormData for this chunk
        await this.sampleSaveMemory('save:session-batch:before-formdata', {
          batchIndex: chunkIndex + 1,
          totalBatches: chunks.length,
          batchFiles: chunkWithBlobs.length,
          batchBytes: chunkBytes,
        });
        let formData = new FormData();

        // Add metadata as JSON
        const metadata = chunkWithBlobs.map(asset => ({
          clientId: asset.id,
          filename: asset.filename || `asset-${asset.id}`,
          mimeType: asset.mime || 'application/octet-stream',
          folderPath: asset.folderPath || '',
        }));
        formData.append('metadata', JSON.stringify(metadata));

        // Add files for this chunk
        for (const asset of chunkWithBlobs) {
          if (!asset.blob) {
            console.warn('[SaveManager] Asset missing blob:', asset.id);
            continue;
          }
          const file = new File([asset.blob], asset.filename || `asset-${asset.id}`, {
            type: asset.mime || 'application/octet-stream',
          });
          formData.append('files', file);
        }
        await this.sampleSaveMemory('save:session-batch:after-formdata', {
          batchIndex: chunkIndex + 1,
          totalBatches: chunks.length,
          batchFiles: chunkWithBlobs.length,
          batchBytes: chunkBytes,
        });

        // Upload this chunk via HTTP with session token
        await this.sampleSaveMemory('save:session-batch:before-request', {
          batchIndex: chunkIndex + 1,
          totalBatches: chunks.length,
          batchFiles: chunkWithBlobs.length,
          batchBytes: chunkBytes,
        });
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'X-Upload-Session': session.sessionToken,
          },
          body: formData,
        });
        formData = null;
        chunkWithBlobs = null;
        await Promise.resolve();
        await this.sampleSaveMemory('save:session-batch:after-request', {
          batchIndex: chunkIndex + 1,
          totalBatches: chunks.length,
          batchFiles: chunk.length,
          batchBytes: chunkBytes,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Session batch ${chunkIndex + 1}/${chunks.length} failed: ${response.status} ${errorText}`
          );
        }

        const result = await response.json();
        Logger.log(
          `[SaveManager] Session batch ${chunkIndex + 1}/${chunks.length} complete:`,
          result
        );

        // Update cumulative counters for next batch's progress display
        cumulativeUploaded += result.uploaded || 0;
        cumulativeFailed += result.failed || 0;
        cumulativeBytes += chunkBytes;

        // Update progress after each batch (uploadedFiles, uploadedBytes)
        if (onProgress) {
          onProgress(cumulativeUploaded, cumulativeBytes);
        }
      }

      Logger.log(
        `[SaveManager] All session batches complete: ${cumulativeUploaded} uploaded, ${cumulativeFailed} failed`
      );

      return {
        uploaded: cumulativeUploaded,
        failed: cumulativeFailed,
      };
    } finally {
      // Clean up listeners
      this.wsHandler.off('uploadFileProgress', onFileProgress);
      this.wsHandler.off('uploadBatchComplete', onBatchComplete);
    }
  }

  /**
   * Sort assets by priority (highest priority first)
   * Assets not in the priority queue get IDLE priority (0)
   * @param {Array} assets - Array of asset objects
   * @returns {Array} Sorted assets
   */
  sortAssetsByPriority(assets) {
    if (!this.priorityQueue) {
      return assets; // No priority queue, return original order
    }

    return [...assets].sort((a, b) => {
      const priorityA = this.priorityQueue.getPriority(a.id) || 0;
      const priorityB = this.priorityQueue.getPriority(b.id) || 0;
      return priorityB - priorityA; // Descending order (highest first)
    });
  }

  /**
   * Create priority-aware batches
   * High priority assets go in small, fast batches
   * Normal priority assets go in standard batches
   * @param {Array} assets - Array of asset objects
   * @returns {Array<Array>} Array of batches
   */
  createPriorityBatches(assets) {
    if (!this.priorityQueue) {
      return this.createSizeLimitedBatches(assets);
    }

    // Separate assets by priority tier
    const PRIORITY = window.AssetPriorityQueue?.PRIORITY || { CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, IDLE: 0 };
    const critical = [];
    const high = [];
    const normal = [];

    for (const asset of assets) {
      const priority = this.priorityQueue.getPriority(asset.id) || 0;
      if (priority >= PRIORITY.CRITICAL) {
        critical.push(asset);
      } else if (priority >= PRIORITY.HIGH) {
        high.push(asset);
      } else {
        normal.push(asset);
      }
    }

    const allBatches = [];

    // Critical assets: one per batch for maximum speed
    for (const asset of critical) {
      allBatches.push([asset]);
    }

    // High priority: smaller batches (max 5 files or 5MB)
    const highBatches = this.createSizeLimitedBatches(high, 5, 5 * 1024 * 1024);
    allBatches.push(...highBatches);

    // Normal priority: standard batches
    const normalBatches = this.createSizeLimitedBatches(normal);
    allBatches.push(...normalBatches);

    Logger.log(
      `[SaveManager] Created priority batches: ${critical.length} critical, ` +
      `${highBatches.length} high-priority batches, ${normalBatches.length} normal batches`
    );

    return allBatches;
  }

  /**
   * Set the JWT token for API calls
   * @param {string} token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Create a progress toast for save operations
   * @param {string} projectTitle - Project title for display
   * @returns {Toast}
   */
  createProgressToast(projectTitle) {
    const toast = eXeLearning?.app?.toasts?.createToast({
      title: _('Save'),
      body: _('Preparing...'),
      icon: 'save'
    });
    if (toast) {
      toast.showProgress();
    }
    return toast;
  }

  /**
   * Estimate total bytes for pending assets
   * @param {Array} assets
   * @returns {number}
   */
  estimatePendingUploadBytes(assets) {
    if (!Array.isArray(assets) || assets.length === 0) return 0;
    return assets.reduce((sum, asset) => {
      const size = asset?.blob?.size || asset?.size || 0;
      return sum + size;
    }, 0);
  }

  /**
   * Fetch user storage info (used bytes + quota)
   * @returns {Promise<{quota_mb: number | null, used_bytes: number} | null>}
   */
  async fetchUserStorageInfo() {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.apiUrl}/user/storage`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Storage info request failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      return result?.data || null;
    } catch (error) {
      console.warn('[SaveManager] Unable to check storage quota:', error);
      return null;
    }
  }

  /**
   * Check if pending uploads exceed user quota
   * @param {Array} pendingAssets
   * @returns {Promise<{allowed: boolean, message?: string}>}
   */
  async checkQuotaBeforeSave(pendingAssets) {
    const estimatedBytes = this.estimatePendingUploadBytes(pendingAssets);
    if (!estimatedBytes) {
      return { allowed: true };
    }

    const storage = await this.fetchUserStorageInfo();
    if (!storage || storage.quota_mb === null || storage.quota_mb === undefined) {
      return { allowed: true };
    }

    const quotaBytes = storage.quota_mb * 1024 * 1024;
    const usedBytes = storage.used_bytes || 0;
    const projectedBytes = usedBytes + estimatedBytes;

    if (projectedBytes <= quotaBytes) {
      return { allowed: true };
    }

    return {
      allowed: false,
      message: _('Cannot save project to server because your storage quota has been exceeded. You can download the project locally.'),
    };
  }

  /**
   * Save the project to the server
   * @param {Object} options - Save options
   * @param {boolean} options.showProgress - Show progress modal (default: true)
   * @param {boolean} options.silent - Silent save without notifications (default: false)
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async save(options = {}) {
    const { showProgress = true, silent = false } = options;

    // Static mode: Show toast and return success (Yjs auto-saves to IndexedDB)
    if (this.isStaticMode()) {
      return this._handleStaticModeSave(options);
    }

    if (this.isSaving) {
      console.warn('[SaveManager] Save already in progress');
      return { success: false, error: 'Save already in progress' };
    }

    this.isSaving = true;
    this.startSaveMemoryTrace();

    // Get project info early for toast creation
    const projectId = this.bridge.projectId;
    const documentManager = this.bridge.documentManager;
    const metadata = documentManager?.getMetadata();
    const projectTitle = metadata?.get('title') || _('Untitled');

    // Create progress toast instead of modal
    const toast = showProgress ? this.createProgressToast(projectTitle) : null;

    try {
      await this.sampleSaveMemory('save:start', {
        experiment: this.getSaveMemoryExperiment(),
        desktopMode: this.isDesktopLikeUploadMode(),
      });

      // Get asset manager
      const assetManager = this.bridge.assetManager;
      let pendingAssetsMetadata = null;

      if (!projectId || !documentManager) {
        throw new Error('Project not initialized');
      }

      if (assetManager && assetManager.projectId) {
        try {
          // Use metadata-only call — avoids loading all blobs into memory for quota check
          await this.sampleSaveMemory('save:pending-assets:before-collect');
          pendingAssetsMetadata = assetManager.getPendingAssetsMetadata();
          await this.sampleSaveMemory('save:pending-assets:after-collect', {
            pendingAssets: pendingAssetsMetadata?.length || 0,
            pendingAssetBytes: this.estimatePendingUploadBytes(pendingAssetsMetadata || []),
          });
        } catch (assetError) {
          console.error('[SaveManager] Failed to load pending assets metadata:', assetError);
        }
      }

      if (pendingAssetsMetadata && pendingAssetsMetadata.length > 0) {
        const quotaCheck = await this.checkQuotaBeforeSave(pendingAssetsMetadata);
        if (!quotaCheck.allowed) {
          if (eXeLearning?.app?.modals?.alert) {
            eXeLearning.app.modals.alert.show({
              title: _('Quota exceeded'),
              body: quotaCheck.message,
            });
          }
          throw new Error(quotaCheck.message);
        }
      }

      // Encode Yjs state once — reuse for both size estimation and upload
      let encodedYjsState = null;
      let yjsBytes = 0;
      try {
        await this.sampleSaveMemory('save:yjs-serialize:before');
        encodedYjsState = window.Y.encodeStateAsUpdate(documentManager.ydoc);
        yjsBytes = encodedYjsState.length;
        await this.sampleSaveMemory('save:yjs-serialize:after', {
          yjsBytes,
        });
      } catch {
        yjsBytes = 0;
      }
      const assetBytes = this.estimatePendingUploadBytes(pendingAssetsMetadata || []);
      const weights = ProgressTracker.calculateWeights(yjsBytes, assetBytes);

      Logger.log(`[SaveManager] Progress weights - Yjs: ${(weights.yjs * 100).toFixed(1)}%, ` +
        `Assets: ${(weights.assets * 100).toFixed(1)}%, Finalize: ${(weights.finalize * 100).toFixed(1)}%`);

      // Create progress tracker with byte info for all phases
      const progressTracker = new ProgressTracker(toast, weights, {
        totalBytes: yjsBytes + assetBytes,  // Total bytes (shown from the start)
        yjsBytes: yjsBytes,                  // Yjs document size
        assetBytes: assetBytes,              // Asset total size
      });

      // Step 1: Save Yjs document state (weighted based on bytes)
      if (this.shouldSkipYjsUploadForExperiment()) {
        Logger.log('[SaveManager] Skipping Yjs upload for save-memory experiment');
        progressTracker.setPhase('yjs');
        progressTracker.updatePhaseProgress(100);
      } else {
        Logger.log('[SaveManager] Step 1: Saving Yjs state...');
        if (toast) {
          toast.toastBody.innerHTML = _('Saving document...');
        }

        progressTracker.setPhase('yjs');
        await this.sampleSaveMemory('save:yjs-upload:before', { yjsBytes });
        await this.saveYjsState(projectId, documentManager, encodedYjsState, (percent) => {
          progressTracker.updatePhaseProgress(percent);
        });
        await this.sampleSaveMemory('save:yjs-upload:after', { yjsBytes });
        encodedYjsState = null; // Free encoded state after upload
        progressTracker.updatePhaseProgress(100);
      }

      // Step 2: Upload pending assets (weighted based on bytes)
      progressTracker.setPhase('assets');
      if (this.shouldSkipAssetUploadForExperiment()) {
        Logger.log('[SaveManager] Skipping asset upload for save-memory experiment');
      } else if (assetManager && assetManager.projectId) {
        try {
          // Re-check metadata (not loading blobs yet — uploadAssets loads per-batch)
          if (!pendingAssetsMetadata) {
            await this.sampleSaveMemory('save:pending-assets:before-recheck');
            pendingAssetsMetadata = assetManager.getPendingAssetsMetadata();
            await this.sampleSaveMemory('save:pending-assets:after-recheck', {
              pendingAssets: pendingAssetsMetadata?.length || 0,
            });
          }

          if (pendingAssetsMetadata && pendingAssetsMetadata.length > 0) {
            Logger.log(`[SaveManager] Step 2: Uploading ${pendingAssetsMetadata.length} assets...`);
            if (toast) {
              toast.toastBody.innerHTML = _('Uploading assets...');
            }
            // Pass metadata directly — upload methods load blobs per-batch to avoid memory spike
            await this.uploadAssets(projectId, assetManager, pendingAssetsMetadata, toast, progressTracker);
          } else {
            Logger.log('[SaveManager] Step 2: No pending assets to upload');
          }
        } catch (assetError) {
          // Log the actual error for debugging
          console.error('[SaveManager] Step 2: Asset error:', assetError);
          console.error('[SaveManager] AssetManager projectId:', assetManager.projectId, 'type:', typeof assetManager.projectId);
        }
      } else {
        Logger.log('[SaveManager] Step 2: AssetManager not initialized, skipping asset upload');
      }
      progressTracker.updatePhaseProgress(100);

      // Step 3: Update project metadata (finalize phase)
      Logger.log('[SaveManager] Step 3: Updating project metadata...');
      progressTracker.setPhase('finalize');
      if (toast) {
        toast.toastBody.innerHTML = _('Finalizing...');
      }
      await this.sampleSaveMemory('save:finalize:before');
      await this.updateProjectMetadata(projectId, metadata);
      progressTracker.updatePhaseProgress(100);
      await this.sampleSaveMemory('save:end', { outcome: 'success' });
      this.logSaveMemorySummary('success');
      this.scheduleDelayedSaveMemorySample('success');

      // Success!
      Logger.log('[SaveManager] Save completed successfully');

      if (toast) {
        toast.setProgress(100);
        toast.toastBody.innerHTML = _('Project saved.');
        toast.hideProgress();
        setTimeout(() => toast.remove(), 2000);
      }

      // Mark document as clean (no unsaved changes)
      if (documentManager.markClean) {
        documentManager.markClean();
      }

      // Mark project as no longer new after first save
      if (this.bridge.isNewProject) {
        this.bridge.isNewProject = false;
      }

      return { success: true, message: _('Project saved successfully') };
    } catch (error) {
      console.error('[SaveManager] Save failed:', error);
      await this.sampleSaveMemory('save:end', { outcome: 'error', error: error.message });
      this.logSaveMemorySummary('error');
      this.scheduleDelayedSaveMemorySample('error');

      if (toast) {
        toast.toastBody.innerHTML = error.message || _('Failed to save project');
        toast.toastBody.classList.add('error');
        toast.hideProgress();
        // Don't auto-remove on error, let user dismiss
      }

      // Update save status indicator
      if (this.bridge.updateSaveStatus) {
        this.bridge.updateSaveStatus('error', error.message);
      }

      return { success: false, error: error.message };
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Estimate Yjs document state size in bytes
   * @param {YjsDocumentManager} documentManager
   * @returns {number}
   */
  estimateYjsStateBytes(documentManager) {
    if (!documentManager || !documentManager.ydoc) return 0;
    try {
      const state = window.Y.encodeStateAsUpdate(documentManager.ydoc);
      return state.length;
    } catch {
      return 0;
    }
  }

  /**
   * Save Yjs document state to server
   * This is an explicit save (user clicked Save), so we mark the project as saved.
   * @param {string} projectId - Project UUID
   * @param {YjsDocumentManager} documentManager
   * @param {Uint8Array|null} preEncodedState - Pre-encoded Yjs state (avoids double encoding)
   * @param {Function} onProgress - Progress callback (0-100)
   */
  async saveYjsState(projectId, documentManager, preEncodedState, onProgress) {
    // Use pre-encoded state if available, otherwise encode now
    const state = preEncodedState || window.Y.encodeStateAsUpdate(documentManager.ydoc);

    Logger.log(`[SaveManager] Yjs state size: ${state.length} bytes`);

    // Get project title from metadata to send as header
    // This avoids the server having to decode the entire Yjs document just to extract the title
    const metadata = documentManager.getMetadata ? documentManager.getMetadata() : null;
    const title = metadata?.get('title') || '';

    // Report start
    if (onProgress) onProgress(0);

    // Use XMLHttpRequest for upload progress
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({ success: true });
          }
        } else {
          reject(new Error(`Failed to save document: ${xhr.status} ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while saving document'));

      xhr.open('POST', `${this.apiUrl}/projects/uuid/${projectId}/yjs-document?markSaved=true`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      xhr.setRequestHeader('X-Project-Title', encodeURIComponent(title));
      xhr.send(state);
    });

    Logger.log('[SaveManager] Yjs state saved:', result);
    return result;
  }

  /**
   * Upload pending assets to server using optimal strategy for each file type.
   * - Large files (>20MB): Chunked upload (resumable, handles timeouts)
   * - Small files (≤20MB): Upload sessions (fewer HTTP requests, real-time progress)
   *
   * When both large and small files exist, they are uploaded IN PARALLEL for
   * maximum throughput. This is especially beneficial when you have a mix like
   * 6 large files (400MB) + 152 small files (100MB).
   *
   * @param {string} projectId - Project UUID
   * @param {AssetManager} assetManager
   * @param {Array} pendingAssets - Array of assets to upload
   * @param {Toast|null} toast - Progress toast (unused, kept for API compatibility)
   * @param {ProgressTracker|null} progressTracker - Unified progress tracker
   * @returns {Promise<{uploaded: number, failed: number}>}
   */
  async uploadAssets(projectId, assetManager, pendingAssets, toast, progressTracker) {
    // Sort assets by priority (highest priority first)
    const sortedAssets = this.sortAssetsByPriority(pendingAssets);

    // Separate large files (chunked upload) from small files (batch/session upload)
    // Support both metadata-only objects (size property) and blob-loaded objects (blob.size)
    const getAssetSize = (a) => a.size || a.blob?.size || 0;
    const largeAssets = sortedAssets.filter(a => getAssetSize(a) > this.CHUNK_UPLOAD_THRESHOLD);
    const smallAssets = sortedAssets.filter(a => getAssetSize(a) <= this.CHUNK_UPLOAD_THRESHOLD);

    // Calculate progress weights based on total bytes
    const largeTotalBytes = largeAssets.reduce((sum, a) => sum + getAssetSize(a), 0);
    const smallTotalBytes = smallAssets.reduce((sum, a) => sum + getAssetSize(a), 0);
    const totalBytes = largeTotalBytes + smallTotalBytes;

    // Progress allocation: proportional to bytes
    const largeProgressWeight = totalBytes > 0 ? largeTotalBytes / totalBytes : 0;
    const smallProgressWeight = totalBytes > 0 ? smallTotalBytes / totalBytes : 1;

    // Log what we're about to do
    const totalAssets = pendingAssets.length;
    if (this.priorityQueue) {
      const PRIORITY = window.AssetPriorityQueue?.PRIORITY || { HIGH: 75 };
      const highPriorityCount = sortedAssets.filter(a =>
        (this.priorityQueue.getPriority(a.id) || 0) >= PRIORITY.HIGH
      ).length;
      Logger.log(`[SaveManager] Processing ${totalAssets} assets (${highPriorityCount} high-priority): ${largeAssets.length} large (chunked), ${smallAssets.length} small`);
    } else {
      Logger.log(`[SaveManager] Processing ${totalAssets} assets: ${largeAssets.length} large (chunked), ${smallAssets.length} small`);
    }

    // Progress tracking for combined uploads (file counts and bytes)
    let largeUploadedFiles = 0, smallUploadedFiles = 0;
    let largeUploadedBytes = 0, smallUploadedBytes = 0;
    let largeInProgressFiles = 0; // Large files currently being chunked

    const updateCombinedProgress = () => {
      if (progressTracker) {
        const totalUploadedFiles = largeUploadedFiles + smallUploadedFiles;
        const totalUploadedBytes = largeUploadedBytes + smallUploadedBytes;
        progressTracker.updateAssetProgress(totalUploadedFiles, totalUploadedBytes, largeInProgressFiles);
      }
    };

    // Execute uploads in a memory-aware way. Electron prefers predictable peak
    // memory over maximum throughput, so run upload streams sequentially there.
    const runSequentially = this.isDesktopLikeUploadMode();
    const uploadTasks = [];

    // 1. Large assets → chunked upload
    if (largeAssets.length > 0) {
      uploadTasks.push(() =>
        this.uploadLargeAssetsChunked(projectId, assetManager, largeAssets, null, {
          baseProgress: 0,
          progressRange: 100,
          onProgress: (uploadedFiles, uploadedBytes, inProgressFiles) => {
            largeUploadedFiles = uploadedFiles;
            largeUploadedBytes = uploadedBytes;
            largeInProgressFiles = inProgressFiles || 0;
            updateCombinedProgress();
          },
        })
      );
    }

    // 2. Small assets → TRY session upload, fallback to batch
    if (smallAssets.length > 0) {
      if (this.shouldUseDesktopSingleAssetUploads()) {
        Logger.log('[SaveManager] Using single-file upload for small assets in Electron mode');
        uploadTasks.push(() =>
          this.uploadSmallAssetsIndividually(projectId, assetManager, smallAssets, null, {
            onProgress: (uploadedFiles, uploadedBytes) => {
              smallUploadedFiles = uploadedFiles;
              smallUploadedBytes = uploadedBytes;
              updateCombinedProgress();
            },
          })
        );
      } else if (this.isUploadSessionAvailable() && !this.shouldForceLegacyBatches()) {
        // Use upload sessions for small files (fewer HTTP requests, real-time progress)
        Logger.log('[SaveManager] Using optimized upload session for small assets');
        uploadTasks.push(() =>
          this.uploadWithSession(projectId, assetManager, smallAssets, null, {
            onProgress: (uploadedFiles, uploadedBytes) => {
              smallUploadedFiles = uploadedFiles;
              smallUploadedBytes = uploadedBytes;
              updateCombinedProgress();
            },
          })
            .catch(err => {
              console.warn('[SaveManager] Session upload failed, using batches:', err.message);
              return this.uploadSmallAssetsBatched(projectId, assetManager, smallAssets, null, {
                baseProgress: 0,
                progressRange: 100,
                onProgress: (uploadedFiles, uploadedBytes) => {
                  smallUploadedFiles = uploadedFiles;
                  smallUploadedBytes = uploadedBytes;
                  updateCombinedProgress();
                },
              });
            })
        );
      } else {
        // Fallback: legacy batch upload
        Logger.log('[SaveManager] Using batch upload for small assets (sessions unavailable)');
        uploadTasks.push(() =>
          this.uploadSmallAssetsBatched(projectId, assetManager, smallAssets, null, {
            baseProgress: 0,
            progressRange: 100,
            onProgress: (uploadedFiles, uploadedBytes) => {
              smallUploadedFiles = uploadedFiles;
              smallUploadedBytes = uploadedBytes;
              updateCombinedProgress();
            },
          })
        );
      }
    }

    // Wait for upload streams to complete
    const results = runSequentially
      ? await this.runUploadTasksSequentially(uploadTasks)
      : await Promise.allSettled(uploadTasks.map(task => task()));

    // Combine results from all upload streams
    let totalUploaded = 0;
    let totalFailed = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalUploaded += result.value.uploaded || 0;
        totalFailed += result.value.failed || 0;
      } else {
        // If a promise failed completely, log it (files in that stream are considered failed)
        console.error('[SaveManager] Upload stream failed:', result.reason);
        // Note: We can't know exactly how many failed without more context
        // The individual upload methods should handle their own error counting
      }
    }

    // Log summary
    if (totalFailed > 0) {
      console.warn(`[SaveManager] Asset upload completed with errors: ${totalUploaded} uploaded, ${totalFailed} failed`);
    } else {
      Logger.log(`[SaveManager] Successfully uploaded ${totalUploaded} assets`);
    }

    return { uploaded: totalUploaded, failed: totalFailed };
  }

  /**
   * Upload large assets using chunked upload (parallel, max MAX_CONCURRENT_LARGE_FILES)
   * @param {string} projectId - Project UUID
   * @param {AssetManager} assetManager
   * @param {Array} largeAssets - Array of large assets (>20MB)
   * @param {Toast|null} toast - Progress toast (unused, kept for API compatibility)
   * @param {Object} progressOpts - Progress options
   * @param {number} progressOpts.baseProgress - Base progress percentage (legacy, unused)
   * @param {number} progressOpts.progressRange - Progress range for large assets (legacy, unused)
   * @param {Function} progressOpts.onProgress - Progress callback (uploadedFiles, uploadedBytes, inProgressFiles)
   * @returns {Promise<{uploaded: number, failed: number}>}
   */
  async uploadLargeAssetsChunked(projectId, assetManager, largeAssets, toast, progressOpts) {
    const { onProgress } = progressOpts;

    Logger.log(`[SaveManager] Uploading ${largeAssets.length} large assets via chunked upload (max ${this.MAX_CONCURRENT_LARGE_FILES} concurrent)...`);

    let uploadedCount = 0;
    let failedCount = 0;

    // Track bytes uploaded for smooth progress
    const totalBytes = largeAssets.reduce((sum, a) => sum + (a.size || a.blob?.size || 0), 0);
    let bytesUploaded = 0;
    const assetBytesUploaded = new Map(); // Track per-asset progress

    const updateProgress = () => {
      if (onProgress) {
        let currentBytes = bytesUploaded;
        for (const bytes of assetBytesUploaded.values()) {
          currentBytes += bytes;
        }
        // Report (uploadedFiles, uploadedBytes, inProgressFiles)
        const inProgressFiles = assetBytesUploaded.size;
        onProgress(uploadedCount, currentBytes, inProgressFiles);
      }
    };

    // Upload large files in parallel batches — load blobs per-asset to avoid memory spike
    for (let i = 0; i < largeAssets.length; i += this.MAX_CONCURRENT_LARGE_FILES) {
      const batch = largeAssets.slice(i, i + this.MAX_CONCURRENT_LARGE_FILES);

      const results = await Promise.allSettled(
        batch.map(async (asset) => {
          // Load blob on-demand for this asset (may be metadata-only)
          await this.sampleSaveMemory('save:large-asset:before-blob-load', {
            assetId: asset.id,
            batchFiles: 1,
          });
          const blob = asset.blob || await this.getBlobForUpload(assetManager, asset.id);
          if (!blob) {
            Logger.log(`[SaveManager] Skipping large asset ${asset.id}: no local blob`);
            return { success: false, asset, error: new Error('Missing blob') };
          }
          const assetWithBlob = { ...asset, blob };
          const assetBytes = blob.size || 0;
          const assetSize = assetBytes / (1024 * 1024);
          await this.sampleSaveMemory('save:large-asset:after-blob-load', {
            assetId: asset.id,
            batchFiles: 1,
            batchBytes: assetBytes,
          });

          try {
            await this.uploadLargeAsset(projectId, assetWithBlob, (chunkProgress) => {
              // chunkProgress is 0-1 for this asset
              assetBytesUploaded.set(asset.id, chunkProgress * assetBytes);
              updateProgress();
            });

            await this.sampleSaveMemory('save:large-asset:before-mark-uploaded', {
              assetId: asset.id,
              batchBytes: assetBytes,
            });
            await assetManager.markAssetUploaded(asset.id);
            await this.sampleSaveMemory('save:large-asset:after-mark-uploaded', {
              assetId: asset.id,
              batchBytes: assetBytes,
            });
            assetBytesUploaded.delete(asset.id);
            bytesUploaded += assetBytes;
            updateProgress();
            Logger.log(`[SaveManager] Large asset uploaded: ${asset.filename} (${assetSize.toFixed(1)} MB)`);
            return { success: true, asset };
          } catch (error) {
            console.error(`[SaveManager] Large asset upload failed: ${asset.filename}`, error);
            assetBytesUploaded.delete(asset.id);
            return { success: false, asset, error };
          }
        })
      );

      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          uploadedCount++;
        } else {
          failedCount++;
        }
      }
    }

    return { uploaded: uploadedCount, failed: failedCount };
  }

  /**
   * Upload small assets using legacy batch upload (parallel)
   * @param {string} projectId - Project UUID
   * @param {AssetManager} assetManager
   * @param {Array} smallAssets - Array of small assets (≤20MB)
   * @param {Toast|null} toast - Progress toast (unused, kept for API compatibility)
   * @param {Object} progressOpts - Progress options
   * @param {number} progressOpts.baseProgress - Base progress percentage (legacy, unused)
   * @param {number} progressOpts.progressRange - Progress range for small assets (legacy, unused)
   * @param {Function} progressOpts.onProgress - Progress callback (uploadedFiles, uploadedBytes)
   * @returns {Promise<{uploaded: number, failed: number}>}
   */
  async uploadSmallAssetsBatched(projectId, assetManager, smallAssets, toast, progressOpts) {
    const { onProgress } = progressOpts;

    // Split assets into batches respecting priority, file count AND total size limits
    const batches = this.priorityQueue
      ? this.createPriorityBatches(smallAssets)
      : this.createSizeLimitedBatches(
        smallAssets,
        null,
        this.isDesktopLikeUploadMode() ? this.getDesktopLegacyBatchByteLimit() : null
      );

    Logger.log(`[SaveManager] Processing ${smallAssets.length} small assets in ${batches.length} batches (max ${this.MAX_CONCURRENT_BATCHES} concurrent)`);

    // Track bytes for smooth progress
    let bytesUploaded = 0;
    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < batches.length; i += this.MAX_CONCURRENT_BATCHES) {
      const concurrentBatches = batches.slice(i, i + this.MAX_CONCURRENT_BATCHES);

      // Load blobs per-batch and upload in parallel (continues on failure)
      const results = await Promise.allSettled(
        concurrentBatches.map(async (batch, batchOffset) => {
          const batchIndex = i + batchOffset + 1;
          await this.sampleSaveMemory('save:small-batch:before-blob-load', {
            batchIndex,
            totalBatches: batches.length,
            batchFiles: batch.length,
          });
          let batchWithBlobs = await assetManager.getPendingAssetsBatch(batch, { restoreToMemory: false });
          const batchBytes = batchWithBlobs.reduce((sum, a) => sum + (a.blob?.size || a.size || 0), 0);
          await this.sampleSaveMemory('save:small-batch:after-blob-load', {
            batchIndex,
            totalBatches: batches.length,
            batchFiles: batchWithBlobs.length,
            batchBytes,
          });
          const uploadResult = await this.uploadAssetBatch(projectId, batchWithBlobs, assetManager, {
            phasePrefix: 'save:small-batch',
            batchIndex,
            totalBatches: batches.length,
            batchFiles: batchWithBlobs.length,
            batchBytes,
          });
          batchWithBlobs = null;
          return uploadResult;
        })
      );

      // Process results and mark successful uploads
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const batch = concurrentBatches[j];
        const batchBytes = batch.reduce((sum, a) => sum + (a.size || a.blob?.size || 0), 0);

        if (result.status === 'fulfilled') {
          // Batch succeeded - mark all assets as uploaded
          for (const asset of batch) {
            await this.sampleSaveMemory('save:small-batch:before-mark-uploaded', {
              assetId: asset.id,
            });
            await assetManager.markAssetUploaded(asset.id);
            await this.sampleSaveMemory('save:small-batch:after-mark-uploaded', {
              assetId: asset.id,
            });
            uploadedCount++;
          }
          bytesUploaded += batchBytes;
        } else {
          // Batch failed - log error but continue
          console.error('[SaveManager] Batch upload failed:', result.reason);
          failedCount += batch.length;
        }

        // Update progress after each batch (uploadedFiles, uploadedBytes)
        if (onProgress) {
          onProgress(uploadedCount, bytesUploaded);
        }
      }
    }

    return { uploaded: uploadedCount, failed: failedCount };
  }

  /**
   * Upload small assets one file per request.
   * This is slower than batching but reduces multipart body size sharply,
   * which is valuable for Electron save stability on large projects.
   * @param {string} projectId
   * @param {AssetManager} assetManager
   * @param {Array} smallAssets
   * @param {Toast|null} toast
   * @param {Object} progressOpts
   * @returns {Promise<{uploaded: number, failed: number}>}
   */
  async uploadSmallAssetsIndividually(projectId, assetManager, smallAssets, toast, progressOpts = {}) {
    const { onProgress } = progressOpts;
    let uploadedCount = 0;
    let failedCount = 0;
    let uploadedBytes = 0;

    for (let index = 0; index < smallAssets.length; index++) {
      const asset = smallAssets[index];
      const batchIndex = index + 1;

      await this.sampleSaveMemory('save:single-file:before-blob-load', {
        batchIndex,
        totalBatches: smallAssets.length,
        assetId: asset.id,
        batchFiles: 1,
      });
      const [assetWithBlob] = await assetManager.getPendingAssetsBatch([asset], { restoreToMemory: false });
      const assetBytes = assetWithBlob?.blob?.size || asset.size || 0;
      await this.sampleSaveMemory('save:single-file:after-blob-load', {
        batchIndex,
        totalBatches: smallAssets.length,
        assetId: asset.id,
        batchFiles: assetWithBlob ? 1 : 0,
        batchBytes: assetBytes,
      });

      if (!assetWithBlob) {
        failedCount++;
        continue;
      }

      try {
        await this.uploadAssetBatch(projectId, [assetWithBlob], assetManager, {
          phasePrefix: 'save:single-file',
          batchIndex,
          totalBatches: smallAssets.length,
          assetId: asset.id,
          batchFiles: 1,
          batchBytes: assetBytes,
        });
        await this.sampleSaveMemory('save:single-file:before-mark-uploaded', {
          batchIndex,
          totalBatches: smallAssets.length,
          assetId: asset.id,
          batchBytes: assetBytes,
        });
        await assetManager.markAssetUploaded(asset.id);
        await this.sampleSaveMemory('save:single-file:after-mark-uploaded', {
          batchIndex,
          totalBatches: smallAssets.length,
          assetId: asset.id,
          batchBytes: assetBytes,
        });

        uploadedCount++;
        uploadedBytes += assetBytes;
      } catch (error) {
        console.error('[SaveManager] Single-file upload failed:', error);
        failedCount++;
      }

      if (onProgress) {
        onProgress(uploadedCount, uploadedBytes);
      }
    }

    return { uploaded: uploadedCount, failed: failedCount };
  }

  /**
   * Upload a large asset using chunked upload
   * @param {string} projectId - Project UUID
   * @param {Object} asset - Asset object with blob, filename, mime, id
   * @param {Function} onProgress - Progress callback (0-1)
   * @returns {Promise<Object>} - Server response with asset data
   */
  async uploadLargeAsset(projectId, asset, onProgress) {
    const blob = asset.blob;
    if (!blob) {
      throw new Error('Asset has no blob data');
    }

    const totalSize = blob.size;
    const totalChunks = Math.ceil(totalSize / this.CHUNK_SIZE);
    const identifier = `${asset.id}-${Date.now()}`;

    Logger.log(`[SaveManager] Starting chunked upload: ${asset.filename} (${(totalSize / (1024 * 1024)).toFixed(2)} MB, ${totalChunks} chunks)`);

    let uploadedChunks = 0;

    // Upload chunks with controlled concurrency
    for (let chunkStart = 0; chunkStart < totalChunks; chunkStart += this.MAX_CONCURRENT_CHUNKS) {
      const chunkPromises = [];

      for (let i = chunkStart; i < Math.min(chunkStart + this.MAX_CONCURRENT_CHUNKS, totalChunks); i++) {
        const chunkNumber = i + 1; // 1-indexed
        const start = i * this.CHUNK_SIZE;
        const end = Math.min(start + this.CHUNK_SIZE, totalSize);
        const chunkBlob = blob.slice(start, end);

        chunkPromises.push(
          this.uploadChunk(projectId, asset, identifier, chunkNumber, totalChunks, chunkBlob)
            .then(result => {
              uploadedChunks++;
              if (onProgress) {
                onProgress(uploadedChunks / totalChunks);
              }
              return result;
            })
        );
      }

      // Wait for this batch of chunks to complete
      const results = await Promise.all(chunkPromises);

      // Check if ANY chunk in this batch returned complete: true
      // Due to concurrent uploads, the chunk that triggers assembly might not be the last by number
      const completeResult = results.find(r => r && r.complete);
      if (completeResult) {
        Logger.log(`[SaveManager] Chunked upload complete: ${asset.filename}`);
        return completeResult;
      }
    }

    // All chunks uploaded but no completion signal - call finalize endpoint
    // This handles race conditions where all chunks were saved but completion check failed
    Logger.log(`[SaveManager] All chunks uploaded, calling finalize endpoint...`);

    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms between attempts

      try {
        const result = await this.finalizeChunkedUpload(projectId, asset, identifier, totalChunks);
        if (result && result.complete) {
          Logger.log(`[SaveManager] Chunked upload complete after finalize: ${asset.filename}`);
          return result;
        }
        // Not complete yet, continue polling
        Logger.log(`[SaveManager] Finalize attempt ${attempt + 1}: ${result?.progress?.received}/${totalChunks} chunks received`);
      } catch (error) {
        Logger.log(`[SaveManager] Finalize attempt ${attempt + 1} failed:`, error.message);
      }
    }

    throw new Error('Chunked upload finished but server did not confirm completion after retries');
  }

  /**
   * Upload a single chunk
   * @param {string} projectId - Project UUID
   * @param {Object} asset - Asset object
   * @param {string} identifier - Unique upload identifier
   * @param {number} chunkNumber - Chunk number (1-indexed)
   * @param {number} totalChunks - Total number of chunks
   * @param {Blob} chunkBlob - Chunk data
   * @returns {Promise<Object>} - Server response
   */
  async uploadChunk(projectId, asset, identifier, chunkNumber, totalChunks, chunkBlob) {
    const traceContext = {
      phasePrefix: 'save:chunk-upload',
      assetId: asset.id,
      chunkNumber,
      totalChunks,
      batchFiles: 1,
      batchBytes: chunkBlob.size || 0,
    };
    await this.sampleSaveMemory('save:chunk-upload:before-formdata', traceContext);
    let formData = new FormData();

    // Add chunk file
    const chunkFile = new File([chunkBlob], asset.filename || `chunk-${chunkNumber}`, {
      type: asset.mime || 'application/octet-stream',
    });
    formData.append('file', chunkFile);

    // Add Resumable.js compatible parameters
    formData.append('resumableIdentifier', identifier);
    formData.append('resumableChunkNumber', chunkNumber.toString());
    formData.append('resumableTotalChunks', totalChunks.toString());
    formData.append('resumableFilename', asset.filename || `asset-${asset.id}`);
    formData.append('resumableType', asset.mime || 'application/octet-stream');
    formData.append('clientId', asset.id);
    await this.sampleSaveMemory('save:chunk-upload:after-formdata', traceContext);

    await this.sampleSaveMemory('save:chunk-upload:before-request', traceContext);
    const response = await fetch(`${this.apiUrl}/projects/${projectId}/assets/upload-chunk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });
    formData = null;
    await Promise.resolve();
    await this.sampleSaveMemory('save:chunk-upload:after-request', traceContext);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chunk ${chunkNumber}/${totalChunks} upload failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Finalize a chunked upload (trigger assembly without re-uploading chunks)
   * @param {string} projectId - Project UUID
   * @param {Object} asset - Asset object
   * @param {string} identifier - Unique upload identifier
   * @param {number} totalChunks - Total number of chunks
   * @returns {Promise<Object>} - Server response
   */
  async finalizeChunkedUpload(projectId, asset, identifier, totalChunks) {
    const response = await fetch(`${this.apiUrl}/projects/${projectId}/assets/upload-chunk/finalize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumableIdentifier: identifier,
        resumableTotalChunks: totalChunks,
        resumableFilename: asset.filename || `asset-${asset.id}`,
        resumableType: asset.mime || 'application/octet-stream',
        clientId: asset.id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Finalize failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Upload a batch of assets
   * @param {string} projectId - Project UUID
   * @param {Array} assets - Batch of assets
   * @param {AssetManager} assetManager
   */
  async uploadAssetBatch(projectId, assets, assetManager, traceContext = {}) {
    // Build FormData for bulk sync
    await this.sampleSaveMemory(`${traceContext.phasePrefix || 'save:asset-batch'}:before-formdata`, traceContext);
    let formData = new FormData();

    // Build metadata array
    const metadata = [];

    for (const asset of assets) {
      metadata.push({
        clientId: asset.id,
        filename: asset.filename || `asset-${asset.id}`,
        mimeType: asset.mime || 'application/octet-stream',
        contentHash: asset.hash || '',
      });

      // Add file to FormData
      const file = new File([asset.blob], asset.filename || `asset-${asset.id}`, {
        type: asset.mime || 'application/octet-stream',
      });
      formData.append('files', file);
    }

    // Add metadata as JSON
    formData.append('metadata', JSON.stringify(metadata));
    await this.sampleSaveMemory(`${traceContext.phasePrefix || 'save:asset-batch'}:after-formdata`, traceContext);

    // Send to server
    await this.sampleSaveMemory(`${traceContext.phasePrefix || 'save:asset-batch'}:before-request`, traceContext);
    const response = await fetch(`${this.apiUrl}/projects/${projectId}/assets/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });
    formData = null;
    await Promise.resolve();
    await this.sampleSaveMemory(`${traceContext.phasePrefix || 'save:asset-batch'}:after-request`, traceContext);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload assets: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    Logger.log(`[SaveManager] Batch uploaded:`, result);

    return result;
  }

  /**
   * Run upload tasks sequentially while preserving Promise.allSettled semantics.
   * @param {Array<Function>} uploadTasks
   * @returns {Promise<Array>}
   */
  async runUploadTasksSequentially(uploadTasks) {
    const results = [];
    for (const task of uploadTasks) {
      try {
        results.push({
          status: 'fulfilled',
          value: await task(),
        });
      } catch (reason) {
        results.push({
          status: 'rejected',
          reason,
        });
      }
    }
    return results;
  }

  /**
   * Read a blob for upload without repopulating blobCache from Cache API when possible.
   * @param {AssetManager} assetManager
   * @param {string} assetId
   * @returns {Promise<Blob|null>}
   */
  async getBlobForUpload(assetManager, assetId) {
    if (typeof assetManager.getBlobForExport === 'function') {
      return assetManager.getBlobForExport(assetId);
    }

    if (typeof assetManager.getBlob === 'function') {
      return assetManager.getBlob(assetId, { restoreToMemory: false });
    }

    return null;
  }

  /**
   * Create batches that respect both file count AND total size limits
   * This prevents 413 Payload Too Large errors
   * @param {Array} assets - Array of assets with blob property
   * @returns {Array<Array>} - Array of batches
   */
  createSizeLimitedBatches(assets, maxFiles = null, maxBytes = null) {
    const maxFilesLimit = maxFiles || this.MAX_BATCH_FILES;
    const maxBytesLimit = maxBytes || this.MAX_BATCH_BYTES;

    const batches = [];
    let currentBatch = [];
    let currentBatchSize = 0;

    for (const asset of assets) {
      const assetSize = asset.size || asset.blob?.size || 0;

      // Check if adding this asset would exceed limits
      const wouldExceedFileLimit = currentBatch.length >= maxFilesLimit;
      const wouldExceedSizeLimit = currentBatchSize + assetSize > maxBytesLimit;

      // Start a new batch if limits would be exceeded (and current batch is not empty)
      if (currentBatch.length > 0 && (wouldExceedFileLimit || wouldExceedSizeLimit)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchSize = 0;
      }

      // Add asset to current batch
      currentBatch.push(asset);
      currentBatchSize += assetSize;
    }

    // Don't forget the last batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Log batch distribution for debugging
    const batchSizes = batches.map(b => ({
      files: b.length,
      bytes: b.reduce((sum, a) => sum + (a.size || a.blob?.size || 0), 0)
    }));
    Logger.log(`[SaveManager] Created ${batches.length} batches:`, batchSizes.map(
      s => `${s.files} files/${(s.bytes / (1024 * 1024)).toFixed(1)}MB`
    ).join(', '));

    return batches;
  }

  /**
   * Update project metadata on server
   * Syncs title from Yjs document to project record for listing purposes
   * @param {string} projectId - Project UUID
   * @param {Y.Map} metadata - Yjs metadata map
   */
  async updateProjectMetadata(projectId, metadata) {
    if (!metadata) return;

    // Get title from Yjs metadata
    const title = metadata.get('title');
    if (!title) {
      Logger.log('[SaveManager] No title in metadata, skipping sync');
      return;
    }

    try {
      // Update project title via API
      const response = await fetch(`${this.apiUrl}/projects/uuid/${projectId}/metadata`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        console.warn('[SaveManager] Failed to sync metadata:', response.status);
        return;
      }

      Logger.log('[SaveManager] Project metadata synced (title:', title, ')');
    } catch (error) {
      console.warn('[SaveManager] Error syncing metadata:', error.message);
      // Don't throw - metadata sync is not critical
    }
  }

  /**
   * Check if there are unsaved changes
   * @returns {Promise<boolean>}
   */
  async hasUnsavedChanges() {
    const assetManager = this.bridge?.assetManager;
    if (!assetManager) return false;

    const pendingAssets = await assetManager.getPendingAssets();
    return pendingAssets.length > 0;
  }

  /**
   * Get save status info
   * @returns {Promise<{pendingAssets: number, isSaving: boolean}>}
   */
  async getStatus() {
    const assetManager = this.bridge?.assetManager;
    let pendingAssets = 0;

    if (assetManager) {
      const pending = await assetManager.getPendingAssets();
      pendingAssets = pending.length;
    }

    return {
      pendingAssets,
      isSaving: this.isSaving,
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SaveManager;
  module.exports.ProgressTracker = ProgressTracker;
} else {
  window.SaveManager = SaveManager;
  window.ProgressTracker = ProgressTracker;
}
