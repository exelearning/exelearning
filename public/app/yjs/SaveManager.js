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

    // Maximum files per batch (will be reduced if total size exceeds MAX_BATCH_BYTES)
    this.MAX_BATCH_FILES = 30;

    // Maximum total bytes per batch (20MB - backend processes in parallel now)
    this.MAX_BATCH_BYTES = 20 * 1024 * 1024;

    // Maximum concurrent batch uploads (aggressive parallelization)
    this.MAX_CONCURRENT_BATCHES = 10;

    // Chunked upload settings for large files
    this.CHUNK_UPLOAD_THRESHOLD = 20 * 1024 * 1024; // 20MB - files larger than this use chunked upload
    this.CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (5x fewer requests than 1MB)

    // Maximum concurrent chunk uploads per large file
    this.MAX_CONCURRENT_CHUNKS = 6; // 2x more parallel uploads

    // Maximum concurrent large file uploads
    this.MAX_CONCURRENT_LARGE_FILES = 2;

    // Saving state
    this.isSaving = false;

    // Priority queue reference (set externally)
    this.priorityQueue = null;

    // WebSocket handler reference for priority signaling
    this.wsHandler = null;

    // Static mode detection (cached)
    this._isStaticMode = null;
  }

  /**
   * Check if running in static (offline) mode
   * @returns {boolean}
   */
  isStaticMode() {
    if (this._isStaticMode === null) {
      // Prefer capabilities check (new pattern)
      const capabilities = window.eXeLearning?.app?.capabilities;
      if (capabilities) {
        // Static mode = no remote storage capability
        this._isStaticMode = !capabilities.storage.remote;
      } else {
        // Fallback to direct detection for early initialization
        this._isStaticMode = window.__EXE_STATIC_MODE__ === true ||
                             window.eXeLearning?.config?.isStaticMode === true;
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

      // Step 1: Save Yjs document state (0-30%)
      Logger.log('[SaveManager] Step 1: Saving Yjs state...');
      if (toast) {
        toast.updateBodyWithProgress(_('Saving document...'), 10);
      }

      await this.saveYjsState(projectId, documentManager);

      // Update progress after Yjs save (30%)
      if (toast) {
        toast.setProgress(30);
      }

      // Step 2: Upload pending assets (30-90%)
      if (assetManager && assetManager.projectId) {
        try {
          if (!pendingAssets) {
            pendingAssets = await assetManager.getPendingAssets();
          }

          if (pendingAssets && pendingAssets.length > 0) {
            Logger.log(`[SaveManager] Step 2: Uploading ${pendingAssets.length} assets...`);
            await this.uploadAssets(projectId, assetManager, pendingAssets, toast);
          } else {
            Logger.log('[SaveManager] Step 2: No pending assets to upload');
            if (toast) {
              toast.setProgress(90);
            }
          }
        } catch (assetError) {
          // Log the actual error for debugging
          console.error('[SaveManager] Step 2: Asset error:', assetError);
          console.error('[SaveManager] AssetManager projectId:', assetManager.projectId, 'type:', typeof assetManager.projectId);
          if (toast) {
            toast.setProgress(90);
          }
        }
      } else {
        Logger.log('[SaveManager] Step 2: AssetManager not initialized, skipping asset upload');
        if (toast) {
          toast.setProgress(90);
        }
      }

      // Step 3: Update project metadata (90-100%)
      Logger.log('[SaveManager] Step 3: Updating project metadata...');
      if (toast) {
        toast.updateBodyWithProgress(_('Finalizing...'), 95);
      }
      await this.updateProjectMetadata(projectId, metadata);

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
   * Save Yjs document state to server
   * This is an explicit save (user clicked Save), so we mark the project as saved.
   * @param {string} projectId - Project UUID
   * @param {YjsDocumentManager} documentManager
   */
  async saveYjsState(projectId, documentManager) {
    // Serialize the Yjs document
    const ydoc = documentManager.ydoc;
    const state = window.Y.encodeStateAsUpdate(ydoc);

    Logger.log(`[SaveManager] Yjs state size: ${state.length} bytes`);

    // Send to server with markSaved=true to indicate this is an explicit user save
    // (as opposed to auto-persistence on page unload which should NOT mark as saved)
    const response = await fetch(`${this.apiUrl}/projects/uuid/${projectId}/yjs-document?markSaved=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${this.token}`,
      },
      body: state,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save document: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    Logger.log('[SaveManager] Yjs state saved:', result);
  }

  /**
   * Upload pending assets to server in batches with parallel processing
   * Uses Promise.allSettled to continue even if some batches fail
   * Large files (>20MB) are uploaded using chunked upload
   * @param {string} projectId - Project UUID
   * @param {AssetManager} assetManager
   * @param {Array} pendingAssets - Array of assets to upload
   * @param {Toast|null} toast - Progress toast
   * @returns {Promise<{uploaded: number, failed: number}>}
   */
  async uploadAssets(projectId, assetManager, pendingAssets, toast) {
    const totalAssets = pendingAssets.length;

    // Progress range: 30% to 90%
    const baseProgress = 30;
    const maxProgress = 90;
    const range = maxProgress - baseProgress;

    if (toast) {
      toast.updateBodyWithProgress(_('Uploading assets...'), baseProgress);
    }

    // Sort assets by priority (highest priority first)
    const sortedAssets = this.sortAssetsByPriority(pendingAssets);

    // Separate large files (chunked upload) from small files (batch upload)
    const largeAssets = sortedAssets.filter(a => (a.blob?.size || 0) > this.CHUNK_UPLOAD_THRESHOLD);
    const smallAssets = sortedAssets.filter(a => (a.blob?.size || 0) <= this.CHUNK_UPLOAD_THRESHOLD);

    // Log priority distribution
    if (this.priorityQueue) {
      const PRIORITY = window.AssetPriorityQueue?.PRIORITY || { HIGH: 75 };
      const highPriorityCount = sortedAssets.filter(a =>
        (this.priorityQueue.getPriority(a.id) || 0) >= PRIORITY.HIGH
      ).length;
      Logger.log(`[SaveManager] Processing ${totalAssets} assets (${highPriorityCount} high-priority): ${largeAssets.length} large (chunked), ${smallAssets.length} small (batched)`);
    } else {
      Logger.log(`[SaveManager] Processing ${totalAssets} assets: ${largeAssets.length} large (chunked), ${smallAssets.length} small (batched)`);
    }

    let uploadedCount = 0;
    let failedCount = 0;

    // Calculate progress weights based on total bytes
    const largeTotalBytes = largeAssets.reduce((sum, a) => sum + (a.blob?.size || 0), 0);
    const smallTotalBytes = smallAssets.reduce((sum, a) => sum + (a.blob?.size || 0), 0);
    const totalBytes = largeTotalBytes + smallTotalBytes;

    // Progress allocation: proportional to bytes
    const largeProgressWeight = totalBytes > 0 ? (largeTotalBytes / totalBytes) : 0;
    const smallProgressWeight = totalBytes > 0 ? (smallTotalBytes / totalBytes) : 1;

    const largeProgressRange = range * largeProgressWeight;
    const smallProgressRange = range * smallProgressWeight;

    // Step 1: Upload large assets using chunked upload (parallel, max MAX_CONCURRENT_LARGE_FILES)
    if (largeAssets.length > 0) {
      Logger.log(`[SaveManager] Uploading ${largeAssets.length} large assets via chunked upload (max ${this.MAX_CONCURRENT_LARGE_FILES} concurrent)...`);

      // Track progress for each large asset
      const largeProgressMap = new Map();
      let completedLargeFiles = 0;

      const updateLargeProgress = () => {
        if (toast) {
          // Calculate average progress across all large files
          let totalProgress = completedLargeFiles;
          for (const progress of largeProgressMap.values()) {
            totalProgress += progress;
          }
          const avgProgress = totalProgress / largeAssets.length;
          const overallProgress = baseProgress + avgProgress * largeProgressRange;
          toast.setProgress(overallProgress);
        }
      };

      // Upload large files in parallel batches
      for (let i = 0; i < largeAssets.length; i += this.MAX_CONCURRENT_LARGE_FILES) {
        const batch = largeAssets.slice(i, i + this.MAX_CONCURRENT_LARGE_FILES);

        if (toast) {
          const totalSize = batch.reduce((sum, a) => sum + (a.blob?.size || 0), 0) / (1024 * 1024);
          toast.updateBodyWithProgress(
            _('Uploading large files') + ` (${batch.length} files, ${totalSize.toFixed(1)} MB)...`,
            baseProgress + (i / largeAssets.length) * largeProgressRange
          );
        }

        const results = await Promise.allSettled(
          batch.map(async (asset, batchIndex) => {
            const assetIndex = i + batchIndex;
            const assetSize = (asset.blob?.size || 0) / (1024 * 1024);

            try {
              await this.uploadLargeAsset(projectId, asset, (chunkProgress) => {
                largeProgressMap.set(assetIndex, chunkProgress);
                updateLargeProgress();
              });

              await assetManager.markAssetUploaded(asset.id);
              largeProgressMap.delete(assetIndex);
              completedLargeFiles++;
              updateLargeProgress();
              Logger.log(`[SaveManager] Large asset uploaded: ${asset.filename} (${assetSize.toFixed(1)} MB)`);
              return { success: true, asset };
            } catch (error) {
              console.error(`[SaveManager] Large asset upload failed: ${asset.filename}`, error);
              largeProgressMap.delete(assetIndex);
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
    }

    // Step 2: Upload small assets using batch upload (parallel)
    if (smallAssets.length > 0) {
      const smallBaseProgress = baseProgress + largeProgressRange;

      // Split assets into batches respecting priority, file count AND total size limits
      const batches = this.priorityQueue
        ? this.createPriorityBatches(smallAssets)
        : this.createSizeLimitedBatches(smallAssets);

      Logger.log(`[SaveManager] Processing ${smallAssets.length} small assets in ${batches.length} batches (max ${this.MAX_CONCURRENT_BATCHES} concurrent)`);

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

          if (result.status === 'fulfilled') {
            // Batch succeeded - mark all assets as uploaded
            for (const asset of batch) {
              await assetManager.markAssetUploaded(asset.id);
              uploadedCount++;
            }
          } else {
            // Batch failed - log error but continue
            console.error('[SaveManager] Batch upload failed:', result.reason);
            failedCount += batch.length;
          }
        }

        // Update progress after each round of concurrent batches
        if (toast) {
          const processedSmall = uploadedCount + failedCount - largeAssets.length;
          const progress = smallBaseProgress + (processedSmall / smallAssets.length) * smallProgressRange;
          toast.updateBodyWithProgress(_('Uploading assets...'), Math.min(progress, maxProgress));
        }
      }
    }

    // Final progress for assets
    if (toast) {
      toast.setProgress(maxProgress);
    }

    // Log summary
    if (failedCount > 0) {
      console.warn(`[SaveManager] Asset upload completed with errors: ${uploadedCount} uploaded, ${failedCount} failed`);
    } else {
      Logger.log(`[SaveManager] Successfully uploaded ${uploadedCount} assets`);
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
} else {
  window.SaveManager = SaveManager;
}
