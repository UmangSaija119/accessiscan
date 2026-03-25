// ===================================================
// AccessiScan — Report Page (with AI Summary & Jira Bugs)
// ===================================================

// Store data globally for button handlers
window._reportPages = [];
window._currentPageIdx = 0;
window._jiraBugs = [];

async function renderReportPage(scanId) {
  const content = document.getElementById('page-content');

  content.innerHTML = `
    <div class="page-header flex justify-between items-center">
      <div>
        <h1><i class="fas fa-file-lines" style="color: var(--brand-primary)"></i> Accessibility Report</h1>
        <p>Loading report...</p>
      </div>
      <a href="#/history" class="btn btn-secondary btn-sm"><i class="fas fa-arrow-left"></i> Back</a>
    </div>
    <div class="skeleton skeleton-rect" style="height: 300px;"></div>
  `;

  try {
    const data = await API.getReport(scanId);
    renderFullReport(data, scanId);
  } catch (err) {
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-circle-xmark"></i>
        <h3>Failed to Load Report</h3>
        <p>${err.message}</p>
        <a href="#/history" class="btn btn-secondary">Back to History</a>
      </div>
    `;
  }
}

function renderFullReport(data, scanId) {
  const { scan, pages, summary, executiveSummary, jiraBugs } = data;
  const content = document.getElementById('page-content');

  // Store globally for button handlers
  window._reportPages = pages;
  window._currentPageIdx = 0;
  window._jiraBugs = jiraBugs || [];

  content.innerHTML = `
    <div class="page-header">
      <div class="flex justify-between items-center">
        <div>
          <h1><i class="fas fa-file-lines" style="color: var(--brand-primary)"></i> Accessibility Report</h1>
          <p style="word-break:break-all;">${scan.url}</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" id="btn-pdf">
            <i class="fas fa-file-pdf"></i> PDF
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-csv">
            <i class="fas fa-file-csv"></i> CSV
          </button>
          <a href="#/history" class="btn btn-secondary btn-sm"><i class="fas fa-arrow-left"></i> Back</a>
        </div>
      </div>
    </div>

    <!-- AI Summary -->
    ${executiveSummary ? `
      <div class="executive-summary">
        <div class="summary-badge"><i class="fas fa-robot"></i> AI-Powered Analysis</div>
        ${executiveSummary.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('')}
      </div>
    ` : ''}

    <!-- Score + Stats -->
    <div class="stats-grid" style="grid-template-columns: auto repeat(4, 1fr);">
      <div class="stat-card" style="display:flex; align-items:center; justify-content:center; padding:30px;">
        ${createScoreGauge(scan.overall_score || 0, 160)}
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><i class="fas fa-file"></i></div>
        <div class="stat-value">${scan.pages_scanned || 0}</div>
        <div class="stat-label">Pages Scanned</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="stat-value">${scan.total_violations || 0}</div>
        <div class="stat-label">Violations</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><i class="fas fa-check"></i></div>
        <div class="stat-value">${scan.total_passes || 0}</div>
        <div class="stat-label">Passes</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon violet"><i class="fas fa-question-circle"></i></div>
        <div class="stat-value">${scan.total_incomplete || 0}</div>
        <div class="stat-label">Needs Review</div>
      </div>
    </div>

    <!-- Severity Breakdown (from actual data) -->
    <div class="card mb-6">
      <div class="card-header">
        <div class="card-title">Severity Breakdown (Actual)</div>
      </div>
      <div class="flex gap-3 flex-wrap">
        ${summary.bySeverity ? Object.entries(summary.bySeverity).map(([sev, count]) => `
          <div style="flex:1; min-width:120px; text-align:center; padding:16px; background:var(--bg-tertiary); border-radius:var(--radius-md); border:1px solid var(--border-secondary);">
            <div style="font-size:24px; font-weight:700; color: var(--${sev});">${count}</div>
            <div style="font-size:12px; color:var(--text-secondary); text-transform:capitalize;">${sev}</div>
          </div>
        `).join('') : '<div style="padding:20px; color:var(--text-tertiary);">No data</div>'}
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs" id="report-main-tabs">
      <button class="tab active" data-report-tab="issues">
        <i class="fas fa-exclamation-circle"></i> Issues (${scan.total_violations || 0})
      </button>
      <button class="tab" data-report-tab="jira">
        <i class="fas fa-bug"></i> Jira Bug Reports (${(jiraBugs || []).length})
      </button>
    </div>

    <!-- Issues Tab -->
    <div id="report-tab-issues">
      <div class="card">
        <div class="page-tabs" id="report-page-tabs">
          ${pages.map((page, i) => `
            <button class="page-tab ${i === 0 ? 'active' : ''}" data-page-idx="${i}">
              <span class="truncate" style="max-width:200px;" title="${page.url}">${page.title || safePathname(page.url)}</span>
              <span class="page-tab-score" style="color: ${(page.score || 0) >= 80 ? 'var(--pass)' : (page.score || 0) >= 50 ? 'var(--moderate)' : 'var(--critical)'}">${page.score || 0}</span>
            </button>
          `).join('')}
        </div>

        <div class="filter-bar">
          <select class="form-input" id="filter-severity" style="max-width:150px;">
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="serious">Serious</option>
            <option value="moderate">Moderate</option>
            <option value="minor">Minor</option>
          </select>
          <select class="form-input" id="filter-type" style="max-width:150px;">
            <option value="violations">Violations</option>
            <option value="passes">Passes</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </div>

        <div id="report-issues-list"></div>
      </div>
    </div>

    <!-- Jira Tab -->
    <div id="report-tab-jira" style="display:none;">
      ${renderJiraBugsTab(jiraBugs || [])}
    </div>

    <div class="powered-by">
      Powered by <strong>Astound Digital</strong> · AccessiScan v1.0 · axe-core engine
    </div>
  `;

  // Render first page
  renderPageIssues(0, 'violations', 'all');

  // PDF/CSV buttons
  document.getElementById('btn-pdf').addEventListener('click', function () {
    API.downloadPdf(scanId);
  });
  document.getElementById('btn-csv').addEventListener('click', function () {
    API.downloadCsv(scanId);
  });

  // Main tabs
  document.getElementById('report-main-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    var tabName = tab.getAttribute('data-report-tab');
    var allTabs = document.querySelectorAll('#report-main-tabs .tab');
    for (var i = 0; i < allTabs.length; i++) allTabs[i].classList.remove('active');
    tab.classList.add('active');
    document.getElementById('report-tab-issues').style.display = tabName === 'issues' ? 'block' : 'none';
    document.getElementById('report-tab-jira').style.display = tabName === 'jira' ? 'block' : 'none';
  });

  // Page tabs
  document.getElementById('report-page-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.page-tab');
    if (!tab) return;
    var allTabs = document.querySelectorAll('.page-tab');
    for (var i = 0; i < allTabs.length; i++) allTabs[i].classList.remove('active');
    tab.classList.add('active');
    window._currentPageIdx = parseInt(tab.getAttribute('data-page-idx'));
    renderPageIssues(window._currentPageIdx, document.getElementById('filter-type').value, document.getElementById('filter-severity').value);
  });

  // Filters
  document.getElementById('filter-severity').addEventListener('change', function () {
    renderPageIssues(window._currentPageIdx, document.getElementById('filter-type').value, this.value);
  });
  document.getElementById('filter-type').addEventListener('change', function () {
    renderPageIssues(window._currentPageIdx, this.value, document.getElementById('filter-severity').value);
  });
}

function safePathname(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

function renderJiraBugsTab(jiraBugs) {
  if (!jiraBugs || jiraBugs.length === 0) {
    return `
      <div class="empty-state" style="padding:40px;">
        <i class="fas fa-check-circle" style="color:var(--pass);"></i>
        <h3>No Jira bugs to report</h3>
        <p>No violations were found — great job!</p>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title"><i class="fas fa-bug" style="color:var(--brand-primary);"></i> Jira-Ready Bug Reports</div>
          <div class="card-subtitle">Click "Copy to Clipboard" to paste directly into Jira</div>
        </div>
        <button class="btn btn-primary btn-sm" id="copy-all-bugs-btn">
          <i class="fas fa-copy"></i> Copy All
        </button>
      </div>

      <div id="jira-bugs-list">
        ${jiraBugs.map(function (bug, i) {
    return `
            <div class="jira-bug-card">
              <div class="jira-bug-header">
                <div class="jira-bug-title">${escapeHtml(bug.title)}</div>
                ${severityBadge(bug.impact)}
              </div>
              <div class="jira-bug-preview">${escapeHtml(bug.body.split('\n').slice(0, 3).join(' ').replace(/[#*]/g, '').slice(0, 150))}...</div>
              <div class="jira-bug-actions">
                <button class="copy-btn" data-bug-index="${i}" data-action="copy">
                  <i class="fas fa-copy"></i> Copy to Clipboard
                </button>
                <button class="copy-btn" data-bug-index="${i}" data-action="preview">
                  <i class="fas fa-eye"></i> Preview
                </button>
              </div>
              <pre id="bug-preview-${i}" style="display:none; margin-top:12px; padding:16px; background:rgba(0,0,0,0.3); border:1px solid var(--border-secondary); border-radius:var(--radius-md); font-size:12px; color:var(--text-secondary); white-space:pre-wrap; word-break:break-word; max-height:400px; overflow-y:auto; line-height:1.6;">${escapeHtml(bug.body)}</pre>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
}

// Event delegation for Jira bug buttons — this ensures buttons work
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-action="copy"]');
  if (btn) {
    var idx = parseInt(btn.getAttribute('data-bug-index'));
    var bug = window._jiraBugs[idx];
    if (!bug) return;
    navigator.clipboard.writeText(bug.body).then(function () {
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      btn.classList.add('copied');
      showToast('Bug report copied to clipboard!', 'success');
      setTimeout(function () {
        btn.innerHTML = '<i class="fas fa-copy"></i> Copy to Clipboard';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(function () {
      showToast('Failed to copy — try selecting text manually', 'error');
    });
    return;
  }

  var previewBtn = e.target.closest('[data-action="preview"]');
  if (previewBtn) {
    var previewIdx = parseInt(previewBtn.getAttribute('data-bug-index'));
    var preview = document.getElementById('bug-preview-' + previewIdx);
    if (preview) {
      var isVisible = preview.style.display !== 'none';
      preview.style.display = isVisible ? 'none' : 'block';
      previewBtn.innerHTML = isVisible
        ? '<i class="fas fa-eye"></i> Preview'
        : '<i class="fas fa-eye-slash"></i> Hide';
    }
    return;
  }

  var copyAllBtn = e.target.closest('#copy-all-bugs-btn');
  if (copyAllBtn) {
    var bugs = window._jiraBugs || [];
    if (bugs.length === 0) return;
    var allText = bugs.map(function (b, i) { return '--- Bug ' + (i + 1) + ' ---\n\n' + b.body; }).join('\n\n\n');
    navigator.clipboard.writeText(allText).then(function () {
      showToast('Copied ' + bugs.length + ' bug reports to clipboard!', 'success');
    }).catch(function () {
      showToast('Failed to copy', 'error');
    });
    return;
  }
});

function renderPageIssues(pageIdx, type, severityFilter) {
  type = type || 'violations';
  severityFilter = severityFilter || 'all';
  var container = document.getElementById('report-issues-list');
  var page = window._reportPages[pageIdx];
  if (!page || !page.results) {
    container.innerHTML = '<div class="empty-state"><p>No results for this page</p></div>';
    return;
  }

  var items = page.results[type] || [];
  if (severityFilter !== 'all' && type === 'violations') {
    items = items.filter(function (item) { return item.impact === severityFilter; });
  }

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:40px;"><i class="fas fa-' + (type === 'passes' ? 'check-circle' : 'search') + '"></i><h3>No ' + type + ' found</h3><p>' + (type === 'violations' ? 'Great! No violations at this severity level.' : '') + '</p></div>';
    return;
  }

  container.innerHTML = items.map(function (item) {
    return '<div class="violation-item">' +
      '<div class="violation-header">' +
      '<div class="violation-title">' + escapeHtml(item.help || item.description || '') + '</div>' +
      (item.impact ? severityBadge(item.impact) : '<span class="badge badge-pass"><i class="fas fa-check"></i> Pass</span>') +
      '</div>' +
      '<div class="violation-description">' + escapeHtml(item.description || '') + '</div>' +
      (item.nodes || []).slice(0, 5).map(function (node) {
        return (node.html ? '<div class="violation-code">' + escapeHtml(node.html) + '</div>' : '') +
          (node.failureSummary ? '<div class="violation-fix"><strong>How to fix:</strong> ' + escapeHtml(node.failureSummary) + '</div>' : '');
      }).join('') +
      '<div class="violation-meta">' +
      '<span class="violation-tag">' + (item.id || '') + '</span>' +
      (item.tags || []).filter(function (t) { return t.startsWith('wcag'); }).slice(0, 3).map(function (tag) {
        return '<span class="violation-tag">' + tag + '</span>';
      }).join('') +
      (item.helpUrl ? '<a href="' + item.helpUrl + '" target="_blank" rel="noopener" style="font-size:12px;"><i class="fas fa-external-link-alt"></i> Learn more</a>' : '') +
      '</div>' +
      '</div>';
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
