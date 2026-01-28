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
    this.MAX_CONCURRENT_BATCHES = 10;

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
    this.MAX_CONCURRENT_LARGE_FILES = 2;

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
   * @returns {Array<Array>} Array of chunks
   */
  createSessionChunks(assets, maxPerBatch = this.SESSION_BATCH_SIZE) {
    const chunks = [];
    for (let i = 0; i < assets.length; i += maxPerBatch) {
      chunks.push(assets.slice(i, i + maxPerBatch));
    }
    return chunks;
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
    const totalBytes = pendingAssets.reduce((sum, a) => sum + (a.blob?.size || 0), 0);

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
      size: asset.blob?.size || 0,
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
      const asset = pendingAssets.find(a => a.id === clientId);
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
            await assetManager.markAssetUploaded(result.clientId);
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
      const chunks = this.createSessionChunks(pendingAssets, this.SESSION_BATCH_SIZE);
      Logger.log(
        `[SaveManager] Uploading ${pendingAssets.length} files in ${chunks.length} session batches ` +
        `(max ${this.SESSION_BATCH_SIZE} files per batch)`
      );

      const basePath = window.eXeLearning?.config?.basePath || '';
      const uploadUrl = `${basePath}${session.config.endpoints.batch}`;

      // Upload each chunk sequentially (same session token, multiple HTTP requests)
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const chunkBytes = chunk.reduce((sum, a) => sum + (a.blob?.size || 0), 0);

        Logger.log(
          `[SaveManager] Uploading session batch ${chunkIndex + 1}/${chunks.length} ` +
          `(${chunk.length} files, ${(chunkBytes / (1024 * 1024)).toFixed(1)} MB)`
        );

        // Reset per-batch counters (cumulative tracking handles overall progress)
        uploadedFiles = 0;
        uploadedBytes = 0;
        failedFiles = 0;

        // Build FormData for this chunk
        const formData = new FormData();

        // Add metadata as JSON
        const metadata = chunk.map(asset => ({
          clientId: asset.id,
          filename: asset.filename || `asset-${asset.id}`,
          mimeType: asset.mime || 'application/octet-stream',
          folderPath: asset.folderPath || '',
        }));
        formData.append('metadata', JSON.stringify(metadata));

        // Add files for this chunk
        for (const asset of chunk) {
          if (!asset.blob) {
            console.warn('[SaveManager] Asset missing blob:', asset.id);
            continue;
          }
          const file = new File([asset.blob], asset.filename || `asset-${asset.id}`, {
            type: asset.mime || 'application/octet-stream',
          });
          formData.append('files', file);
        }

        // Upload this chunk via HTTP with session token
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'X-Upload-Session': session.sessionToken,
          },
          body: formData,
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

    // Get project info early for toast creation
    const projectId = this.bridge.projectId;
    const documentManager = this.bridge.documentManager;
    const metadata = documentManager?.getMetadata();
    const projectTitle = metadata?.get('title') || _('Untitled');

    // Create progress toast instead of modal
    const toast = showProgress ? this.createProgressToast(projectTitle) : null;

    try {
      // Get asset manager
      const assetManager = this.bridge.assetManager;
      let pendingAssets = null;

      if (!projectId || !documentManager) {
        throw new Error('Project not initialized');
      }

      if (assetManager && assetManager.projectId) {
        try {
          pendingAssets = await assetManager.getPendingAssets();
        } catch (assetError) {
          console.error('[SaveManager] Failed to load pending assets:', assetError);
        }
      }

      if (pendingAssets && pendingAssets.length > 0) {
        const quotaCheck = await this.checkQuotaBeforeSave(pendingAssets);
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

      // Calculate progress weights based on actual data sizes
      const yjsBytes = this.estimateYjsStateBytes(documentManager);
      const assetBytes = this.estimatePendingUploadBytes(pendingAssets || []);
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
      Logger.log('[SaveManager] Step 1: Saving Yjs state...');
      if (toast) {
        toast.toastBody.innerHTML = _('Saving document...');
      }

      progressTracker.setPhase('yjs');
      await this.saveYjsState(projectId, documentManager, (percent) => {
        progressTracker.updatePhaseProgress(percent);
      });
      progressTracker.updatePhaseProgress(100);

      // Step 2: Upload pending assets (weighted based on bytes)
      progressTracker.setPhase('assets');
      if (assetManager && assetManager.projectId) {
        try {
          if (!pendingAssets) {
            pendingAssets = await assetManager.getPendingAssets();
          }

          if (pendingAssets && pendingAssets.length > 0) {
            Logger.log(`[SaveManager] Step 2: Uploading ${pendingAssets.length} assets...`);
            if (toast) {
              toast.toastBody.innerHTML = _('Uploading assets...');
            }
            await this.uploadAssets(projectId, assetManager, pendingAssets, toast, progressTracker);
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
      await this.updateProjectMetadata(projectId, metadata);
      progressTracker.updatePhaseProgress(100);

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
   * @param {Function} onProgress - Progress callback (0-100)
   */
  async saveYjsState(projectId, documentManager, onProgress) {
    // Serialize the Yjs document
    const ydoc = documentManager.ydoc;
    const state = window.Y.encodeStateAsUpdate(ydoc);

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
    const largeAssets = sortedAssets.filter(a => (a.blob?.size || 0) > this.CHUNK_UPLOAD_THRESHOLD);
    const smallAssets = sortedAssets.filter(a => (a.blob?.size || 0) <= this.CHUNK_UPLOAD_THRESHOLD);

    // Calculate progress weights based on total bytes
    const largeTotalBytes = largeAssets.reduce((sum, a) => sum + (a.blob?.size || 0), 0);
    const smallTotalBytes = smallAssets.reduce((sum, a) => sum + (a.blob?.size || 0), 0);
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

    // Execute uploads in parallel: chunked for large files, sessions/batches for small files
    const uploadPromises = [];

    // 1. Large assets → chunked upload
    if (largeAssets.length > 0) {
      uploadPromises.push(
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
      if (this.isUploadSessionAvailable()) {
        // Use upload sessions for small files (fewer HTTP requests, real-time progress)
        Logger.log('[SaveManager] Using optimized upload session for small assets');
        uploadPromises.push(
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
        uploadPromises.push(
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

    // Wait for all uploads to complete (parallel execution)
    const results = await Promise.allSettled(uploadPromises);

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
    const totalBytes = largeAssets.reduce((sum, a) => sum + (a.blob?.size || 0), 0);
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

    // Upload large files in parallel batches
    for (let i = 0; i < largeAssets.length; i += this.MAX_CONCURRENT_LARGE_FILES) {
      const batch = largeAssets.slice(i, i + this.MAX_CONCURRENT_LARGE_FILES);

      const results = await Promise.allSettled(
        batch.map(async (asset) => {
          const assetBytes = asset.blob?.size || 0;
          const assetSize = assetBytes / (1024 * 1024);

          try {
            await this.uploadLargeAsset(projectId, asset, (chunkProgress) => {
              // chunkProgress is 0-1 for this asset
              assetBytesUploaded.set(asset.id, chunkProgress * assetBytes);
              updateProgress();
            });

            await assetManager.markAssetUploaded(asset.id);
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
      : this.createSizeLimitedBatches(smallAssets);

    Logger.log(`[SaveManager] Processing ${smallAssets.length} small assets in ${batches.length} batches (max ${this.MAX_CONCURRENT_BATCHES} concurrent)`);

    // Track bytes for smooth progress
    let bytesUploaded = 0;
    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < batches.length; i += this.MAX_CONCURRENT_BATCHES) {
      const concurrentBatches = batches.slice(i, i + this.MAX_CONCURRENT_BATCHES);

      // Upload batches in parallel using Promise.allSettled (continues on failure)
      const results = await Promise.allSettled(
        concurrentBatches.map(batch => this.uploadAssetBatch(projectId, batch, assetManager))
      );

      // Process results and mark successful uploads
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const batch = concurrentBatches[j];
        const batchBytes = batch.reduce((sum, a) => sum + (a.blob?.size || 0), 0);

        if (result.status === 'fulfilled') {
          // Batch succeeded - mark all assets as uploaded
          for (const asset of batch) {
            await assetManager.markAssetUploaded(asset.id);
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
    const formData = new FormData();

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

    const response = await fetch(`${this.apiUrl}/projects/${projectId}/assets/upload-chunk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

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
  async uploadAssetBatch(projectId, assets, assetManager) {
    // Build FormData for bulk sync
    const formData = new FormData();

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

    // Send to server
    const response = await fetch(`${this.apiUrl}/projects/${projectId}/assets/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload assets: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    Logger.log(`[SaveManager] Batch uploaded:`, result);

    return result;
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
      const assetSize = asset.blob?.size || 0;

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
      bytes: b.reduce((sum, a) => sum + (a.blob?.size || 0), 0)
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
