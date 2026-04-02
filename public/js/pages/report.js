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
            <option value="inapplicable">Inapplicable</option>
            <option value="a11ytree">📚 Virtual Screen Reader Transcript</option>
            <option value="taborder">⌨️ Keyboard Navigation Flow</option>
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
  document.getElementById('btn-pdf').addEventListener('click', async function () {
    const btn = this;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
    try {
      await API.downloadPdf(scanId);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  });

  document.getElementById('btn-csv').addEventListener('click', async function () {
    const btn = this;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
    try {
      await API.downloadCsv(scanId);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
      btn.style.opacity = '1';
    }
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
  if (!page) {
    container.innerHTML = '<div class="empty-state"><p>No results for this page</p></div>';
    return;
  }

  // ==========================================
  // [NEW] Virtual Screen Reader Transcript
  // ==========================================
  if (type === 'a11ytree') {
    if (!page.a11y_tree) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-tree" style="font-size:32px; color:var(--text-tertiary); margin-bottom:12px;"></i><p>Virtual Screen Reader Transcript not available for this scan.</p></div>';
      return;
    }
    try {
      var tree = typeof page.a11y_tree === 'string' ? JSON.parse(page.a11y_tree) : page.a11y_tree;

      function renderA11yNode(node, depth = 0) {
        if (!node) return '';
        var padding = depth * 20;
        var role = node.role ? `<span style="color:var(--brand-secondary); font-weight:700;">[${node.role}]</span>` : '';
        var name = node.name ? `<span style="color:var(--pass);">"${node.name}"</span>` : `<span style="color:var(--text-tertiary); font-style:italic;">[nameless]</span>`;
        var state = node.value ? ` <span style="color:var(--warning);">value="${node.value}"</span>` : '';
        var html = `<div style="padding-left:${padding}px; border-left:1px solid var(--border-secondary); margin-left:4px; padding-top:4px; padding-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${role} ${name}${state}
        </div>`;
        if (node.children && node.children.length > 0) {
          html += node.children.map(c => renderA11yNode(c, depth + 1)).join('');
        }
        return html;
      }

      container.innerHTML = `
        <div style="background:var(--bg-secondary); padding:16px; border-radius:8px; margin-bottom:16px; border:1px solid var(--border-color);">
          <h3 style="margin:0 0 8px 0; color:var(--brand-primary);"><i class="fas fa-headphones"></i> Active Accessibility Tree</h3>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">This is exactly what NVDA and VoiceOver "hear" when reading the page. If text or buttons aren't visible here, they are functionally invisible to blind users.</p>
        </div>
        <div class="card" style="font-family:monospace; font-size:12px; font-weight:500; background:var(--bg-primary); padding:20px; border-radius:8px; border:1px solid var(--border-secondary); overflow-x:auto;">
          ${renderA11yNode(tree)}
        </div>
      `;
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><p>Error parsing Screen Reader Transcript.</p></div>';
    }
    return;
  }

  // ==========================================
  // [NEW] Keyboard Navigation Flow & Traps
  // ==========================================
  if (type === 'taborder') {
    if (!page.tab_order) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-keyboard" style="font-size:32px; color:var(--text-tertiary); margin-bottom:12px;"></i><p>Keyboard Navigation Flow not available for this scan.</p></div>';
      return;
    }
    try {
      var flow = typeof page.tab_order === 'string' ? JSON.parse(page.tab_order) : page.tab_order;
      if (!flow || flow.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No keyboard-focusable elements detected.</p></div>';
        return;
      }
      container.innerHTML = `
        <div style="background:var(--bg-secondary); padding:16px; border-radius:8px; margin-bottom:16px; border:1px solid var(--border-color);">
          <h3 style="margin:0 0 8px 0; color:var(--brand-primary);"><i class="fas fa-route"></i> Synthetic Tab Traversal</h3>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">Chronological map of focus order. A <span style="color:white; background:var(--critical); padding:2px 4px; border-radius:2px;">KEYBOARD TRAP</span> occurs when the robot cannot escape a component after 3 consecutive Tabs.</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${flow.map((node, i) => {
        var trapTag = node.isTrap ? '<span style="background:var(--critical); color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:8px;"><i class="fas fa-lock"></i> KEYBOARD TRAP DETECTED</span>' : '';
        var style = node.isTrap ? 'border-left: 3px solid var(--critical); background:rgba(239,68,68,0.05);' : 'border-left: 3px solid var(--accent-blue); background:var(--bg-secondary);';
        return \`<div class="card" style="padding:12px; \${style} margin-bottom:0px;">
              <div style="font-size:11px; color:var(--text-tertiary); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                <div><i class="fas fa-arrow-down" style="font-size:10px; opacity:0.5; margin-right:4px;"></i> Tab Event \${i+1} \${trapTag}</div>
                \${node.href ? \`<span style="color:var(--brand-primary);"><i class="fas fa-link"></i> \${escapeHtml(node.href)}</span>\` : ''}
              </div>
              <div style="font-weight:600; color:var(--text-primary); margin-bottom:6px;"><span style="color:var(--brand-secondary);">&lt;\${node.tag}&gt;</span> \${escapeHtml(node.text) || '<em>[No accessible text]</em>'}</div>
              <div style="font-family:monospace; font-size:10px; color:var(--text-secondary); background:var(--bg-primary); padding:6px; border-radius:4px; border:1px solid var(--border-color); overflow-x:auto;">\${escapeHtml(node.html)}</div>
            </div>\`;
          }).join('')}
        </div>
      `;
      } catch (e) {
        container.innerHTML = '<div class="empty-state"><p>Error parsing Keyboard Flow.</p></div>';
      }
      return;
    }

  // ==========================================
  // Standard Axe-Core Results Fallback
  // ==========================================
  var items = page.results ? (page.results[type] || []) : [];
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
