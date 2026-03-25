# AccessiScan by Astound Digital

> **AI-Powered Accessibility Testing Platform** — Enterprise-grade WCAG compliance auditing with automated Jira bug reports, severity analysis, and comprehensive PDF/CSV reporting.

![AccessiScan](public/logo.png)

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **🔍 Deep WCAG Scanning** | axe-core engine checks WCAG 2.0/2.1/2.2 A, AA, AAA |
| **🤖 AI-Powered Analysis** | Google Gemini generates fix suggestions & executive summaries |
| **🐛 Jira-Ready Bug Reports** | Copy-paste bugs with steps to reproduce, environment, & fixes |
| **📊 Rich PDF Reports** | Branded PDF with severity bars, violation cards, & page-by-page results |
| **📋 CSV Export** | Full violation data export for spreadsheet analysis |
| **🌐 Chrome Extension** | In-browser scanning with visual violation overlay |
| **📈 Dashboard Analytics** | Score trends, severity breakdowns (real data, no estimates) |
| **🔒 Secure** | JWT auth, Helmet, CORS, SSRF protection, rate limiting |
| **📱 Responsive** | Works on desktop, tablet, and mobile |

---

## 🏗 Architecture

```
accessiscan/
├── server/                    # Backend (Node.js + Express)
│   ├── index.js              # Server entry point
│   ├── config.js             # Environment configuration
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   └── security.js       # Helmet, CORS, rate limiting
│   ├── routes/
│   │   ├── auth.js           # Register/Login/Me
│   │   ├── scan.js           # Start scan, SSE progress, cancel
│   │   ├── reports.js        # Get report, PDF, CSV, compare
│   │   └── dashboard.js      # Stats, history, severity breakdown
│   ├── services/
│   │   ├── ai.js             # Google Gemini AI integration
│   │   ├── crawler.js        # Sitemap-aware page discovery
│   │   ├── db.js             # SQLite database (better-sqlite3)
│   │   ├── reporter.js       # PDF/CSV report generation
│   │   ├── scanner.js        # Puppeteer + axe-core engine
│   │   └── ssrfGuard.js      # SSRF protection
│   └── utils/
│       └── helpers.js         # Utility functions
├── public/                    # Frontend (Vanilla JS SPA)
│   ├── index.html            # SPA shell
│   ├── css/styles.css        # Dark navy Astound theme
│   └── js/
│       ├── api.js            # API client + helpers
│       ├── app.js            # SPA router
│       └── pages/
│           ├── auth.js       # Login/Register
│           ├── dashboard.js  # Dashboard with charts
│           ├── history.js    # Scan history table
│           ├── report.js     # Full report with Jira bugs
│           ├── scan.js       # New scan + progress
│           └── settings.js   # User settings
├── extension/                 # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup/                # Extension popup UI
│   ├── background/           # Service worker
│   ├── content/              # Content script (overlay)
│   ├── lib/                  # axe-core library
│   └── icons/                # Extension icons
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ 
- **npm** v9+
- **Google Gemini API Key** (optional, for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/accessiscan.git
cd accessiscan

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `JWT_SECRET` | **Yes** | — | Secret for JWT token signing |
| `GEMINI_API_KEY` | No | — | Google Gemini API key for AI features |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model to use |
| `DB_PATH` | No | `./data/accessiscan.db` | SQLite database path |

### Running Locally

```bash
# Start the server
npm start

# Or with nodemon for development
npx nodemon server/index.js
```

Open **http://localhost:3000** in your browser.

---

## 📖 Technical Documentation

### Backend API

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login & get JWT token |
| `GET` | `/api/auth/me` | Get current user profile |

#### Scanning
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scan` | Start new accessibility scan |
| `GET` | `/api/scan/:id` | Get scan status |
| `GET` | `/api/scan/:id/progress` | SSE stream for real-time progress |
| `DELETE` | `/api/scan/:id` | Cancel running scan |

#### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reports/:scanId` | Full report with AI summary & Jira bugs |
| `GET` | `/api/reports/:scanId/pdf` | Download branded PDF report |
| `GET` | `/api/reports/:scanId/csv` | Download CSV export |
| `GET` | `/api/reports/:scanId/compare/:otherId` | Compare two scans |

#### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/stats` | Stats + severity breakdown |
| `GET` | `/api/dashboard/recent` | Recent scans |
| `GET` | `/api/dashboard/history` | Paginated scan history |

### Scanning Engine

The scanner uses **Puppeteer** to load pages and **axe-core** to analyze accessibility. The flow:

1. **URL Validation** — SSRF guard checks for private IPs and DNS rebinding
2. **Page Discovery** — Crawler finds pages via sitemap.xml and link following
3. **Accessibility Analysis** — axe-core runs WCAG checks against the DOM
4. **AI Enhancement** — Google Gemini generates fix suggestions and Jira bug reports
5. **Report Generation** — Results stored in SQLite, PDF/CSV generated on demand

### AI Integration (Google Gemini)

- **Executive Summary**: AI-generated overview of the accessibility audit
- **Fix Suggestions**: Code-level fixes with before/after HTML snippets
- **Jira Bug Reports**: Complete tickets with:
  - Title, priority, severity
  - Steps to reproduce
  - Environment details (browser, viewport, WCAG level)
  - Affected elements (CSS selectors + HTML)
  - AI-generated remediation steps

### Security Features

- **Helmet** — HTTP security headers
- **CORS** — Configurable origin whitelist
- **Rate Limiting** — 3-tier: general (100/15min), auth (10/15min), scan (5/15min)
- **SSRF Protection** — Blocks private IPs, localhost, link-local addresses
- **JWT Authentication** — Token-based auth with expiration
- **Input Validation** — URL and parameter sanitization

### Database Schema

```sql
-- Users table
users (id, email, password_hash, name, created_at, updated_at)

-- Scans table  
scans (id, user_id, url, status, wcag_level, max_pages,
       overall_score, total_violations, total_passes, 
       total_incomplete, pages_scanned, started_at, completed_at)

-- Scan pages table
scan_pages (id, scan_id, url, title, score, violations_count,
            passes_count, incomplete_count, results_json, scanned_at)
```

---

## 🧩 Chrome Extension

### Installation
1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Select the `extension/` folder

### Features
- **One-click scanning** of the current page
- **WCAG level selection** (A, AA, AAA, 2.1 AA, 2.2 AA)
- **Visual overlay** highlighting violations on the page
- **Severity breakdown** with real counts
- **Copy report** to clipboard
- **Badge notification** showing violation count

---

## 📄 PDF Report Format

The PDF report includes:
- **Cover page** with branded dark header, score gauge, and meta info
- **Severity breakdown** with colored progress bars
- **Per-page results** with violation cards showing:
  - Severity badge and description
  - Affected HTML elements
  - CSS selectors
  - WCAG criteria tags
  - Fix suggestions
- **Passes summary**
- **Branded footer** on every page

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| Scanning | Puppeteer, axe-core |
| AI | Google Gemini API |
| PDF | PDFKit |
| CSV | json2csv |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Security | Helmet, express-rate-limit |
| Frontend | Vanilla JS SPA |
| Charts | Chart.js |
| Icons | Font Awesome 6 |
| Font | Inter (Google Fonts) |
| Extension | Chrome Manifest V3 |

---

## 📝 License

This project is proprietary software by **Astound Digital**. All rights reserved.

---

<p align="center">
  <strong>Built with ❤️ by Astound Digital</strong>
</p>
