// ===================================================
// AccessiScan — Admin Dashboard Page
// ===================================================

async function renderAdminPage() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Admin Control Panel</h1>
        <p>System-wide metrics and user management</p>
      </div>
      <div>
        <button class="btn btn-secondary" onclick="renderAdminPage()">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
    </div>

    <!-- Admin Stats Level -->
    <div class="stats-grid" style="margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon"><i class="fas fa-users"></i></div>
          <div class="stat-title">Total Users</div>
        </div>
        <div class="stat-value" id="admin-total-users">-</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon"><i class="fas fa-search"></i></div>
          <div class="stat-title">Total Scans Performed</div>
        </div>
        <div class="stat-value" id="admin-total-scans">-</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
          <div class="stat-title">Completed Scans</div>
        </div>
        <div class="stat-value" id="admin-completed-scans">-</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon"><i class="fas fa-star"></i></div>
          <div class="stat-title">Global Avg Score</div>
        </div>
        <div class="stat-value" id="admin-avg-score">-</div>
      </div>
    </div>

    <!-- User Management Table -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <h2 class="card-title">Registered Users</h2>
      </div>
      <div class="card-body">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name / Email</th>
                <th>Role</th>
                <th>Registration Date</th>
                <th>Total Scans</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="admin-users-list">
              <tr><td colspan="5" style="text-align:center; padding: 30px;">Loading users...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

    try {
        const stats = await API.getAdminStats();
        document.getElementById('admin-total-users').textContent = stats.totalUsers;
        document.getElementById('admin-total-scans').textContent = stats.totalScans;
        document.getElementById('admin-completed-scans').textContent = stats.completedScans;

        const scoreVal = document.getElementById('admin-avg-score');
        scoreVal.textContent = stats.globalAvgScore;
        scoreVal.style.color = getScoreColor(stats.globalAvgScore);

        const usersData = await API.getAdminUsers();
        renderUsersTable(usersData.users);

    } catch (err) {
        showToast('Failed to load admin data: ' + err.message, 'error');
        if (err.message.includes('Access denied')) {
            navigate('dashboard');
        }
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('admin-users-list');

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(u.name || 'Unnamed')}</div>
          <div style="font-size: 13px; color: var(--text-tertiary);">${escapeHtml(u.email)}</div>
        </td>
        <td>
          <span class="badge ${u.role === 'admin' ? 'badge-critical' : 'badge-serious'}">
            ${u.role.toUpperCase()}
          </span>
        </td>
        <td>${formatDate(u.created_at)}</td>
        <td><strong>${u.scanCount}</strong></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showToast('User management coming soon', 'info')" title="Manage User">
            <i class="fas fa-cog"></i> Manage
          </button>
        </td>
      </tr>
    `).join('');
}
