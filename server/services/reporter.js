const puppeteer = require('puppeteer');
const { Parser } = require('json2csv');
const { categorizeSeverity } = require('../utils/helpers');
const fs = require('fs');
const path = require('path');

async function generatePdfReport(scan, pages) {
    let browser;
    try {
        // Launch headless browser with minimal memory footprint for cloud environments
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        const page = await browser.newPage();

        // Calculate severity breakdown for the cover
        const severity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        for (const p of pages) {
            try {
                const results = JSON.parse(p.results_json || '{}');
                for (const v of (results.violations || [])) {
                    severity[v.impact || 'minor'] = (severity[v.impact || 'minor'] || 0) + (v.nodes?.length || 1);
                }
            } catch { }
        }

        const scoreColor = scan.overall_score >= 80 ? '#00c48c' : scan.overall_score >= 50 ? '#eab308' : '#ef4444';

        // Read logo as base64 if exists, else use icon
        let logoHtml = '<div style="width: 40px; height: 40px; background: #00c48c; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-family: sans-serif; font-size: 24px;">A</div>';
        const logoPath = path.join(__dirname, '../../public/logo.png');
        if (fs.existsSync(logoPath)) {
            const logoExt = "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";
            logoHtml = `<img src="data:image/png;base64,${logoExt}" style="max-height: 40px; width: auto;" alt="Astound Digital">`;
        }

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                    margin: 0; padding: 0;
                    color: #1a1d2b;
                    background: #ffffff;
                }
                .cover-page {
                    height: 1040px;
                    display: flex;
                    flex-direction: column;
                    page-break-after: always;
                }
                .header {
                    background: #0b1221;
                    color: #ffffff;
                    padding: 40px 50px;
                    border-bottom: 6px solid #00c48c;
                }
                .logo-area { display: flex; align-items: center; gap: 15px; margin-bottom: 10px; }
                .title { font-size: 32px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
                .subtitle { color: #94a3b8; font-size: 14px; margin: 5px 0 0 0; font-weight: 500;}
                .content-area {
                    flex: 1;
                    padding: 60px 50px;
                }
                .score-section { text-align: center; margin-bottom: 60px; }
                .score-value { font-size: 100px; font-weight: 800; color: ${scoreColor}; line-height: 1; margin: 0; }
                .score-label { font-size: 18px; color: #5a6478; margin-top: 10px; font-weight: 500; }
                
                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 50px; }
                .meta-table th { text-align: left; padding: 12px 0; color: #8892a4; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e6ef; width: 140px; }
                .meta-table td { padding: 12px 0; font-size: 14px; color: #1a1d2b; border-bottom: 1px solid #e2e6ef; font-weight: 500; word-break: break-all;}
                
                .stats-grid { display: flex; gap: 20px; margin-bottom: 50px; }
                .stat-box { flex: 1; background: #f8fafc; border-radius: 12px; padding: 25px; text-align: center; border: 1px solid #e2e6ef; }
                .stat-box .val { font-size: 36px; font-weight: 800; margin-bottom: 5px; }
                .stat-box .lbl { font-size: 11px; color: #5a6478; text-transform: uppercase; font-weight: 600; }
                
                .sev-bar-container { margin-bottom: 20px; }
                .sev-label { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
                .sev-track { width: 100%; height: 16px; background: #f1f5f9; border-radius: 8px; overflow: hidden; }
                .sev-fill { height: 100%; border-radius: 8px; }
                
                .page-header { background: #0b1221; color: #fff; padding: 25px 40px; margin-bottom: 30px; border-bottom: 4px solid #00c48c; border-radius: 12px; }
                .page-header h2 { margin: 0 0 5px 0; font-size: 20px; }
                .page-header p { margin: 0; font-size: 12px; color: #94a3b8; word-break: break-all; }
                
                .section-title { font-size: 20px; font-weight: 700; margin: 40px 0 20px 0; color: #1a1d2b; border-bottom: 2px solid #e2e6ef; padding-bottom: 10px; }
                
                .violation-card { border: 1px solid #e2e6ef; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
                .v-head { padding: 15px 20px; display: flex; align-items: center; gap: 10px; font-weight: 600; }
                .v-desc { padding: 15px 20px; border-top: 1px solid #e2e6ef; font-size: 13px; color: #475569; background: #fff;}
                .v-nodes { padding: 0; margin: 0; list-style: none; }
                .v-node { padding: 15px 20px; border-top: 1px solid #f1f5f9; font-size: 12px; background: #f8fafc;}
                .code-block { font-family: monospace; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; color: #ef4444; word-break: break-all; margin-top: 5px; display: block; }
                
                .passes-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                .passes-table th, .passes-table td { padding: 10px 15px; border: 1px solid #e2e6ef; text-align: left; }
                .passes-table th { background: #f8fafc; font-weight: 600; color: #475569; }
                
                .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                .bg-critical { background: #fee2e2; color: #ef4444; }
                .bg-serious { background: #fef3c7; color: #f59e0b; }
                .bg-moderate { background: #fef08a; color: #eab308; }
                .bg-minor { background: #dcfce7; color: #22c55e; }
                
                .footer { text-align: center; padding: 20px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e6ef; position: fixed; bottom: 0; width: 100%; background: #fff; }
                @page { margin: 50px; }
            </style>
        </head>
        <body>
            <div class="cover-page">
                <div class="header">
                    <div class="logo-area">
                        ${logoHtml}
                        <h1 class="title">AccessiScan</h1>
                    </div>
                    <p class="subtitle">AI-Powered Accessibility Audit Report</p>
                </div>
                <div class="content-area">
                    <div class="score-section">
                        <h2 class="score-value">${scan.overall_score}</h2>
                        <div class="score-label">Overall Accessibility Score</div>
                    </div>
                    
                    <table class="meta-table">
                        <tr><th>Target URL</th><td>${scan.url}</td></tr>
                        <tr><th>WCAG Standard</th><td>${scan.wcag_level.toUpperCase()}</td></tr>
                        <tr><th>Pages Scanned</th><td>${scan.pages_scanned || 1}</td></tr>
                        <tr><th>Scan Date</th><td>${new Date(scan.started_at).toLocaleString()}</td></tr>
                    </table>
                    
                    <div class="stats-grid">
                        <div class="stat-box"><div class="val" style="color:#ef4444">${scan.total_violations || 0}</div><div class="lbl">Violations</div></div>
                        <div class="stat-box"><div class="val" style="color:#00c48c">${scan.total_passes || 0}</div><div class="lbl">Passes</div></div>
                        <div class="stat-box"><div class="val" style="color:#f59e0b">${scan.total_incomplete || 0}</div><div class="lbl">Incomplete</div></div>
                    </div>
                    
                    <h3 style="font-size: 18px; color: #1a1d2b; margin-bottom: 25px;">Severity Breakdown</h3>
                    `;

        const totalV = Math.max(scan.total_violations || 1, 1);
        const sevData = [
            { id: 'critical', lbl: 'Critical', color: '#ef4444', count: severity.critical },
            { id: 'serious', lbl: 'Serious', color: '#f59e0b', count: severity.serious },
            { id: 'moderate', lbl: 'Moderate', color: '#eab308', count: severity.moderate },
            { id: 'minor', lbl: 'Minor', color: '#22c55e', count: severity.minor }
        ];

        for (const s of sevData) {
            const pct = Math.min((s.count / totalV) * 100, 100);
            html += `
                        <div class="sev-bar-container">
                            <div class="sev-label"><span style="color:${s.color}">${s.lbl}</span><span>${s.count}</span></div>
                            <div class="sev-track"><div class="sev-fill" style="width:${pct}%; background:${s.color}"></div></div>
                        </div>`;
        }

        html += `
                </div>
            </div>`;

        for (const page of pages) {
            let results = {};
            try { results = JSON.parse(page.results_json || '{}'); } catch { }

            const pColor = page.score >= 80 ? '#00c48c' : page.score >= 50 ? '#eab308' : '#ef4444';

            html += `
            <div style="page-break-before: always; padding-top: 20px;">
                <div class="page-header">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1; padding-right:20px;">
                            <h2>${page.title || 'Untitled Page'}</h2>
                            <p>${page.url}</p>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:32px; font-weight:800; color:${pColor}; line-height:1;">${page.score}</div>
                            <div style="font-size:10px; color:#94a3b8; margin-top:4px;">PAGE SCORE</div>
                        </div>
                    </div>
                </div>`;

            if (results.violations && results.violations.length > 0) {
                html += `<h3 class="section-title" style="color:#ef4444;">Violations Found (${results.violations.length})</h3>`;

                for (const v of results.violations) {
                    const sev = categorizeSeverity(v.impact);
                    const bgClass = `bg-${sev.id}`;

                    html += `
                    <div class="violation-card">
                        <div class="v-head" style="background:${sev.color}15; border-bottom: 2px solid ${sev.color}">
                            <span class="badge ${bgClass}">${sev.label}</span>
                            <span style="color:#1a1d2b;">${v.help}</span>
                        </div>
                        <div class="v-desc">${v.description}</div>`;

                    if (v.nodes && v.nodes.length > 0) {
                        html += `<ul class="v-nodes">`;
                        for (const node of v.nodes) {
                            html += `<li class="v-node">
                                <div><strong>Target:</strong> <span style="color:#64748b;">${Array.isArray(node.target) ? node.target.join(' > ') : node.target}</span></div>
                                <div style="margin-top:8px;"><strong>HTML:</strong><code class="code-block">${node.html ? node.html.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'N/A'}</code></div>
                                ${node.failureSummary ? `<div style="margin-top:8px; color:#059669;"><strong>Fix:</strong> ${node.failureSummary.replace(/\n/g, ' ')}</div>` : ''}
                            </li>`;
                        }
                        html += `</ul>`;
                    }
                    html += `</div>`;
                }
            }

            if (results.passes && results.passes.length > 0) {
                html += `
                <h3 class="section-title" style="color:#00c48c;">Passed Checks (${results.passes.length})</h3>
                <table class="passes-table">
                    <thead><tr><th style="width:150px">Rule ID</th><th>Requirement Passed</th></tr></thead>
                    <tbody>`;

                for (const pass of results.passes) {
                    html += `<tr>
                        <td style="font-family:monospace; color:#64748b;">${pass.id}</td>
                        <td style="color:#1a1d2b; font-weight:500;">✓ ${pass.help}</td>
                    </tr>`;
                }
                html += `</tbody></table>`;
            }

            html += `</div>`; // End page wrapper
        }

        html += `
        </body>
        </html>`;

        await page.setContent(html, { waitUntil: 'load' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="width:100%; text-align:center; font-size:9px; color:#94a3b8; font-family:sans-serif; padding-bottom:15px; border-top:1px solid #e2e6ef; padding-top:10px;">
                    AccessiScan by Astound Digital &nbsp;&nbsp;|&nbsp;&nbsp; Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `
        });

        await browser.close();
        return pdfBuffer;
    } catch (err) {
        if (browser) await browser.close();
        throw err;
    }
}

function generateCsvReport(scan, pages) {
    const rows = [];
    for (const page of pages) {
        let results;
        try { results = JSON.parse(page.results_json); } catch { continue; }
        if (results.violations) {
            for (const violation of results.violations) {
                const severity = categorizeSeverity(violation.impact);
                for (const node of (violation.nodes || []).slice(0, 50)) {
                    rows.push({
                        'Page URL': page.url,
                        'Page Title': page.title,
                        'Page Score': page.score,
                        'Rule ID': violation.id,
                        'Severity': severity.label,
                        'Impact': violation.impact,
                        'Description': violation.help,
                        'Element': node.html ? node.html.replace(/\s+/g, ' ').slice(0, 300) : '',
                        'Selector': Array.isArray(node.target) ? node.target.join(' > ') : '',
                        'Fix Suggestion': node.failureSummary ? node.failureSummary.replace(/\n/g, ' - ').slice(0, 500) : '',
                        'Help URL': violation.helpUrl || '',
                        'WCAG Tags': (violation.tags || []).filter(t => t.startsWith('wcag')).join(', ')
                    });
                }
            }
        }
    }
    if (rows.length === 0) rows.push({ 'Message': 'No violations found — all checks passed!' });
    const parser = new Parser({ fields: Object.keys(rows[0]) });
    return parser.parse(rows);
}

module.exports = { generatePdfReport, generateCsvReport };
