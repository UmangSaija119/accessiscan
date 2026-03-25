// ===================================================
// AccessiScan — Dashboard Page
// ===================================================

async function renderDashboardPage() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Overview of your accessibility testing results</p>
    </div>

    <div class="stats-grid" id="stats-grid">
      ${[1, 2, 3, 4].map(() => `
        <div class="stat-card">
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton skeleton-text" style="width:40%; height:28px; margin-top:12px;"></div>
          <div class="skeleton skeleton-text short" style="margin-top:8px;"></div>
        </div>
      `).join('')}
    </div>

    <div class="grid-2">
      <div class="card" id="chart-card">
        <div class="card-header">
          <div>
            <div class="card-title">Score Trend</div>
            <div class="card-subtitle">Last 10 scans</div>
          </div>
        </div>
        <div style="height: 260px; position:relative;">
          <canvas id="score-chart"></canvas>
        </div>
      </div>

      <div class="card" id="severity-card">
        <div class="card-header">
          <div>
            <div class="card-title">Issues by Severity</div>
            <div class="card-subtitle">From latest scan (actual data)</div>
          </div>
        </div>
        <div style="height: 260px; position:relative;">
          <canvas id="severity-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="card mt-6">
      <div class="card-header">
        <div>
          <div class="card-title">Recent Scans</div>
          <div class="card-subtitle">Your latest accessibility audits</div>
        </div>
        <a href="#/scan" class="btn btn-primary btn-sm">
          <i class="fas fa-plus"></i> New Scan
        </a>
      </div>
      <div id="recent-scans-table">
        <div class="skeleton skeleton-rect"></div>
      </div>
    </div>
  `;

  try {
    const [statsData, recentData] = await Promise.all([
      API.getDashboardStats(),
      API.getRecentScans()
    ]);

    renderStats(statsData.stats);
    renderRecentScans(recentData.scans);
    renderCharts(recentData.scans, statsData.severity);
  } catch (err) {
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderStats(stats) {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon blue"><i class="fas fa-radar"></i></div>
      <div class="stat-value">${stats.totalScans}</div>
      <div class="stat-label">Total Scans</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
      <div class="stat-value">${stats.completedScans}</div>
      <div class="stat-label">Completed</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon violet"><i class="fas fa-gauge-high"></i></div>
      <div class="stat-value">${stats.avgScore}<span style="font-size:14px; color:var(--text-secondary)">%</span></div>
      <div class="stat-label">Average Score</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange"><i class="fas fa-exclamation-triangle"></i></div>
      <div class="stat-value">${stats.totalViolations}</div>
      <div class="stat-label">Total Violations</div>
    </div>
  `;
}

function renderRecentScans(scans) {
  const container = document.getElementById('recent-scans-table');

  if (!scans || scans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <h3>No scans yet</h3>
        <p>Start your first accessibility scan to see results here.</p>
        <a href="#/scan" class="btn btn-primary">
          <i class="fas fa-plus"></i> Start a Scan
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>URL</th>
          <th>Score</th>
          <th>Violations</th>
          <th>Status</th>
          <th>Date</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${scans.map(scan => `
          <tr>
            <td><div class="truncate" style="max-width: 280px;" title="${scan.url}">${scan.url}</div></td>
            <td>${createSmallScoreGauge(scan.overall_score || 0)}</td>
            <td><span class="badge badge-critical">${scan.total_violations || 0}</span></td>
            <td>${statusBadge(scan.status)}</td>
            <td>${formatDate(scan.started_at)}</td>
            <td>
              ${scan.status === 'completed' ?
      `<a href="#/report/${scan.id}" class="btn btn-secondary btn-sm">View Report</a>` :
      scan.status === 'scanning' || scan.status === 'crawling' ?
        `<a href="#/scan?active=${scan.id}" class="btn btn-secondary btn-sm">View Progress</a>` : ''
    }
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderCharts(scans, severity) {
  // Score trend chart
  const completedScans = (scans || []).filter(s => s.status === 'completed').reverse();

  if (completedScans.length > 0) {
    const ctx = document.getElementById('score-chart');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: completedScans.map(s => formatDate(s.started_at)),
          datasets: [{
            label: 'Score',
            data: completedScans.map(s => s.overall_score),
            borderColor: '#00c48c',
            backgroundColor: 'rgba(0, 196, 140, 0.08)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#00c48c',
            pointBorderColor: '#00c48c',
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
            x: { grid: { display: false }, ticks: { color: '#64748b', maxRotation: 0 } }
          }
        }
      });
    }
  }

  // Severity chart — uses REAL data from the API, no fake estimates
  const ctx2 = document.getElementById('severity-chart');
  if (ctx2 && severity) {
    new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'Serious', 'Moderate', 'Minor', 'Passes'],
        datasets: [{
          data: [
            severity.critical || 0,
            severity.serious || 0,
            severity.moderate || 0,
            severity.minor || 0,
            severity.passes || 0
          ],
          backgroundColor: ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#00c48c'],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', padding: 14, usePointStyle: true, pointStyleWidth: 8, font: { size: 12 } }
          }
        }
      }
    });
  }
}
