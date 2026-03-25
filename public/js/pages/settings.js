// ===================================================
// AccessiScan — Settings Page
// ===================================================

function renderSettingsPage() {
    const user = API.getUser();
    const content = document.getElementById('page-content');

    content.innerHTML = `
    <div class="page-header">
      <h1>Settings</h1>
      <p>Configure your scanning preferences and account</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-sliders" style="color:var(--accent-blue);"></i> Default Scan Settings</div>
        </div>

        <div class="form-group">
          <label>Default WCAG Level</label>
          <select id="setting-wcag" class="form-input">
            <option value="wcag2a">WCAG 2.0 Level A</option>
            <option value="wcag2aa" selected>WCAG 2.0 Level AA</option>
            <option value="wcag2aaa">WCAG 2.0 Level AAA</option>
            <option value="wcag21aa">WCAG 2.1 Level AA</option>
            <option value="wcag21aaa">WCAG 2.1 Level AAA</option>
            <option value="wcag22aa">WCAG 2.2 Level AA</option>
          </select>
        </div>

        <div class="form-group">
          <label>Default Max Pages</label>
          <input type="number" id="setting-max-pages" class="form-input" value="10" min="1" max="50">
        </div>

        <button class="btn btn-primary" onclick="saveSettings()">
          <i class="fas fa-save"></i> Save Defaults
        </button>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-user" style="color:var(--accent-violet);"></i> Account</div>
        </div>

        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-input" value="${user?.email || ''}" disabled style="opacity:0.6;">
        </div>

        <div class="form-group">
          <label>Name</label>
          <input type="text" id="setting-name" class="form-input" value="${user?.name || ''}" placeholder="Your name">
        </div>

        <button class="btn btn-secondary" onclick="showToast('Name updated!', 'success')">
          <i class="fas fa-check"></i> Update Profile
        </button>
      </div>
    </div>

    <div class="card mt-6">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-puzzle-piece" style="color:var(--accent-cyan);"></i> Chrome Extension</div>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 16px;">
        Install the AccessiScan Chrome extension for instant in-browser accessibility scanning. 
        The extension works standalone and can sync results with your dashboard.
      </p>
      <div style="display:flex; gap: 12px; align-items:center; padding:16px; background:var(--bg-tertiary); border-radius:var(--radius-md);">
        <div style="width:48px; height:48px; background:var(--gradient-primary); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center;">
          <i class="fas fa-universal-access" style="font-size:22px; color:white;"></i>
        </div>
        <div>
          <div style="font-weight:600;">AccessiScan Extension</div>
          <div style="font-size:12px; color:var(--text-tertiary);">Load the <code>extension/</code> folder as an unpacked extension in Chrome → <code>chrome://extensions</code></div>
        </div>
      </div>
    </div>
    
    <div class="card mt-6">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-info-circle" style="color:var(--accent-blue);"></i> About AccessiScan</div>
      </div>
      <div style="color: var(--text-secondary); font-size:14px; line-height:1.8;">
        <p><strong>AccessiScan v1.0</strong> — AI-Powered Accessibility Testing Platform</p>
        <p>Built with axe-core engine for comprehensive WCAG compliance testing.</p>
        <p style="margin-top:12px; font-size:13px; color:var(--text-tertiary);">
          Tests 57+ rules across 10 categories: Color Contrast, Images, Forms, Headings, ARIA, 
          Keyboard, Links, Tables, Multimedia, and Document attributes.
        </p>
      </div>
    </div>
  `;

    // Load saved settings
    const saved = JSON.parse(localStorage.getItem('accessiscan_settings') || '{}');
    if (saved.wcagLevel) document.getElementById('setting-wcag').value = saved.wcagLevel;
    if (saved.maxPages) document.getElementById('setting-max-pages').value = saved.maxPages;
}

function saveSettings() {
    const settings = {
        wcagLevel: document.getElementById('setting-wcag').value,
        maxPages: document.getElementById('setting-max-pages').value
    };
    localStorage.setItem('accessiscan_settings', JSON.stringify(settings));
    showToast('Settings saved!', 'success');
}
