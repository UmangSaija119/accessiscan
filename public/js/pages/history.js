// ===================================================
// AccessiScan — History Page
// ===================================================

let historyPage = 1;

async function renderHistoryPage() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header flex justify-between items-center">
      <div>
        <h1>Scan History</h1>
        <p>View and manage all your accessibility scans</p>
      </div>
      <a href="#/scan" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> New Scan</a>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title" id="history-count">Loading...</div>
        <div class="flex gap-2">
          <select id="history-status-filter" class="form-input" style="max-width:160px;padding:8px 12px;">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="scanning">In Progress</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div id="history-table-container" class="table-responsive">
        <div class="skeleton skeleton-rect"></div>
      </div>

      <div id="history-pagination" class="flex justify-between items-center mt-4" style="display:none;">
        <button id="prev-page" class="btn btn-secondary btn-sm" disabled>
          <i class="fas fa-chevron-left"></i> Previous
        </button>
        <span id="page-info" style="font-size:13px; color:var(--text-secondary);"></span>
        <button id="next-page" class="btn btn-secondary btn-sm">
          Next <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  `;

  historyPage = 1;
  await loadHistory();

  const statusFilter = document.getElementById('history-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      historyPage = 1;
      loadHistory();
    });
  }

  // Event delegation for table actions
  const tableContainer = document.getElementById('history-table-container');
  if (tableContainer) {
    tableContainer.addEventListener('click', async (e) => {
      const downloadBtn = e.target.closest('.download-pdf-btn');
      if (downloadBtn) {
        e.preventDefault();
        const scanId = downloadBtn.dataset.id;
        const icon = downloadBtn.querySelector('i');
        icon.className = 'fas fa-spinner fa-spin'; // Show loading state
        try {
          await API.downloadPdf(scanId);
        } finally {
          icon.className = 'fas fa-download'; // Restore icon
        }
      }
    });
  }
}

async function loadHistory() {
  try {
    const data = await API.getHistory(historyPage, 20);
    const statusFilter = document.getElementById('history-status-filter')?.value || 'all';

    let scans = data.scans || [];
    if (statusFilter !== 'all') {
      scans = scans.filter(s => s.status === statusFilter);
    }

    document.getElementById('history-count').textContent = `${data.pagination.total} Total Scans`;
    renderHistoryTable(scans);

    // Pagination
    const pagination = document.getElementById('history-pagination');
    if (data.pagination.totalPages > 1) {
      pagination.style.display = 'flex';
      document.getElementById('page-info').textContent = `Page ${data.pagination.page} of ${data.pagination.totalPages}`;

      const prevBtn = document.getElementById('prev-page');
      const nextBtn = document.getElementById('next-page');
      prevBtn.disabled = data.pagination.page <= 1;
      nextBtn.disabled = data.pagination.page >= data.pagination.totalPages;

      prevBtn.onclick = () => { historyPage--; loadHistory(); };
      nextBtn.onclick = () => { historyPage++; loadHistory(); };
    }
  } catch (err) {
    showToast('Failed to load history', 'error');
  }
}

function renderHistoryTable(scans) {
  const container = document.getElementById('history-table-container');

  if (!scans || scans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-clock-rotate-left"></i>
        <h3>No scans found</h3>
        <p>Start a scan to see your history here.</p>
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
          <th>Pages</th>
          <th>WCAG Level</th>
          <th>Status</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${scans.map(scan => `
          <tr>
            <td><div class="truncate" style="max-width:220px;" title="${scan.url}">${scan.url}</div></td>
            <td>${scan.status === 'completed' ? createSmallScoreGauge(scan.overall_score || 0) : '—'}</td>
            <td>${scan.status === 'completed' ? `<span class="badge badge-critical">${scan.total_violations || 0}</span>` : '—'}</td>
            <td>${scan.pages_scanned || 0}</td>
            <td><span class="badge badge-info">${(scan.wcag_level || '').toUpperCase()}</span></td>
            <td>
              ${statusBadge(scan.status)}
              ${scan.status === 'failed' && scan.error_message ? `<div style="font-size:11px; color:#ff4d4d; margin-top:4px; max-width: 150px;" title="${scan.error_message}">${scan.error_message}</div>` : ''}
            </td>
            <td style="white-space:nowrap;">
              <div>${formatDate(scan.started_at)}</div>
              <div style="font-size:11px;color:var(--text-tertiary);">${formatTime(scan.started_at)}</div>
            </td>
            <td>
              <div class="flex gap-2">
                ${scan.status === 'completed' ? `
                  <a href="#/report/${scan.id}" class="btn btn-secondary btn-sm" title="View Report">
                    <i class="fas fa-file-lines"></i>
                  </a>
                  <button class="btn btn-secondary btn-sm download-pdf-btn" data-id="${scan.id}" title="Download PDF">
                    <i class="fas fa-download"></i>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
