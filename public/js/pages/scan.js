// ===================================================
// AccessiScan — Scan Page
// ===================================================

let activeScanSubscription = null;

function renderScanPage() {
    const content = document.getElementById('page-content');

    // Check if we have an active scan from URL params
    const hash = window.location.hash;
    const activeMatch = hash.match(/active=([^&]+)/);

    content.innerHTML = `
    <div class="page-header">
      <h1><i class="fas fa-search" style="color: var(--accent-blue)"></i> New Accessibility Scan</h1>
      <p>Enter a website URL to run a comprehensive WCAG accessibility audit</p>
    </div>

    <div class="grid-2">
      <div class="card" id="scan-form-card">
        <div class="card-header">
          <div class="card-title">Scan Configuration</div>
        </div>

        <form id="scan-form">
          <div class="form-group">
            <label for="scan-url">Website URL</label>
            <div class="form-input-icon">
              <i class="fas fa-globe"></i>
              <input type="url" id="scan-url" class="form-input" placeholder="https://example.com" required>
            </div>
          </div>

          <div class="form-group">
            <label for="scan-wcag">WCAG Compliance Level</label>
            <select id="scan-wcag" class="form-input">
              <option value="wcag2a">WCAG 2.0 Level A</option>
              <option value="wcag2aa" selected>WCAG 2.0 Level AA (Recommended)</option>
              <option value="wcag2aaa">WCAG 2.0 Level AAA</option>
              <option value="wcag21aa">WCAG 2.1 Level AA</option>
              <option value="wcag21aaa">WCAG 2.1 Level AAA</option>
              <option value="wcag22aa">WCAG 2.2 Level AA</option>
            </select>
          </div>

          <div class="form-group">
            <label for="scan-pages">Max Pages to Scan: <span id="pages-value">10</span></label>
            <input type="range" id="scan-pages" class="form-input" min="1" max="30" value="10" 
              style="padding: 8px 0; background: transparent; border: none;">
          </div>

          <button type="submit" id="scan-submit" class="btn btn-primary btn-full btn-lg">
            <i class="fas fa-play"></i> Start Scan
          </button>
        </form>

        <div class="mt-6" style="border-top: 1px solid var(--border-secondary); padding-top: 20px;">
          <div class="card-title mb-4">Batch Scan</div>
          <div class="form-group">
            <label for="batch-urls">Enter URLs (one per line)</label>
            <textarea id="batch-urls" class="form-input" rows="4" placeholder="https://example.com&#10;https://another-site.com"></textarea>
          </div>
          <button id="batch-submit" class="btn btn-secondary btn-full">
            <i class="fas fa-layer-group"></i> Start Batch Scan
          </button>
        </div>
      </div>

      <div id="scan-progress-container">
        <div class="card">
          <div class="card-header">
            <div class="card-title">What We Test</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${[
            { icon: 'fa-palette', label: 'Color Contrast', desc: 'WCAG contrast ratios' },
            { icon: 'fa-image', label: 'Alt Text', desc: 'Image descriptions' },
            { icon: 'fa-heading', label: 'Heading Hierarchy', desc: 'Logical heading structure' },
            { icon: 'fa-code', label: 'ARIA Attributes', desc: 'Roles, states, properties' },
            { icon: 'fa-keyboard', label: 'Keyboard Access', desc: 'Focus order & navigation' },
            { icon: 'fa-list', label: 'Form Labels', desc: 'Input labels & fieldsets' },
            { icon: 'fa-link', label: 'Link Text', desc: 'Descriptive link content' },
            { icon: 'fa-table', label: 'Tables', desc: 'Headers & structure' },
            { icon: 'fa-language', label: 'Language', desc: 'Document language attributes' },
            { icon: 'fa-video', label: 'Multimedia', desc: 'Captions & alternatives' }
        ].map(item => `
              <div class="flex items-center gap-3" style="padding: 8px 0; border-bottom: 1px solid var(--border-secondary);">
                <div style="width:32px; height:32px; background:var(--gradient-subtle); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center;">
                  <i class="fas ${item.icon}" style="font-size:13px; color:var(--accent-blue);"></i>
                </div>
                <div>
                  <div style="font-size:13px; font-weight:600;">${item.label}</div>
                  <div style="font-size:11px; color:var(--text-tertiary);">${item.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

    // Event listeners
    document.getElementById('scan-pages').addEventListener('input', (e) => {
        document.getElementById('pages-value').textContent = e.target.value;
    });

    document.getElementById('scan-form').addEventListener('submit', handleStartScan);
    document.getElementById('batch-submit').addEventListener('click', handleBatchScan);

    // If there's an active scan, show progress
    if (activeMatch) {
        showScanProgress(activeMatch[1]);
    }
}

async function handleStartScan(e) {
    e.preventDefault();
    const btn = document.getElementById('scan-submit');
    const url = document.getElementById('scan-url').value.trim();
    const wcagLevel = document.getElementById('scan-wcag').value;
    const maxPages = parseInt(document.getElementById('scan-pages').value);

    if (!url) {
        showToast('Please enter a URL', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Starting scan...';

    try {
        const data = await API.startScan(url, wcagLevel, maxPages);
        showToast('Scan started!', 'success');
        showScanProgress(data.scanId);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Start Scan';
    }
}

async function handleBatchScan() {
    const btn = document.getElementById('batch-submit');
    const text = document.getElementById('batch-urls').value.trim();
    const urls = text.split('\n').map(u => u.trim()).filter(u => u);

    if (urls.length === 0) {
        showToast('Please enter at least one URL', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Starting...';

    try {
        const data = await API.startBatchScan(urls);
        showToast(`Started ${data.scans.length} scans!`, 'success');
        setTimeout(() => { window.location.hash = '#/history'; }, 1500);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-layer-group"></i> Start Batch Scan';
    }
}

function showScanProgress(scanId) {
    const container = document.getElementById('scan-progress-container');

    container.innerHTML = `
    <div class="scan-progress" id="progress-panel">
      <div class="scanning-animation">
        <div class="scanning-ring"></div>
      </div>
      <h3 id="progress-title">Scanning...</h3>
      <div class="scan-status-text" id="progress-message">Initializing scan...</div>
      <div class="progress-bar" style="margin: 20px 0;">
        <div class="progress-bar-fill" id="progress-fill" style="width: 0%"></div>
      </div>
      <div class="scan-stats-row">
        <div class="scan-stat">
          <div class="scan-stat-value" id="progress-pages">0/0</div>
          <div class="scan-stat-label">Pages</div>
        </div>
        <div class="scan-stat">
          <div class="scan-stat-value" id="progress-violations" style="color: var(--critical)">0</div>
          <div class="scan-stat-label">Violations</div>
        </div>
        <div class="scan-stat">
          <div class="scan-stat-value" id="progress-score" style="color: var(--text-secondary)">—</div>
          <div class="scan-stat-label">Score</div>
        </div>
      </div>
      <button id="cancel-scan-btn" class="btn btn-danger btn-sm mt-6" onclick="handleCancelScan('${scanId}')">
        <i class="fas fa-stop"></i> Cancel Scan
      </button>
    </div>
  `;

    // Subscribe to SSE progress
    if (activeScanSubscription) activeScanSubscription.cancel();

    activeScanSubscription = API.subscribeScanProgress(scanId, (data) => {
        updateProgress(scanId, data);
    });
}

function updateProgress(scanId, data) {
    const fill = document.getElementById('progress-fill');
    const title = document.getElementById('progress-title');
    const message = document.getElementById('progress-message');
    const pages = document.getElementById('progress-pages');
    const violations = document.getElementById('progress-violations');
    const score = document.getElementById('progress-score');

    if (!fill) return;

    if (data.pagesTotal && data.pagesScanned !== undefined) {
        const pct = Math.round((data.pagesScanned / data.pagesTotal) * 100);
        fill.style.width = `${pct}%`;
        pages.textContent = `${data.pagesScanned}/${data.pagesTotal}`;
    }

    if (data.message) message.textContent = data.message;
    if (data.violations !== undefined) violations.textContent = data.violations;

    if (data.phase === 'crawling') {
        title.textContent = 'Discovering Pages...';
    } else if (data.phase === 'scanning') {
        title.textContent = 'Scanning...';
    }

    if (data.phase === 'completed') {
        title.textContent = 'Scan Complete!';
        fill.style.width = '100%';
        if (data.overallScore !== undefined) score.textContent = data.overallScore;

        const panel = document.getElementById('progress-panel');
        const cancelBtn = document.getElementById('cancel-scan-btn');
        if (cancelBtn) cancelBtn.remove();

        const scanAnim = panel.querySelector('.scanning-animation');
        if (scanAnim) {
            scanAnim.innerHTML = '<i class="fas fa-check-circle" style="font-size: 48px; color: var(--pass);"></i>';
        }

        // Add view report button
        const btnRow = document.createElement('div');
        btnRow.className = 'mt-6';
        btnRow.innerHTML = `<a href="#/report/${scanId}" class="btn btn-primary btn-lg">
      <i class="fas fa-file-lines"></i> View Full Report
    </a>`;
        panel.appendChild(btnRow);

        if (activeScanSubscription) {
            activeScanSubscription.cancel();
            activeScanSubscription = null;
        }
    }

    if (data.phase === 'error' || data.phase === 'cancelled') {
        title.textContent = data.phase === 'error' ? 'Scan Failed' : 'Scan Cancelled';
        const scanAnim = document.querySelector('.scanning-animation');
        if (scanAnim) {
            scanAnim.innerHTML = `<i class="fas fa-${data.phase === 'error' ? 'circle-xmark' : 'ban'}" style="font-size: 48px; color: var(--critical);"></i>`;
        }
        const cancelBtn = document.getElementById('cancel-scan-btn');
        if (cancelBtn) cancelBtn.remove();

        if (activeScanSubscription) {
            activeScanSubscription.cancel();
            activeScanSubscription = null;
        }
    }
}

async function handleCancelScan(scanId) {
    try {
        await API.cancelScan(scanId);
        showToast('Scan cancellation requested', 'info');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
