import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('SCOFunctions.js', () => {
  beforeAll(async () => {
    const fs = await import('fs');
    const path = await import('path');
    
    // Load both files because SCOFunctions depends on pipwerks
    const wrapperPath = path.resolve(__dirname, './SCORM_API_wrapper.js');
    const functionsPath = path.resolve(__dirname, './SCOFunctions.js');
    
    const wrapperContent = fs.readFileSync(wrapperPath, 'utf8');
    const functionsContent = fs.readFileSync(functionsPath, 'utf8');
    
    (0, eval)(wrapperContent);
    (0, eval)(functionsContent);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the scorm object methods - these are globally defined now
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
    globalThis.pipwerks.SCORM.version = '1.2';
    
    // Mock API handle for UTILS.convertTotalMiliSeconds
    vi.spyOn(globalThis.pipwerks.SCORM.API, 'getHandle').mockReturnValue({
      LMSGetValue: vi.fn(),
    });
  });

  describe('loadPage', () => {
    it('initializes scorm and sets status if not attempted', () => {
      globalThis.loadPage();
      
      expect(globalThis.pipwerks.SCORM.init).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('unknown');
      expect(globalThis.pipwerks.SCORM.SetSuccessStatus).toHaveBeenCalledWith('unknown');
      expect(globalThis.exitPageStatus).toBe(false);
    });
  });

  describe('computeTime', () => {
    it('sets session time based on start date', () => {
      globalThis.startDate = new Date().getTime() - 10000; // 10 seconds ago
      
      globalThis.computeTime();
      
      expect(globalThis.pipwerks.SCORM.SetSessionTime).toHaveBeenCalled();
      const callArg = globalThis.pipwerks.SCORM.SetSessionTime.mock.calls[0][0];
      expect(callArg).toMatch(/\d{4}:\d{2}:\d{2}/); // Matches SCORM 1.2 time format by default
    });
  });

  describe('doContinue', () => {
    it('sets completion status and saves/quits', () => {
      globalThis.doContinue('completed');
      
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('completed');
      expect(globalThis.pipwerks.SCORM.save).toHaveBeenCalled();
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
      expect(globalThis.exitPageStatus).toBe(true);
    });
  });

  describe('unloadPage', () => {
    it('does nothing if exitPageStatus is already true', () => {
      globalThis.exitPageStatus = true;
      globalThis.unloadPage();
      
      expect(globalThis.pipwerks.SCORM.quit).not.toHaveBeenCalled();
    });

    it('sets status to completed if not SCORM and exitPageStatus is false', () => {
      globalThis.exitPageStatus = false;
      globalThis.pipwerks.SCORM.GetSuccessStatus.mockReturnValue('unknown');
      
      globalThis.unloadPage(false);
      
      expect(globalThis.pipwerks.SCORM.SetCompletionStatus).toHaveBeenCalledWith('completed');
      expect(globalThis.pipwerks.SCORM.quit).toHaveBeenCalled();
    });
  });
});
