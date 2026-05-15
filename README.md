# NSFX Stock Scanner

A personal US-stock research tool. Search any ticker; see 5-year price history,
fundamentals, dynamic competitor comparison, and a transparent 0–100 score
across four pillars (Fundamentals, Momentum, Analysts, Growth). Bulk screener
scans the S&P 500 and NASDAQ 100. Dividend quality view filters for sustainable
income. Sector-relative scoring corrects for industry valuation norms.

Data: **Yahoo Finance** (via Vercel serverless functions, no API key).

## Live demo

Once deployed, your app will be at: `https://nsfx-stock-scanner.vercel.app`
(actual URL depends on your Vercel project name).

## Deploy from scratch

### 1. Push this code to GitHub

```bash
# In the project folder:
git init
git add .
git commit -m "Initial commit"

# Create a new public repo at https://github.com/new
# (name suggestion: nsfx-stock-scanner)

# Then connect and push:
git remote add origin https://github.com/<your-username>/nsfx-stock-scanner.git
git branch -M main
git push -u origin main
```

### 2. Import to Vercel

1. Go to https://vercel.com/new
2. Click "Import Git Repository", pick your `nsfx-stock-scanner` repo
3. Framework Preset: **Vite** (auto-detected)
4. Build Command: `npm run build` (auto-detected)
5. Output Directory: `dist` (auto-detected)
6. Click **Deploy**

About 30 seconds later, your site is live. Vercel auto-redeploys on every
push to `main`, so any future `git push` updates production.

## Local development

```bash
npm install
npm run dev
```

`npm run dev` uses `vercel dev` which simulates the production environment
locally: the React app + the serverless functions both run on
`http://localhost:3000`.

First time only, Vercel CLI may prompt you to log in and link the project.

### If you'd rather skip Vercel CLI locally

```bash
# Run the frontend only (API calls will fail since there's no proxy)
npm run vite
```

Useful for working on pure UI changes without burning Yahoo requests.

## How it works

```
Browser (React)
   ↓ /api/overview/AAPL
Vercel Edge / Serverless Function
   ↓
Yahoo Finance (via yahoo-finance2 lib)
```

API endpoints:

| Route                    | Purpose                                     | Cache  |
|--------------------------|---------------------------------------------|--------|
| `/api/health`            | Health check                                | none   |
| `/api/search?q=apple`    | Ticker search                               | 1 day  |
| `/api/quote/AAPL`        | Current price snapshot                      | 5 min  |
| `/api/overview/AAPL`     | Company info + fundamentals                 | 6 h    |
| `/api/daily/AAPL`        | 5-year daily price history                  | 6 h    |
| `/api/earnings/AAPL`     | Quarterly earnings history                  | 1 day  |
| `/api/peers/AAPL`        | Similar tickers (Yahoo's recommendations)   | 7 days |

Cache is at the Vercel CDN edge — repeat requests for the same ticker
within the TTL never re-hit Yahoo, they come from the edge. Browser
localStorage caches another layer on top of that for instant re-loads.

## The score

Composite is a weighted average of four pillars:

| Pillar       | Weight | What it measures                                      |
|--------------|--------|-------------------------------------------------------|
| Fundamentals | 35%    | P/E, P/B, ROE, profit margin, beta                    |
| Growth       | 25%    | Revenue YoY, EPS YoY, earnings-beat streak            |
| Momentum     | 20%    | Price vs SMA50/SMA200, 6M and 12M returns             |
| Analysts     | 20%    | Target price upside, weighted rating consensus         |

Each metric scored 0–100 via piecewise-linear curves. Missing data is
handled gracefully — pillar weights redistribute over whichever pillars
have data. Toggle "Sector-relative" mode to score each metric against its
sector peers instead of broad-market norms.

### Verdict bands

- **75+** Strong Buy candidate
- **60–74** Worth a closer look
- **45–59** Mixed signals
- **30–44** Weak — be cautious
- **<30** Avoid

## Project structure

```
nsfx-stock-scanner/
├── api/                         # Vercel serverless functions
│   ├── _lib/yahoo.js            # Shared Yahoo client + wrap helper
│   ├── health.js                # Health check
│   ├── search.js                # Ticker search
│   ├── quote/[symbol].js        # Current quote
│   ├── overview/[symbol].js     # Fundamentals
│   ├── daily/[symbol].js        # 5y price history
│   ├── earnings/[symbol].js     # Earnings history
│   └── peers/[symbol].js        # Similar tickers
├── src/
│   ├── App.jsx                  # Main orchestration with view tabs
│   ├── components/
│   │   ├── SearchBar.jsx
│   │   ├── ScoreCard.jsx
│   │   ├── PriceChart.jsx
│   │   ├── OverviewPanel.jsx
│   │   ├── CompetitorTable.jsx
│   │   ├── Watchlist.jsx
│   │   ├── Screener.jsx         # Bulk screener
│   │   ├── ScreenerTable.jsx
│   │   ├── FilterBar.jsx
│   │   ├── DividendView.jsx
│   │   └── ErrorBoundary.jsx
│   ├── lib/
│   │   ├── yahoo.js             # Client for /api endpoints
│   │   ├── score.js             # Full 4-pillar score engine
│   │   ├── quickScore.js        # 3-pillar lightweight (for screener)
│   │   ├── sectorScore.js       # Sector-relative scoring
│   │   ├── screener.js          # Bulk runner with concurrency
│   │   ├── filters.js           # Filter logic
│   │   ├── dividendScore.js     # Dividend quality scoring
│   │   ├── history.js           # Scan snapshot persistence
│   │   └── watchlist.js
│   └── data/
│       └── universes.js         # S&P 500 + NASDAQ 100 ticker lists
└── vercel.json                  # Vercel routing/build config
```

## Updating universe ticker lists

`src/data/universes.js` contains static snapshots of S&P 500 and NASDAQ 100
constituents. Index membership changes occasionally. To refresh, scrape the
current lists from Wikipedia (S&P 500 page maintains a clean table) and
replace the arrays.

## Disclaimer

Educational research tool. Not investment advice. Yahoo Finance is an
unofficial data source and could break or change without notice. Past
performance does not predict future returns. Use the score as a starting
point for research, not as a buy signal.
