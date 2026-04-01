/**
 * Admin Dashboard — Activity metrics for the admin panel.
 * Shows KPI cards, login/project activity chart (Chart.js), and online user count.
 */

let activityChartInstance = null;
let refreshIntervalId = null;

async function fetchApi(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
}

function updateEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
}

async function loadKPICards() {
    try {
        const [stats, userMetrics] = await Promise.all([
            fetchApi(`${API_BASE}/stats`),
            fetchApi(`${API_BASE}/analytics/users`),
        ]);

        updateEl('dash-kpi-total-users', stats.totalUsers);
        updateEl('dash-kpi-active-projects', stats.activeProjects);
        updateEl('dash-kpi-logins-today', userMetrics.dau);
        updateEl('dash-kpi-peak-hour', userMetrics.peakHour != null ? `${userMetrics.peakHour}:00` : '—');
    } catch (err) {
        console.error('[Dashboard] KPI load failed:', err);
    }
}

async function loadActivityChart() {
    try {
        const data = await fetchApi(`${API_BASE}/analytics/activity?days=30`);
        renderActivityChart(data);
    } catch (err) {
        console.error('[Dashboard] Activity chart load failed:', err);
    }
}

function renderActivityChart(data) {
    const canvas = document.getElementById('dash-activity-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const emptyEl = document.getElementById('dash-chart-empty');

    if (activityChartInstance) {
        activityChartInstance.destroy();
        activityChartInstance = null;
    }

    const hasData = data.labels && data.labels.length > 0 &&
        ((data.datasets.logins && data.datasets.logins.some(v => v > 0)) ||
         (data.datasets.projectsCreated && data.datasets.projectsCreated.some(v => v > 0)));

    if (!hasData) {
        canvas.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        return;
    }

    canvas.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';

    activityChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: (typeof T !== 'undefined' && T.logins) || 'Logins',
                    data: data.datasets.logins,
                    borderColor: '#0BA1A1',
                    backgroundColor: 'rgba(11, 161, 161, 0.1)',
                    fill: true,
                    tension: 0.3,
                },
                {
                    label: (typeof T !== 'undefined' && T.projects_created) || 'Projects Created',
                    data: data.datasets.projectsCreated,
                    borderColor: '#059669',
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                    fill: true,
                    tension: 0.3,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
            },
        },
    });
}

async function loadOnlineUsers() {
    const countEl = document.getElementById('dash-online-count');
    if (!countEl) return;

    try {
        const data = await fetchApi(`${API_BASE}/online-users`);
        countEl.textContent = data.count ?? 0;
    } catch (err) {
        console.error('[Dashboard] Online users load failed:', err);
        countEl.textContent = '—';
    }
}

function refreshDashboard() {
    loadKPICards();
    loadActivityChart();
    loadOnlineUsers();
}

function startPolling() {
    if (refreshIntervalId) return;
    refreshIntervalId = setInterval(loadOnlineUsers, 30000);
}

export { fetchApi, updateEl, loadKPICards, loadActivityChart, renderActivityChart, loadOnlineUsers, refreshDashboard, startPolling };

// Init: IIFE since script is loaded at bottom of page (DOM is ready)
(function () {
    const dashSection = document.getElementById('dashboard');
    if (dashSection && dashSection.classList.contains('active')) {
        refreshDashboard();
        startPolling();
    }

    const dashNavLink = document.querySelector('.admin-nav-link[data-section="dashboard"]');
    if (dashNavLink) {
        dashNavLink.addEventListener('click', function () {
            setTimeout(function () {
                refreshDashboard();
                startPolling();
            }, 50);
        });
    }
})();
