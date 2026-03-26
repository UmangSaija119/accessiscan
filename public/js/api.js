// ===================================================
// AccessiScan — API Client
// ===================================================

const API = {
    baseUrl: '/api',
    token: localStorage.getItem('accessiscan_token'),

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('accessiscan_token', token);
        } else {
            localStorage.removeItem('accessiscan_token');
        }
    },

    getUser() {
        const data = localStorage.getItem('accessiscan_user');
        return data ? JSON.parse(data) : null;
    },

    setUser(user) {
        if (user) {
            localStorage.setItem('accessiscan_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('accessiscan_user');
        }
    },

    isAuthenticated() {
        return !!this.token;
    },

    async request(method, endpoint, body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);

        if (response.status === 401 && endpoint !== '/auth/login') {
            const data = await response.json().catch(() => ({}));
            if (data.code === 'TOKEN_EXPIRED') {
                this.logout();
                throw new Error('Session expired. Please log in again.');
            }
            this.logout();
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(data.error || 'Request failed');
        }

        return response.json();
    },

    // Auth
    async register(email, password, name) {
        const data = await this.request('POST', '/auth/register', { email, password, name });
        this.setToken(data.token);
        this.setUser(data.user);
        return data;
    },

    async login(email, password) {
        const data = await this.request('POST', '/auth/login', { email, password });
        this.setToken(data.token);
        this.setUser(data.user);
        return data;
    },

    logout() {
        this.setToken(null);
        this.setUser(null);
        window.location.hash = '#/login';
        window.location.reload();
    },

    async getMe() {
        return this.request('GET', '/auth/me');
    },

    // Scans
    async startScan(url, wcagLevel, maxPages) {
        return this.request('POST', '/scan', { url, wcagLevel, maxPages });
    },

    async getScan(scanId) {
        return this.request('GET', `/scan/${scanId}`);
    },

    async cancelScan(scanId) {
        return this.request('DELETE', `/scan/${scanId}`);
    },

    async startBatchScan(urls, wcagLevel, maxPages) {
        return this.request('POST', '/scan/batch', { urls, wcagLevel, maxPages });
    },

    subscribeScanProgress(scanId, onMessage) {
        const url = `${this.baseUrl}/scan/${scanId}/progress`;
        const eventSource = new EventSource(url, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        // EventSource doesn't support custom headers, so we use a workaround
        // We'll use fetch-based SSE instead
        const controller = new AbortController();

        fetch(url, {
            headers: { 'Authorization': `Bearer ${this.token}` },
            signal: controller.signal
        }).then(response => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function read() {
                reader.read().then(({ done, value }) => {
                    if (done) return;
                    buffer += decoder.decode(value, { stream: true });

                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                onMessage(data);
                            } catch { }
                        }
                    }

                    read();
                }).catch(() => { });
            }

            read();
        }).catch(() => { });

        return { cancel: () => controller.abort() };
    },

    // Reports
    async getReport(scanId) {
        return this.request('GET', `/reports/${scanId}`);
    },

    getPdfUrl(scanId) {
        return `${this.baseUrl}/reports/${scanId}/pdf`;
    },

    getCsvUrl(scanId) {
        return `${this.baseUrl}/reports/${scanId}/csv`;
    },

    // Admin
    async getAdminStats() {
        return this.request('GET', '/admin/stats');
    },

    async getAdminUsers() {
        return this.request('GET', '/admin/users');
    },

    async downloadPdf(scanId) {
        try {
            const response = await fetch(`${this.baseUrl}/reports/${scanId}/pdf`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Download failed' }));
                throw new Error(err.error || 'Download failed');
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Cloud Server is currently waking up... Please wait 30 seconds and click Download again.');
            }

            const pdfBytes = await response.arrayBuffer();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `accessiscan-report-${scanId.slice(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Critical fix: Delay garbage collection by 60 seconds to ensure Chrome 
            // disk I/O safely flushes the buffer on slow/CPU-bound Windows computers.
            setTimeout(() => URL.revokeObjectURL(url), 60000);

            showToast('Report downloaded!', 'success');
        } catch (err) {
            showToast('PDF download failed: ' + err.message, 'error');
            throw err;
        }
    },

    async downloadCsv(scanId) {
        try {
            const response = await fetch(`${this.baseUrl}/reports/${scanId}/csv`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Download failed' }));
                throw new Error(err.error || 'Download failed');
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Cloud Server is currently waking up... Please wait 30 seconds and click Download again.');
            }

            const csvBytes = await response.arrayBuffer();
            const blob = new Blob([csvBytes], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `accessiscan-report-${scanId.slice(0, 8)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Critical fix: 60-second grace period for disk I/O
            setTimeout(() => URL.revokeObjectURL(url), 60000);

            showToast('CSV downloaded!', 'success');
        } catch (err) {
            showToast('CSV download failed: ' + err.message, 'error');
            throw err;
        }
    },

    async compareScans(scanId, otherId) {
        return this.request('GET', `/reports/${scanId}/compare/${otherId}`);
    },

    // Dashboard
    async getDashboardStats() {
        return this.request('GET', '/dashboard/stats');
    },

    async getRecentScans() {
        return this.request('GET', '/dashboard/recent');
    },

    async getHistory(page = 1, limit = 20) {
        return this.request('GET', `/dashboard/history?page=${page}&limit=${limit}`);
    },

    async clearHistory() {
        return this.request('DELETE', '/dashboard/history/clear');
    }
};

// Toast notification helper
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <i class="fas ${icons[type]}"></i>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-xmark"></i>
    </button>
  `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Score gauge helper
function createScoreGauge(score, size = 140, strokeWidth = 8) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? '#00c48c' : score >= 50 ? '#e6a817' : '#dc3545';

    return `
    <div class="score-gauge" style="width:${size}px; height:${size}px;">
      <svg width="${size}" height="${size}">
        <circle class="score-gauge-bg" cx="${size / 2}" cy="${size / 2}" r="${radius}"/>
        <circle class="score-gauge-fill" cx="${size / 2}" cy="${size / 2}" r="${radius}"
          stroke="${color}" 
          stroke-dasharray="${circumference}" 
          stroke-dashoffset="${offset}"/>
      </svg>
      <div class="score-gauge-text">
        <div class="score-value" style="color:${color}">${score}</div>
        <div class="score-label">/ 100</div>
      </div>
    </div>
  `;
}

function createSmallScoreGauge(score, size = 48, strokeWidth = 4) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? '#00c48c' : score >= 50 ? '#e6a817' : '#dc3545';

    return `
    <div class="score-gauge small" style="width:${size}px; height:${size}px;">
      <svg width="${size}" height="${size}">
        <circle class="score-gauge-bg" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke-width="${strokeWidth}"/>
        <circle class="score-gauge-fill" cx="${size / 2}" cy="${size / 2}" r="${radius}"
          stroke="${color}" stroke-width="${strokeWidth}"
          stroke-dasharray="${circumference}" 
          stroke-dashoffset="${offset}"/>
      </svg>
      <div class="score-gauge-text">
        <div class="score-value" style="color:${color}">${score}</div>
      </div>
    </div>
  `;
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function severityBadge(impact) {
    const map = {
        critical: { class: 'badge-critical', icon: 'fa-circle-xmark' },
        serious: { class: 'badge-serious', icon: 'fa-triangle-exclamation' },
        moderate: { class: 'badge-moderate', icon: 'fa-circle-exclamation' },
        minor: { class: 'badge-minor', icon: 'fa-circle-info' }
    };
    const s = map[impact] || map.minor;
    return `<span class="badge ${s.class}"><i class="fas ${s.icon}"></i> ${impact || 'minor'}</span>`;
}

function statusBadge(status) {
    return `<span class="flex items-center gap-2"><span class="status-dot ${status}"></span> ${status}</span>`;
}
