// ===================================================
// AccessiScan — SPA Router & App Init
// ===================================================

function initApp() {
    if (!API.isAuthenticated()) {
        showAuthScreen();
        return;
    }

    // Show app, hide auth
    document.getElementById('app').style.display = 'flex';
    document.getElementById('auth-container').style.display = 'none';

    // Set user info in sidebar
    const user = API.getUser();
    if (user) {
        document.getElementById('user-name').textContent = user.name || 'User';
        document.getElementById('user-email').textContent = user.email || '';

        // Dynamically inject Admin Panel link only for admins
        if (user.role === 'admin') {
            let adminLink = document.getElementById('nav-admin');
            if (!adminLink) {
                const navMenu = document.querySelector('.sidebar-nav');
                const adminHtml = `<a href="#/admin" class="nav-item" id="nav-admin" data-page="admin"><i class="fas fa-shield-alt"></i><span>Admin Panel</span></a>`;
                navMenu.insertAdjacentHTML('beforeend', adminHtml);
            }
        }
    }

    // Sidebar toggle (hamburger)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarToggle.addEventListener('click', toggleSidebar);

    // Mobile overlay: close sidebar on clicking outside
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
    }

    // Mobile toggle button (create if not exists)
    if (!document.getElementById('mobile-toggle')) {
        const mobileBtn = document.createElement('button');
        mobileBtn.id = 'mobile-toggle';
        mobileBtn.className = 'mobile-toggle';
        mobileBtn.innerHTML = '<i class="fas fa-bars"></i>';
        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });
        document.body.appendChild(mobileBtn);
    }

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        API.logout();
    });

    // Route handler
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // Responsive check
    handleResize();
    window.addEventListener('resize', handleResize);
}

function showAuthScreen() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-container').style.display = 'flex';
    renderLoginPage();
}

function handleRoute() {
    const hash = window.location.hash || '#/dashboard';
    const parts = hash.slice(2).split('/');
    const page = parts[0] || 'dashboard';
    const param = parts[1] || null;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page ||
            (page === 'report' && item.dataset.page === 'history'));
    });

    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Route to page
    switch (page) {
        case 'dashboard': renderDashboardPage(); break;
        case 'scan': renderScanPage(); break;
        case 'report':
            if (param) renderReportPage(param);
            else window.location.hash = '#/history';
            break;
        case 'history': renderHistoryPage(); break;
        case 'admin': renderAdminPage(); break;
        case 'settings': renderSettingsPage(); break;
        default: renderDashboardPage();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

function handleResize() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
    }
}

// Initialize app on load
document.addEventListener('DOMContentLoaded', initApp);

// Handle initial hash
if (!window.location.hash) {
    window.location.hash = '#/dashboard';
}
