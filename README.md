# DealEat

**Food delivery price comparison for Istanbul** — Find the cheapest option for any dish across multiple platforms, without opening three apps.

[![Live App](https://img.shields.io/badge/Live%20App-dealeat.vercel.app-black?style=flat)](https://dealeat.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What it does

DealEat is a comparison and discovery layer on top of food delivery platforms. Instead of switching between apps to find the best price, users see all options in one place.

- Compare the same dish across platforms — see where it's cheapest
- Browse nearby restaurants on an interactive map
- Search any menu item across all restaurants at once
- Works offline after first load (PWA)

**Current coverage:** Zeytinburnu, Istanbul

---

## Features

| Feature | Description |
|---------|-------------|
| 🗺️ Map view | Interactive restaurant map with distance-based filtering |
| 💰 Price comparison | Side-by-side prices across platforms per menu item |
| 🍽️ Menu mode | All items from all restaurants, sorted cheapest first |
| 🎲 Swipe mode | Tinder-style restaurant discovery |
| 📱 PWA | Installable, works offline |
| 📍 Location-aware | Results adapt to your delivery address |

---

## Getting Started

```bash
git clone https://github.com/taskinkaan/Dealeat.git
cd Dealeat
py -m http.server 8081
# Open http://localhost:8081
```

> A local server is required (not `file://`) for runtime data loading.

---

## Project Structure

```
Dealeat/
├── index.html          # Single-file app (all CSS + JS inline)
├── dealeat_prices.json # Price data (loaded at runtime)
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline support)
└── screenshots/        # App screenshots
```

---

## Data

Price and menu data is collected from food delivery platforms operating in Istanbul and updated on a regular basis.

- **Coverage:** 90+ restaurants in Zeytinburnu
- **Products:** 7,000+ menu items
- **Platforms:** Trendyol Go, Getir Yemek
- **Update frequency:** Periodic (approximately every 2 weeks)

> ⚠️ **Disclaimer:** Prices shown are for comparison purposes. They may not reflect real-time availability or current promotions. Always verify the final price on the original platform before ordering. Delivery availability depends on your address and platform rules.

---

## Tech Stack

- **Frontend:** Vanilla JS, HTML5, CSS3 — no framework, no build step
- **Maps:** Leaflet.js + OpenStreetMap
- **Hosting:** Vercel

---

## Roadmap

- [x] Trendyol Go coverage
- [x] Getir Yemek coverage
- [ ] Yemeksepeti coverage
- [ ] Additional Istanbul districts
- [ ] Price history tracking
- [ ] Price drop alerts

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for UI and documentation contribution guidelines.

---

## License

[MIT](LICENSE) — Data belongs to the respective platforms. This app is a comparison tool and does not store or redistribute platform data commercially.
