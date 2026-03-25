const puppeteer = require('puppeteer');
const { Parser } = require('json2csv');
const { categorizeSeverity } = require('../utils/helpers');
const fs = require('fs');
const path = require('path');

async function generatePdfReport(scan, pages) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
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
            const logoExt = fs.readFileSync(logoPath).toString('base64');
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

        await page.setContent(html, { waitUntil: 'networkidle0' });

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
