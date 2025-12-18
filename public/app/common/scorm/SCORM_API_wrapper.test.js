import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('SCORM_API_wrapper.js', () => {
  beforeAll(async () => {
    // Load the script content and evaluate it in the global scope
    const fs = await import('fs');
    const path = await import('path');
    const scriptPath = path.resolve(__dirname, './SCORM_API_wrapper.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // (0, eval) ensures the code is evaluated in the global scope
    (0, eval)(scriptContent);
  });

  beforeEach(() => {
    // Reset pipwerks state before each test
    globalThis.pipwerks.SCORM.version = null;
    globalThis.pipwerks.SCORM.connection.isActive = false;
    globalThis.pipwerks.SCORM.API.handle = null;
    globalThis.pipwerks.SCORM.API.isFound = false;
    
    // Clean up window mocks
    delete window.API;
    delete window.API_1484_11;
  });

  describe('pipwerks.UTILS', () => {
    it('StringToBoolean converts strings to booleans', () => {
      const utils = globalThis.pipwerks.UTILS;
      expect(utils.StringToBoolean('true')).toBe(true);
      expect(utils.StringToBoolean('yes')).toBe(true);
      expect(utils.StringToBoolean('1')).toBe(true);
      expect(utils.StringToBoolean('false')).toBe(false);
      expect(utils.StringToBoolean('no')).toBe(false);
      expect(utils.StringToBoolean('0')).toBe(false);
      expect(utils.StringToBoolean(undefined)).toBe(false);
    });

    it('ZeroPad pads numbers with zeros', () => {
      const utils = globalThis.pipwerks.UTILS;
      expect(utils.ZeroPad(5, 2)).toBe('05');
      expect(utils.ZeroPad(5, 4)).toBe('0005');
      expect(utils.ZeroPad(123, 2)).toBe('12'); // Truncates if too long
    });

    it('convertTotalMiliSecondsSCORM12 formats time correctly', () => {
      const utils = globalThis.pipwerks.UTILS;
      // 1 hour, 2 minutes, 3 seconds, 400ms = 3600000 + 120000 + 3000 + 400 = 3723400
      expect(utils.convertTotalMiliSecondsSCORM12(3723400, true)).toBe('0001:02:03.40');
    });

    it('convertTotalMiliSecondsSCORM2004 formats time correctly', () => {
      const utils = globalThis.pipwerks.UTILS;
      // 1 hour, 2 minutes, 3 seconds = 3723000ms
      // P[n]Y[n]M[n]DT[n]H[n]M[n]S
      expect(utils.convertTotalMiliSecondsSCORM2004(3723000)).toBe('PT1H2M3S');
    });
  });

  describe('pipwerks.SCORM.API.find', () => {
    it('finds SCORM 1.2 API', () => {
      window.API = { name: 'SCORM 1.2 API' };
      const found = globalThis.pipwerks.SCORM.API.find(window);
      expect(found).toBe(window.API);
      expect(globalThis.pipwerks.SCORM.version).toBe('1.2');
    });

    it('finds SCORM 2004 API', () => {
      window.API_1484_11 = { name: 'SCORM 2004 API' };
      const found = globalThis.pipwerks.SCORM.API.find(window);
      expect(found).toBe(window.API_1484_11);
      expect(globalThis.pipwerks.SCORM.version).toBe('2004');
    });
  });

  describe('pipwerks.SCORM.connection', () => {
    it('initialize returns true if connection already active', () => {
      globalThis.pipwerks.SCORM.connection.isActive = true;
      expect(globalThis.pipwerks.SCORM.connection.initialize()).toBe(true);
    });

    it('initialize calls API.LMSInitialize for SCORM 1.2', () => {
      const mockAPI = {
        LMSInitialize: vi.fn(() => 'true'),
        LMSGetValue: vi.fn(() => 'incomplete'),
        LMSGetLastError: vi.fn(() => '0'),
      };
      globalThis.pipwerks.SCORM.version = '1.2';
      vi.spyOn(globalThis.pipwerks.SCORM.API, 'getHandle').mockReturnValue(mockAPI);
      
      const success = globalThis.pipwerks.SCORM.connection.initialize();
      
      expect(mockAPI.LMSInitialize).toHaveBeenCalledWith('');
      expect(success).toBe(true);
      expect(globalThis.pipwerks.SCORM.connection.isActive).toBe(true);
    });
  });
});
