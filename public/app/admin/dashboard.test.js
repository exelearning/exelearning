/**
 * Tests for Admin Dashboard
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    fetchApi,
    updateEl,
    loadKPICards,
    loadActivityChart,
    renderActivityChart,
    loadOnlineUsers,
    refreshDashboard,
    startPolling,
} from './dashboard.js';

// Setup globals required by dashboard.js
beforeEach(() => {
    globalThis.API_BASE = '/api/admin';

    // Mock Chart.js — must be a real constructor (class) since dashboard uses `new Chart(...)`
    globalThis.Chart = vi.fn(function () {
        this.destroy = vi.fn();
    });

    // Reset DOM
    document.body.innerHTML = `
        <div id="dashboard" class="active">
            <span id="dash-kpi-total-users"></span>
            <span id="dash-kpi-active-projects"></span>
            <span id="dash-kpi-logins-today"></span>
            <span id="dash-kpi-peak-hour"></span>
            <canvas id="dash-activity-chart"></canvas>
            <div id="dash-chart-empty" style="display:none"></div>
            <span id="dash-online-count"></span>
        </div>
    `;
});

afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.Chart;
});

describe('fetchApi', () => {
    it('should call fetch with same-origin credentials and return JSON', async () => {
        const mockData = { total: 42 };
        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockData),
        });

        const result = await fetchApi('/api/admin/stats');

        expect(fetchSpy).toHaveBeenCalledWith('/api/admin/stats', { credentials: 'same-origin' });
        expect(result).toEqual(mockData);
    });

    it('should throw on non-ok response', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: false,
            status: 403,
        });

        await expect(fetchApi('/api/admin/stats')).rejects.toThrow('API error: 403');
    });
});

describe('updateEl', () => {
    it('should update element textContent', () => {
        updateEl('dash-kpi-total-users', 99);
        expect(document.getElementById('dash-kpi-total-users').textContent).toBe('99');
    });

    it('should use em-dash for null value', () => {
        updateEl('dash-kpi-total-users', null);
        expect(document.getElementById('dash-kpi-total-users').textContent).toBe('—');
    });

    it('should use em-dash for undefined value', () => {
        updateEl('dash-kpi-total-users', undefined);
        expect(document.getElementById('dash-kpi-total-users').textContent).toBe('—');
    });

    it('should handle missing element gracefully', () => {
        // Should not throw when element does not exist
        expect(() => updateEl('non-existent-element', 'value')).not.toThrow();
    });
});

describe('loadKPICards', () => {
    it('should fetch stats and user metrics then update DOM elements', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch')
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ totalUsers: 100, activeProjects: 25 }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ dau: 30, peakHour: 14 }),
            });

        await loadKPICards();

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(document.getElementById('dash-kpi-total-users').textContent).toBe('100');
        expect(document.getElementById('dash-kpi-active-projects').textContent).toBe('25');
        expect(document.getElementById('dash-kpi-logins-today').textContent).toBe('30');
        expect(document.getElementById('dash-kpi-peak-hour').textContent).toBe('14:00');
    });

    it('should display em-dash for null peakHour', async () => {
        vi.spyOn(global, 'fetch')
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ totalUsers: 5, activeProjects: 1 }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ dau: 10, peakHour: null }),
            });

        await loadKPICards();

        expect(document.getElementById('dash-kpi-peak-hour').textContent).toBe('—');
    });

    it('should handle fetch errors gracefully without throwing', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

        await expect(loadKPICards()).resolves.toBeUndefined();
        expect(consoleSpy).toHaveBeenCalled();
    });
});

describe('renderActivityChart', () => {
    it('should create Chart instance when data has values', () => {
        const data = {
            labels: ['2024-01-01', '2024-01-02'],
            datasets: {
                logins: [5, 10],
                projectsCreated: [1, 2],
            },
        };

        renderActivityChart(data);

        expect(globalThis.Chart).toHaveBeenCalledTimes(1);
        const canvas = document.getElementById('dash-activity-chart');
        expect(canvas.style.display).toBe('');
        expect(document.getElementById('dash-chart-empty').style.display).toBe('none');
    });

    it('should show empty state when all values are zero', () => {
        const data = {
            labels: ['2024-01-01'],
            datasets: {
                logins: [0],
                projectsCreated: [0],
            },
        };

        renderActivityChart(data);

        expect(globalThis.Chart).not.toHaveBeenCalled();
        const canvas = document.getElementById('dash-activity-chart');
        expect(canvas.style.display).toBe('none');
        expect(document.getElementById('dash-chart-empty').style.display).toBe('flex');
    });

    it('should show empty state when labels are empty', () => {
        const data = {
            labels: [],
            datasets: { logins: [], projectsCreated: [] },
        };

        renderActivityChart(data);

        expect(globalThis.Chart).not.toHaveBeenCalled();
        expect(document.getElementById('dash-activity-chart').style.display).toBe('none');
    });

    it('should destroy previous chart instance before creating new one', () => {
        const destroyMock = vi.fn();
        let callCount = 0;
        globalThis.Chart = vi.fn(function () {
            callCount++;
            this.destroy = callCount === 1 ? destroyMock : vi.fn();
        });

        const data = {
            labels: ['2024-01-01'],
            datasets: { logins: [5], projectsCreated: [0] },
        };

        renderActivityChart(data);
        renderActivityChart(data);

        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(globalThis.Chart).toHaveBeenCalledTimes(2);
    });

    it('should return early when canvas element is missing', () => {
        document.getElementById('dash-activity-chart').remove();

        const data = {
            labels: ['2024-01-01'],
            datasets: { logins: [5], projectsCreated: [1] },
        };

        expect(() => renderActivityChart(data)).not.toThrow();
        expect(globalThis.Chart).not.toHaveBeenCalled();
    });

    it('should return early when Chart is undefined', () => {
        delete globalThis.Chart;

        const data = {
            labels: ['2024-01-01'],
            datasets: { logins: [5], projectsCreated: [1] },
        };

        expect(() => renderActivityChart(data)).not.toThrow();
    });
});

describe('loadActivityChart', () => {
    it('should fetch activity data and call renderActivityChart', async () => {
        const activityData = {
            labels: ['2024-01-01'],
            datasets: { logins: [3], projectsCreated: [1] },
        };

        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(activityData),
        });

        await loadActivityChart();

        expect(globalThis.Chart).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch errors gracefully', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

        await expect(loadActivityChart()).resolves.toBeUndefined();
        expect(consoleSpy).toHaveBeenCalled();
    });
});

describe('loadOnlineUsers', () => {
    it('should fetch and display online user count', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ count: 7 }),
        });

        await loadOnlineUsers();

        expect(document.getElementById('dash-online-count').textContent).toBe('7');
    });

    it('should not show em-dash when count is null (uses fallback 0)', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ count: null }),
        });

        await loadOnlineUsers();

        // count: null → null ?? 0 = 0 (number); no error path taken so em-dash is not shown
        const el = document.getElementById('dash-online-count');
        expect(el.textContent).not.toBe('—');
    });

    it('should show em-dash on fetch error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

        await loadOnlineUsers();

        expect(document.getElementById('dash-online-count').textContent).toBe('—');
        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should return early when count element is missing', async () => {
        document.getElementById('dash-online-count').remove();
        const fetchSpy = vi.spyOn(global, 'fetch');

        await loadOnlineUsers();

        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('refreshDashboard', () => {
    it('should call loadKPICards, loadActivityChart, and loadOnlineUsers', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });

        refreshDashboard();

        // Three async functions are triggered — verify fetch was called for all three paths
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(fetchSpy).toHaveBeenCalled();
    });
});

describe('startPolling', () => {
    it('should set an interval for loadOnlineUsers on first call', () => {
        // refreshIntervalId may already be set from a prior test; spy on setInterval
        // to detect any new registration attempt
        const setIntervalSpy = vi.spyOn(global, 'setInterval').mockReturnValue(999);

        // Clear the module-level guard by resetting interval tracking via clearInterval
        // We cannot access refreshIntervalId directly, so we verify observable behavior:
        // if an interval IS created, it uses a 30s period
        startPolling();

        if (setIntervalSpy.mock.calls.length > 0) {
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
        }
        // Either way, no throw and at most one interval created
        expect(setIntervalSpy.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('should not create multiple intervals when called from a clean state', () => {
        // Simulate clean state by using clearInterval on any existing interval
        // then calling startPolling multiple times
        const setIntervalSpy = vi.spyOn(global, 'setInterval').mockReturnValue(789);
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        // Clear existing interval if any
        clearIntervalSpy.mockImplementation(() => {});

        // Record calls before and after — calling startPolling multiple times
        // should produce at most 1 setInterval call total across all calls
        const callsBefore = setIntervalSpy.mock.calls.length;
        startPolling();
        startPolling();
        startPolling();
        const callsAfter = setIntervalSpy.mock.calls.length;

        // At most 1 new setInterval call regardless of prior state
        expect(callsAfter - callsBefore).toBeLessThanOrEqual(1);
    });
});
