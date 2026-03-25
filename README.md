# DealEat 🍕

**Turkish food-delivery price comparison app** — Discover nearby restaurants in **Zeytinburnu, Istanbul** and compare menu item prices across multiple platforms to find the cheapest options.

## Features

🗺️ **Interactive Map** — See restaurants near you on a live map (Leaflet.js + OpenStreetMap)

💰 **Price Comparison** — Compare the same dish across Trendyol, Yemeksepeti, and Getir

🍽️ **Menu Mode** — Browse all menu items from all restaurants sorted by price (cheapest first)

📱 **Offline Support** — Progressive Web App (PWA) caches data locally via service worker

⚡ **Zero Backend** — Single HTML file, no build step, no API server needed

🇹🇷 **Turkish UI** — Fully localized for Turkish users

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Maps**: Leaflet.js + OpenStreetMap (Nominatim geocoding)
- **Data**: Embedded JSON in single HTML file
- **Scraping**: Python + Playwright (automated price updates)
- **Database**: SQLite (for scraper pipeline)
- **Hosting**: Vercel or Netlify

## Getting Started

### Local Development

```bash
# Clone the repository
git clone https://github.com/taskinkaan/Dealeat.git
cd Dealeat

# Start a local server (required for fetch() to work)
py -m http.server 8081

# Open in browser
# http://localhost:8081
```

**Note:** The app requires a server (not `file://`) because it fetches `dealeat_prices.json` at runtime.

## Project Structure

```
Dealeat/
├── index.html                  # Main app (all CSS + JS inline)
├── dealeat_prices.json         # Runtime price data
├── manifest.json               # PWA manifest
├── sw.js                       # Service worker (offline caching)
├── README.md                   # This file
└── CLAUDE.md                   # Development context (Claude Code)
```

> **Note:** `dealeat_scraper/` (price scraping pipeline) is **private** and not published to GitHub. The scraper, database, and related tools are kept local for legal compliance reasons.
> The app itself and all public data are open source.

## How It Works

### Data Flow

```
Trendyol Go Website
    ↓
playwright_scraper.py (Playwright headless browser)
    ↓
prices.db (SQLite)
    ↓
export_json.py
    ↓
dealeat_prices.json (runtime price updates)
STATIC_RESTAURANTS (embedded in index.html)
```

### Data Updates

Price data is manually scraped and updated every ~2 weeks using a **private** Python + Playwright pipeline. The scraper codebase is not published to GitHub for legal compliance reasons, but updates are reflected in:
- `dealeat_prices.json` — runtime price patches
- `STATIC_RESTAURANTS` in `index.html` — embedded restaurant & menu data

**Automatically updated platforms:** Trendyol Go (tgoyemek.com)
**Planned:** Yemeksepeti, Getir

## Key Features Explained

### Menu Mode
- Displays all menu items from all restaurants
- Sorted by price (cheapest first)
- Filters by search query and category
- Shows "En Ucuz" (Cheapest) badge for best price across platforms

### Map Mode
- Shows restaurants as markers on an interactive map
- Click a marker to see restaurant details and menu
- Add restaurants from OpenStreetMap (OSM) if missing
- Distance calculated using Haversine formula

### Real Data Badge
- Restaurants with scraped price data show a "Gerçek Veri" (Real Data) badge
- Indicates prices are fresh and automatically updated

## Data

- **49 restaurants** with real scraped menus from Trendyol
- **3,169 menu items** total
- **Target location:** Zeytinburnu, Istanbul (41.0085°N, 28.9086°E)
- **Last updated:** March 21, 2026

## Development

### Requirements

- Python 3.10+
- Playwright (installed via pip)
- Git

### Install Playwright

```bash
pip install playwright
python -m playwright install
```

### Database Schema

```sql
CREATE TABLE restaurants (
    id TEXT PRIMARY KEY,              -- e.g. "ty_306718"
    name TEXT NOT NULL,
    platform TEXT NOT NULL,           -- 'trendyol' | 'yemeksepeti' | 'getir'
    category TEXT,
    lat REAL,
    lng REAL,
    ...
);

CREATE TABLE menu_items (
    id INTEGER PRIMARY KEY,
    rest_id TEXT,
    platform TEXT,
    category TEXT,
    name TEXT NOT NULL,
    price REAL,
    ...
);
```

## Deployment

Currently deployed on **Vercel**.

```bash
# Deploy to Vercel (requires Vercel CLI)
vercel --prod

# Alternative: Netlify
netlify deploy --prod
```

## Future Roadmap

- ✅ Trendyol scraper (done)
- ⏳ Yemeksepeti scraper
- ⏳ Getir scraper
- ⏳ Scheduled 2-week price refresh
- ⏳ Mobile app (React Native)
- ⏳ Expand to other Istanbul districts
- ⏳ Favorites and order history

## License

MIT

## Contact

Created for Istanbul food lovers who want to save money on delivery. 🚀

---

**Repository:** https://github.com/taskinkaan/Dealeat
**Live App:** https://dealeat.vercel.app (or Netlify)
