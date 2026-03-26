// ===================================================
// AccessiScan — Gemini AI Service
// ===================================================
// Uses Google Gemini API for intelligent accessibility analysis:
// - Smart fix suggestions for each violation
// - Jira-ready bug report generation
// - Executive summary generation
// - Severity re-assessment with context

const config = require('../config');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGemini(prompt, maxTokens = 2048) {
    if (!config.geminiApiKey) {
        return null; // AI features disabled without API key
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        const response = await fetch(
            `${GEMINI_API_URL}/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: maxTokens,
                        temperature: 0.3
                    }
                }),
                signal: controller.signal
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('Gemini API error:', response.status);
            return null;
        }

        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('Gemini API timed out after 12 seconds');
        } else {
            console.error('Gemini API call failed:', err.message);
        }
        return null;
    }
}

/**
 * Generate AI-powered fix suggestions for violations
 */
async function generateFixSuggestions(violations, pageUrl) {
    if (!config.geminiApiKey || !violations || violations.length === 0) {
        return null;
    }

    const violationSummary = violations.slice(0, 15).map(v => ({
        rule: v.id,
        impact: v.impact,
        help: v.help,
        description: v.description,
        element: v.nodes?.[0]?.html?.slice(0, 200) || '',
        failureSummary: v.nodes?.[0]?.failureSummary?.slice(0, 200) || ''
    }));

    const prompt = `You are an expert web accessibility consultant. Analyze these WCAG accessibility violations found on "${pageUrl}" and provide actionable fix suggestions.

VIOLATIONS:
${JSON.stringify(violationSummary, null, 2)}

For each violation, provide:
1. A clear, developer-friendly explanation of what's wrong
2. The exact code fix needed (show before/after code)
3. Priority level (P1-Critical, P2-High, P3-Medium, P4-Low)
4. Estimated effort (Quick Fix / Moderate / Complex)

Format your response as JSON array:
[{
  "ruleId": "rule-id",
  "explanation": "...",
  "codeBefore": "...",
  "codeAfter": "...",
  "priority": "P1",
  "effort": "Quick Fix",
  "wcagCriteria": "WCAG 2.1 SC 1.1.1"
}]

Return ONLY valid JSON, no markdown.`;

    const result = await callGemini(prompt, 3000);
    if (!result) return null;

    try {
        // Try to extract JSON from response
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
        return null;
    }
}

/**
 * Generate Jira-ready bug reports for violations
 */
async function generateJiraBugReports(violations, pageUrl, pageTitle, wcagLevel, scanDate) {
    if (!violations || violations.length === 0) return [];

    const bugs = violations.slice(0, 20).map((v, idx) => {
        const severity = v.impact || 'minor';
        const priorityMap = { critical: 'P1 - Critical', serious: 'P2 - High', moderate: 'P3 - Medium', minor: 'P4 - Low' };
        const jiraPriority = priorityMap[severity] || 'P3 - Medium';
        const wcagTags = (v.tags || []).filter(t => t.startsWith('wcag')).join(', ');
        const affectedElements = (v.nodes || []).slice(0, 3);

        const stepsToReproduce = affectedElements.map((node, i) => {
            const selector = Array.isArray(node.target) ? node.target.join(' > ') : (node.target || 'N/A');
            return `${i + 1}. Navigate to: ${pageUrl}
${i + 1}.1. Locate element: \`${selector}\`
${i + 1}.2. Inspect the element for accessibility compliance
${i + 1}.3. Run automated accessibility check (axe-core)`;
        }).join('\n');

        const elementDetails = affectedElements.map((node, i) => {
            return `Element ${i + 1}:
  Selector: ${Array.isArray(node.target) ? node.target.join(' > ') : (node.target || 'N/A')}
  HTML: ${(node.html || 'N/A').slice(0, 300)}`;
        }).join('\n\n');

        return {
            id: v.id,
            impact: severity,
            title: `[Accessibility] [${severity.toUpperCase()}] ${v.help} — ${new URL(pageUrl).pathname}`,
            body: `## Bug Report: Accessibility Violation

**Title:** ${v.help}
**Priority:** ${jiraPriority}
**Type:** Accessibility Bug
**Component:** Web UI — Accessibility
**Labels:** accessibility, ${severity}, wcag, a11y-audit

---

### Description
${v.description}

This violates **${wcagTags || 'WCAG guidelines'}** and impacts users who rely on assistive technologies${severity === 'critical' ? ' — this is a blocking issue' : ''}.

### Environment
| Field | Value |
|-------|-------|
| **URL** | ${pageUrl} |
| **Page Title** | ${pageTitle || 'N/A'} |
| **WCAG Standard** | ${(wcagLevel || 'wcag2aa').toUpperCase()} |
| **Testing Tool** | AccessiScan v1.0 (axe-core engine) |
| **Scan Date** | ${scanDate || new Date().toISOString().split('T')[0]} |
| **Browser** | Chrome (latest) / Headless Chromium |
| **Viewport** | 1280×800 |

### Steps to Reproduce
${stepsToReproduce || '1. Navigate to the page URL listed above\n2. Run accessibility scan\n3. Observe the violation'}

### Affected Elements
\`\`\`
${elementDetails}
\`\`\`

### Expected Behavior
The element(s) should comply with ${wcagTags || 'WCAG 2.1 AA'} accessibility standards. ${v.help}.

### Actual Behavior
${v.nodes?.[0]?.failureSummary || v.description}

### Suggested Fix
${v.helpUrl ? `Refer to the [axe-core documentation](${v.helpUrl}) for detailed remediation guidance.` : 'Review the element and ensure it meets WCAG compliance requirements.'}

### Impact Assessment
- **Severity:** ${severity.charAt(0).toUpperCase() + severity.slice(1)}
- **Users Affected:** ${severity === 'critical' ? 'All users with disabilities — complete barrier' : severity === 'serious' ? 'Most users with assistive technologies' : severity === 'moderate' ? 'Some users may face difficulty' : 'Minor impact on user experience'}
- **Affected Elements Count:** ${v.nodes?.length || 1}
- **WCAG Criteria:** ${wcagTags || 'N/A'}

### References
${v.helpUrl ? `- [axe-core Rule: ${v.id}](${v.helpUrl})` : `- Rule ID: ${v.id}`}
- [WCAG Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)

---
*Auto-generated by AccessiScan AI Accessibility Testing Tool*`
        };
    });

    // If Gemini API key available, enhance bugs with AI suggestions
    if (config.geminiApiKey) {
        try {
            const aiSuggestions = await generateFixSuggestions(violations, pageUrl);
            if (aiSuggestions && Array.isArray(aiSuggestions)) {
                for (const bug of bugs) {
                    const suggestion = aiSuggestions.find(s => s.ruleId === bug.id);
                    if (suggestion) {
                        bug.aiSuggestion = suggestion;
                        bug.body += `\n\n### AI-Powered Fix Suggestion
**Explanation:** ${suggestion.explanation || 'N/A'}
**Estimated Effort:** ${suggestion.effort || 'N/A'}

**Before:**
\`\`\`html
${suggestion.codeBefore || 'N/A'}
\`\`\`

**After:**
\`\`\`html
${suggestion.codeAfter || 'N/A'}
\`\`\``;
                    }
                }
            }
        } catch (err) {
            console.error('AI enhancement failed:', err.message);
        }
    }

    return bugs;
}

/**
 * Generate AI executive summary for the full scan
 */
async function generateExecutiveSummary(scan, pages) {
    if (!config.geminiApiKey) {
        return generateFallbackSummary(scan, pages);
    }

    const violationSummary = [];
    for (const page of pages) {
        let results;
        try { results = JSON.parse(page.results_json || '{}'); } catch { continue; }
        if (results.violations) {
            violationSummary.push({
                url: page.url,
                score: page.score,
                violations: results.violations.slice(0, 5).map(v => ({
                    id: v.id, impact: v.impact, help: v.help, count: v.nodes?.length || 1
                }))
            });
        }
    }

    const prompt = `You are an accessibility expert. Write a concise executive summary for this WCAG accessibility audit.

Website: ${scan.url}
Overall Score: ${scan.overall_score}/100
Pages Scanned: ${scan.pages_scanned}
Total Violations: ${scan.total_violations}
Total Passes: ${scan.total_passes}
WCAG Level: ${scan.wcag_level}

Page Results:
${JSON.stringify(violationSummary, null, 2)}

Write a professional 3-4 paragraph executive summary that includes:
1. Overall compliance status and score interpretation
2. Key findings and most critical issues
3. Prioritized recommendations
4. Risk assessment (legal compliance risk level: Low/Medium/High/Critical)

Keep it concise and business-friendly. No markdown formatting, just plain text paragraphs.`;

    const result = await callGemini(prompt, 1500);
    return result || generateFallbackSummary(scan, pages);
}

function generateFallbackSummary(scan, pages) {
    const score = scan.overall_score || 0;
    const level = score >= 80 ? 'good' : score >= 50 ? 'moderate' : 'poor';
    const risk = score >= 80 ? 'Low' : score >= 50 ? 'Medium' : 'High';

    return `The accessibility audit of ${scan.url} scanned ${scan.pages_scanned} page(s) and achieved an overall score of ${score}/100, indicating ${level} WCAG compliance at the ${(scan.wcag_level || 'wcag2aa').toUpperCase()} level.

The scan identified ${scan.total_violations} accessibility violation(s) alongside ${scan.total_passes} passing rule(s). ${scan.total_violations > 0 ? 'These violations should be addressed to ensure the website is accessible to all users, including those using assistive technologies.' : 'The website demonstrates strong accessibility compliance.'}

Compliance Risk Level: ${risk}. ${risk === 'High' ? 'Immediate remediation is recommended to avoid potential legal liability under ADA, Section 508, and similar accessibility regulations.' : risk === 'Medium' ? 'Some improvements are needed to achieve full compliance. Prioritize critical and serious issues first.' : 'The website is in good standing. Continue monitoring and address any remaining minor issues.'}`;
}

module.exports = { generateFixSuggestions, generateJiraBugReports, generateExecutiveSummary, callGemini };
