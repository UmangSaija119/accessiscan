// AccessiScan Extension — Popup Script
document.addEventListener('DOMContentLoaded', function () {
    const scanBtn = document.getElementById('scan-btn');
    const wcagSelect = document.getElementById('wcag-select');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('status-text');
    const resultsSection = document.getElementById('results-section');
    const scanningSection = document.getElementById('scanning-section');
    const scoreSection = document.getElementById('score-section');
    const statsRow = document.getElementById('stats-row');
    const violationsList = document.getElementById('violations-list');
    const violationsCount = document.getElementById('violations-count');
    const toggleOverlayBtn = document.getElementById('toggle-overlay-btn');
    const copyReportBtn = document.getElementById('copy-report-btn');

    let lastResults = null;

    scanBtn.addEventListener('click', async function () {
        scanBtn.disabled = true;
        resultsSection.style.display = 'none';
        scanningSection.style.display = 'block';
        statusDot.className = 'status-dot scanning';
        statusText.textContent = 'Scanning...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) throw new Error('No active tab');

            // Inject axe-core
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['lib/axe.min.js']
            });

            // Run scan
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: runAxeScan,
                args: [wcagSelect.value]
            });

            const scanResults = results[0]?.result;
            if (!scanResults) throw new Error('No results returned');

            lastResults = scanResults;

            // Store results
            chrome.storage.local.set({ lastScan: { url: tab.url, results: scanResults, timestamp: Date.now() } });

            // Update badge
            const violCount = scanResults.violations?.length || 0;
            chrome.action.setBadgeText({ text: violCount > 0 ? String(violCount) : '✓' });
            chrome.action.setBadgeBackgroundColor({ color: violCount > 0 ? '#ef4444' : '#00c48c' });

            renderResults(scanResults);
        } catch (err) {
            statusDot.className = 'status-dot error';
            statusText.textContent = 'Error: ' + err.message;
            scanningSection.style.display = 'none';
        } finally {
            scanBtn.disabled = false;
        }
    });

    toggleOverlayBtn.addEventListener('click', async function () {
        if (!lastResults) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: toggleOverlay,
            args: [lastResults.violations || []]
        });
    });

    copyReportBtn.addEventListener('click', function () {
        if (!lastResults) return;
        const report = generateTextReport(lastResults);
        navigator.clipboard.writeText(report).then(function () {
            copyReportBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(function () {
                copyReportBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Report';
            }, 2000);
        });
    });

    function renderResults(results) {
        scanningSection.style.display = 'none';
        resultsSection.style.display = 'block';
        statusDot.className = 'status-dot done';

        const violations = results.violations || [];
        const passes = results.passes || [];
        const incomplete = results.incomplete || [];
        const total = violations.length + passes.length + incomplete.length;
        const score = total > 0 ? Math.round((passes.length / total) * 100) : 100;

        statusText.textContent = violations.length === 0 ? 'No violations found!' : violations.length + ' violation(s) found';

        // Score
        const scoreColor = score >= 80 ? '#00c48c' : score >= 50 ? '#eab308' : '#ef4444';
        scoreSection.innerHTML = `
      <div class="score-circle" style="border-color:${scoreColor}; color:${scoreColor};">${score}</div>
      <div class="score-label">Accessibility Score</div>
    `;

        // Severity counts
        const severity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        for (const v of violations) { severity[v.impact || 'minor'] = (severity[v.impact || 'minor'] || 0) + 1; }

        statsRow.innerHTML = Object.entries(severity).map(function (entry) {
            return '<div class="stat-item ' + entry[0] + '"><div class="val">' + entry[1] + '</div><div class="lbl">' + entry[0] + '</div></div>';
        }).join('');

        // Violations
        violationsCount.textContent = violations.length;
        violationsList.innerHTML = violations.length === 0
            ? '<div style="padding:24px;text-align:center;color:#64748b;font-size:13px;"><i class="fas fa-check-circle" style="color:#00c48c;font-size:24px;display:block;margin-bottom:8px;"></i>All checks passed!</div>'
            : violations.map(function (v) {
                return '<div class="violation-item">' +
                    '<div class="v-header">' +
                    '<div class="v-title">' + escapeHtml(v.help || '') + '</div>' +
                    '<span class="v-impact ' + (v.impact || 'minor') + '">' + (v.impact || 'minor') + '</span>' +
                    '</div>' +
                    '<div class="v-desc">' + escapeHtml(v.description || '') + '</div>' +
                    '<div class="v-count">' + (v.nodes?.length || 0) + ' element(s) affected</div>' +
                    '</div>';
            }).join('');
    }

    function generateTextReport(results) {
        const violations = results.violations || [];
        const passes = results.passes || [];
        let report = '# AccessiScan Accessibility Report\n';
        report += '## Generated by Astound Digital\n\n';
        report += '- Violations: ' + violations.length + '\n';
        report += '- Passes: ' + passes.length + '\n';
        report += '- Incomplete: ' + (results.incomplete?.length || 0) + '\n\n';

        if (violations.length > 0) {
            report += '## Violations\n\n';
            violations.forEach(function (v, i) {
                report += '### ' + (i + 1) + '. ' + v.help + '\n';
                report += '- **Impact**: ' + (v.impact || 'unknown') + '\n';
                report += '- **Description**: ' + v.description + '\n';
                report += '- **Rule ID**: ' + v.id + '\n';
                report += '- **Elements affected**: ' + (v.nodes?.length || 0) + '\n';
                if (v.nodes && v.nodes.length > 0) {
                    report += '- **HTML**: `' + (v.nodes[0].html || '').slice(0, 200) + '`\n';
                    if (v.nodes[0].failureSummary) report += '- **Fix**: ' + v.nodes[0].failureSummary + '\n';
                }
                report += '\n';
            });
        }
        return report;
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    // Load last results if available
    chrome.storage.local.get('lastScan', function (data) {
        if (data.lastScan && data.lastScan.results) {
            lastResults = data.lastScan.results;
        }
    });
});

// This function runs in the page context
function runAxeScan(wcagLevel) {
    return new Promise(function (resolve, reject) {
        if (typeof axe === 'undefined') { reject(new Error('axe-core not loaded')); return; }
        var tagMap = {
            'wcag2a': ['wcag2a'],
            'wcag2aa': ['wcag2a', 'wcag2aa'],
            'wcag2aaa': ['wcag2a', 'wcag2aa', 'wcag2aaa'],
            'wcag21aa': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
            'wcag22aa': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
        };
        axe.run(document, { runOnly: { type: 'tag', values: tagMap[wcagLevel] || ['wcag2a', 'wcag2aa'] } })
            .then(resolve).catch(reject);
    });
}

// This function runs in the page context
function toggleOverlay(violations) {
    var existing = document.getElementById('accessiscan-overlay');
    if (existing) { existing.remove(); return; }

    var overlay = document.createElement('div');
    overlay.id = 'accessiscan-overlay';

    var style = document.createElement('style');
    style.textContent = `
    .accessiscan-highlight {
      outline: 3px solid #ef4444 !important;
      outline-offset: 2px !important;
      position: relative !important;
    }
    .accessiscan-highlight::after {
      content: attr(data-accessiscan-label);
      position: absolute; top: -24px; left: 0; z-index: 99999;
      background: #ef4444; color: #fff; padding: 2px 8px; border-radius: 4px;
      font-size: 10px; font-weight: 600; white-space: nowrap;
      font-family: -apple-system, sans-serif;
    }
    .accessiscan-highlight[data-accessiscan-impact="serious"]  { outline-color: #f59e0b !important; }
    .accessiscan-highlight[data-accessiscan-impact="serious"]::after  { background: #f59e0b; }
    .accessiscan-highlight[data-accessiscan-impact="moderate"] { outline-color: #eab308 !important; }
    .accessiscan-highlight[data-accessiscan-impact="moderate"]::after { background: #eab308; color: #000; }
    .accessiscan-highlight[data-accessiscan-impact="minor"]    { outline-color: #22c55e !important; }
    .accessiscan-highlight[data-accessiscan-impact="minor"]::after    { background: #22c55e; color: #000; }
  `;
    overlay.appendChild(style);
    document.body.appendChild(overlay);

    for (var v of violations) {
        for (var node of (v.nodes || [])) {
            for (var target of (node.target || [])) {
                try {
                    var el = document.querySelector(target);
                    if (el) {
                        el.classList.add('accessiscan-highlight');
                        el.setAttribute('data-accessiscan-label', (v.impact || 'issue') + ': ' + (v.help || ''));
                        el.setAttribute('data-accessiscan-impact', v.impact || 'minor');
                    }
                } catch (e) { }
            }
        }
    }
}
