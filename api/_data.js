// api/_data.js
// Server-side data layer for AI tools.
// Reads restaurants.json (12 MB) lazily, caches in module memory keyed by meta.generated_at.
// All functions are pure & async. Underscore prefix = internal helper, not a Vercel function.

let _cache = null;
let _cacheGen = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min ceiling even if generated_at unchanged

function _baseUrl() {
  // Explicit override (used by tests / non-Vercel deploys)
  if (process.env.DEALEAT_BASE_URL) return process.env.DEALEAT_BASE_URL;
  // Production URL is stable across deployments — preferred over per-deployment VERCEL_URL
  // so the tool layer always reads the latest static JSON, not the in-flight preview's.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Local `vercel dev` fallback — read from production prod data
  return 'https://dealeat.vercel.app';
}

// Filter: Getir-only restoranları çıkar (coord güvensiz, slug parser ilçe bug'ı).
// Backend AI tool'ları sadece Trendyol coord'lu restoranlarla çalışır (Trendyol-only + merged).
// Frontend kullanıcısının "tek platformlu da göster" toggle'ı backend'i ETKILEMEZ — burada
// her zaman tüm Trendyol coord'lu restoranlar görünür çünkü AI scope'u dar olmamalı.
function _filterByPlatform(data) {
  if (!data) return data;
  const list = data.restaurants || data;
  if (!Array.isArray(list)) return data;
  const filtered = list.filter(r => r.plats && r.plats.includes('trendyol'));
  if (Array.isArray(data)) return filtered;
  return { ...data, restaurants: filtered };
}

async function loadRestaurants() {
  // Quick TTL guard
  const age = Date.now() - _cacheLoadedAt;
  if (_cache && age < CACHE_TTL_MS) return _cache;

  // Strategy: try local filesystem first (works in `vercel dev` on Windows where
  // native fetch + 12MB JSON sometimes hits TLS packet errors). In production
  // the same file must be bundled (see vercel.json `includeFiles`) or fall back
  // to fetching the public URL.
  const fs = require('fs');
  const path = require('path');
  const localPath = path.join(__dirname, '..', 'restaurants.json');

  try {
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf8');
      const data = _filterByPlatform(JSON.parse(raw));
      _cache = data;
      _cacheGen = data?.meta?.generated_at || null;
      _cacheLoadedAt = Date.now();
      return data;
    }
  } catch (e) {
    // fall through to fetch
    console.warn('[_data] fs read failed, falling back to fetch:', e.message);
  }

  // Network fallback (deployed runtime without bundled JSON)
  const base = _baseUrl();
  let currentGen = null;
  try {
    const sumResp = await fetch(`${base}/restaurants-summary.json`, { cache: 'no-store' });
    if (sumResp.ok) {
      const sum = await sumResp.json();
      currentGen = sum?.meta?.generated_at || null;
    }
  } catch (_) { /* swallow */ }

  if (_cache && currentGen && currentGen === _cacheGen) {
    _cacheLoadedAt = Date.now();
    return _cache;
  }

  const resp = await fetch(`${base}/restaurants.json`, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`restaurants.json fetch ${resp.status}`);
  const data = _filterByPlatform(await resp.json());
  _cache = data;
  _cacheGen = currentGen || data?.meta?.generated_at || null;
  _cacheLoadedAt = Date.now();
  return data;
}

// ── Türkçe normalize: ç→c, ü→u, ş→s, ı→i, ö→o, ğ→g ──
function normTR(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u');
}

function matchesTR(haystack, needle) {
  if (!needle) return true;
  return normTR(haystack).includes(normTR(needle));
}

function minPrice(item) {
  if (!item || !item.p || typeof item.p !== 'object') return null;
  const vals = Object.values(item.p).filter(v => typeof v === 'number' && v > 0);
  if (!vals.length) return null;
  return Math.min(...vals);
}

// Haversine km between two coords
function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Build deep link URL to restaurant on platform (Trendyol / Getir)
function platformUrl(platform, rest) {
  if (!rest) return null;
  if (platform === 'trendyol') {
    const numId = String(rest.id || '').replace(/^ty_/, '');
    if (!/^\d+$/.test(numId)) return null;
    return `https://tgoyemek.com/restoranlar/${numId}`;
  }
  if (platform === 'getir') {
    const slug = rest.gr_slug || String(rest.id || '').replace(/^gr_/, '');
    if (!slug || /-mah$/.test(slug)) return null; // truncated slug, can't deep-link
    return `https://getir.com/yemek/restoran/${slug}/`;
  }
  return null;
}

// Compact representation we send back to Claude (token-efficient)
function _packItem(it, rest, section, dist) {
  const mp = minPrice(it);
  const links = {};
  for (const p of (rest.plats || [])) {
    if (typeof it.p[p] === 'number' && it.p[p] > 0) {
      const url = platformUrl(p, rest);
      if (url) links[p] = url;
    }
  }
  return {
    name: it.n,
    minPrice: mp,
    prices: it.p,
    kind: it.k || null,
    section,
    restaurantId: rest.id,
    restaurantName: rest.n,
    rating: rest.rating || null,
    distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
    deliveryFee: rest.delivery_fee ?? null,
    minOrder: rest.min_order ?? null,
    platforms: rest.plats || [],
    links,
  };
}

// Kinds that are auto-hidden (x:1) in default UI but valid AI search targets when explicitly requested.
const _AUTO_HIDDEN_KINDS = new Set(['dessert', 'drink', 'retail', 'sauce', 'extra']);

async function searchItems({ query, kind, priceMax, priceMin, platform, distanceMax, limit, userLocation }) {
  const data = await loadRestaurants();
  const rests = data.restaurants || [];

  let kindSet = null;
  if (Array.isArray(kind) && kind.length) kindSet = new Set(kind);
  else if (typeof kind === 'string' && kind) kindSet = new Set([kind]);

  // If user explicitly asks for a hidden kind (e.g. "tatlı") we must NOT skip x:1 items.
  const explicitHidden = kindSet && [...kindSet].some(k => _AUTO_HIDDEN_KINDS.has(k));

  const out = [];

  for (const r of rests) {
    let dist = null;
    if (userLocation && typeof r.lat === 'number' && typeof r.lng === 'number') {
      dist = distKm(userLocation.lat, userLocation.lng, r.lat, r.lng);
      if (distanceMax != null && dist > distanceMax) continue;
    }

    if (platform && Array.isArray(r.plats) && !r.plats.includes(platform)) continue;

    const menu = r.menu || {};
    for (const [section, items] of Object.entries(menu)) {
      if (/paketli/i.test(section)) continue; // skip retail packaged
      if (!Array.isArray(items)) continue;

      for (const it of items) {
        if (!it || !it.n || !it.p) continue;
        // Skip auto-hidden items unless caller explicitly asked for that kind
        if (it.x === 1 && !explicitHidden) continue;

        const itKind = it.k || 'main';
        if (kindSet && !kindSet.has(itKind)) continue;

        let mp;
        if (platform && typeof it.p[platform] === 'number' && it.p[platform] > 0) {
          mp = it.p[platform];
        } else {
          mp = minPrice(it);
        }
        if (mp == null) continue;
        if (priceMax != null && mp > priceMax) continue;
        if (priceMin != null && mp < priceMin) continue;

        if (query) {
          if (!matchesTR(it.n, query) && !matchesTR(r.n, query) && !matchesTR(section, query)) continue;
        }

        out.push(_packItem(it, r, section, dist));
      }
    }
  }

  out.sort((a, b) => a.minPrice - b.minPrice);
  return out.slice(0, Math.max(1, Math.min(50, limit || 10)));
}

async function getRestaurantDetail(restaurantId) {
  const data = await loadRestaurants();
  const rest = (data.restaurants || []).find(r => r.id === restaurantId);
  if (!rest) return null;

  // Truncate menu for token efficiency: at most 6 visible items per section, top 12 sections
  const menu = {};
  let sectionCount = 0;
  for (const [section, items] of Object.entries(rest.menu || {})) {
    if (sectionCount >= 12) break;
    if (!Array.isArray(items)) continue;
    if (/paketli/i.test(section)) continue;
    const visible = items.filter(it => it && it.x !== 1).slice(0, 6).map(it => ({
      name: it.n,
      minPrice: minPrice(it),
      prices: it.p,
      kind: it.k || null,
    }));
    if (visible.length) {
      menu[section] = visible;
      sectionCount++;
    }
  }

  const links = {};
  for (const p of (rest.plats || [])) {
    const url = platformUrl(p, rest);
    if (url) links[p] = url;
  }

  return {
    id: rest.id,
    name: rest.n,
    category: rest.cat,
    rating: rest.rating ?? null,
    platforms: rest.plats || [],
    deliveryFee: rest.delivery_fee ?? null,
    minOrder: rest.min_order ?? null,
    deliveryRadiusKm: rest.delivery_radius ?? null,
    location: { lat: rest.lat, lng: rest.lng },
    links,
    menu,
  };
}

async function comparePricesForItem({ itemName, restaurantName, userLocation, limit }) {
  const data = await loadRestaurants();
  const rests = data.restaurants || [];
  const matches = [];

  for (const r of rests) {
    if (restaurantName && !matchesTR(r.n, restaurantName)) continue;
    let dist = null;
    if (userLocation && typeof r.lat === 'number') {
      dist = distKm(userLocation.lat, userLocation.lng, r.lat, r.lng);
    }
    const menu = r.menu || {};
    for (const [section, items] of Object.entries(menu)) {
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        if (!it || !it.n || !it.p) continue;
        if (it.x === 1) continue;
        if (!matchesTR(it.n, itemName)) continue;
        const mp = minPrice(it);
        if (mp == null) continue;

        // Find cheapest platform per item
        let cheapest = null;
        for (const [p, v] of Object.entries(it.p)) {
          if (typeof v === 'number' && v > 0 && (!cheapest || v < cheapest.price)) {
            cheapest = { platform: p, price: v };
          }
        }

        const links = {};
        for (const p of (r.plats || [])) {
          const url = platformUrl(p, r);
          if (url) links[p] = url;
        }

        matches.push({
          itemName: it.n,
          restaurantName: r.n,
          restaurantId: r.id,
          section,
          prices: it.p,
          minPrice: mp,
          cheapestPlatform: cheapest,
          distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
          links,
        });
      }
    }
  }

  matches.sort((a, b) => a.minPrice - b.minPrice);
  return matches.slice(0, Math.max(1, Math.min(20, limit || 10)));
}

async function listTopCheapest({ kind, limit, userLocation, distanceMax }) {
  return searchItems({
    kind: [kind || 'main'],
    limit: limit || 10,
    userLocation,
    distanceMax: distanceMax || (userLocation ? 8 : undefined),
  });
}

module.exports = {
  loadRestaurants,
  normTR,
  matchesTR,
  minPrice,
  distKm,
  platformUrl,
  searchItems,
  getRestaurantDetail,
  comparePricesForItem,
  listTopCheapest,
  // exposed for tests
  _internal: { _baseUrl },
};
