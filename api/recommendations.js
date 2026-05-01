// api/recommendations.js
// Smart Recommendations endpoint — homepage "Sana Özel" section.
// Hybrid: backend heuristic scoring + Claude Haiku for short Turkish rationale.
// Fast (~1-2s), cheap (~$0.001/req), graceful cold-start fallback.

const { generateText } = require('ai');
const { createAnthropic } = require('@ai-sdk/anthropic');
const data = require('./_data.js');

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});

const MODEL = 'claude-haiku-4-5';
const REC_LIMIT = 5;
const PRICE_CEIL = 350;
const PRICE_FLOOR = 100; // gerçek bir öğün starts ~100 TL; daha azı garnitür/side risk
const DIST_CEIL_KM = 5;

// Ana yemek isim pattern — kind classifier %23 yanlış olduğu için ek güvenlik.
// Combo zaten safe (menü/combo paket). Main için bu regex'lerden biri eşleşmeli.
const _MAIN_NAME_RE = /\b(köfte|döner|kebap|kebab|tavuk|piliç|dana|kuzu|kıymal[ıi]|izgara|şiş|burger|hamburger|cheeseburger|pizza|makarna|mant[ıi]|tost|sandvi[çc]|sandwich|d[üu]r[üu]m|wrap|pide|lahmacun|çorba|pilav|tantuni|gözleme|sat[ıi]ç|fileto|dolma|sarma|bal[ıi]k|karides|spagetti|noodle|risotto|kumpir|nugget|hamsi)/i;

function _isLikelyMainDish(it) {
  if (!it) return false;
  if (it.kind === 'combo') return true; // combo'lar her zaman tam öğün
  if (it.kind === 'main' && _MAIN_NAME_RE.test(it.name || '')) return true;
  return false;
}

const SYSTEM_PROMPT = `Sen DealEat'in akıllı öneri motorusun. Aday ürünleri kullanıcının geçmişine göre Türkçe kısa rationale ile sun. Her ürün için MAX 1 kısa cümle (8-12 kelime). Samimi ton, emoji opsiyonel. SADECE JSON döndür, başka açıklama yapma.`;

function _buildScoringContext(items, history) {
  const queryTerms = (history || []).slice(-5).map(q => data.normTR(q));
  return items.map(it => {
    let score = 0;
    const nameN = data.normTR(it.name);
    const restN = data.normTR(it.restaurantName);
    for (const t of queryTerms) {
      if (!t || t.length < 2) continue;
      if (nameN.includes(t)) score += 10;
      else if (restN.includes(t)) score += 5;
    }
    if (it.distanceKm != null) score += Math.max(0, 5 - it.distanceKm);
    score += Math.max(0, (PRICE_CEIL - (it.minPrice || PRICE_CEIL)) / 50);
    return { ...it, _score: score };
  }).sort((a, b) => b._score - a._score);
}

function _coldStartRationale(item) {
  if (item.distanceKm != null && item.distanceKm < 2) return `Yakınında (${item.distanceKm}km), uygun fiyat`;
  if (item.minPrice && item.minPrice < 100) return `Bütçe dostu — ${item.minPrice} TL`;
  if (item.platforms && item.platforms.length > 1) return 'İki platformda da var, fiyat karşılaştırılabilir';
  return 'Bölgende öne çıkan seçim';
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const userLocation = (body.userLocation && typeof body.userLocation.lat === 'number' && typeof body.userLocation.lng === 'number')
    ? { lat: body.userLocation.lat, lng: body.userLocation.lng }
    : null;
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const isColdStart = history.length === 0;

  try {
    // 1) Candidate pool: ana yemek + combo. Price floor 100 TL (altı genelde
    // garnitür/aksesuar). Sonra ek filtre _isLikelyMainDish ile classifier %23
    // hata payına karşı isim regex'i koru ('Tavuk Topu', 'Tavuk Salam' vb. elenir).
    const rawPool = await data.searchItems({
      kind: ['main', 'combo'],
      priceMin: PRICE_FLOOR,
      priceMax: PRICE_CEIL,
      distanceMax: userLocation ? DIST_CEIL_KM : undefined,
      userLocation,
      limit: 60, // daha geniş havuz, regex sonrası filtrelenecek
    });
    const pool = rawPool.filter(_isLikelyMainDish);

    if (!pool.length) {
      return res.status(200).json({
        recommendations: [],
        coldStart: isColdStart,
        message: 'Bölgede uygun fiyatlı seçenek bulamadık. Konum/bütçe filtrelerini değiştir.',
        generatedAt: new Date().toISOString(),
      });
    }

    // 2) Score by history match + distance + price
    const scored = _buildScoringContext(pool, history);
    const top = scored.slice(0, REC_LIMIT);

    // 3) Cold-start path: skip Claude, use heuristic rationale
    if (isColdStart) {
      const recs = top.map(it => ({
        name: it.name,
        minPrice: it.minPrice,
        prices: it.prices,
        kind: it.kind,
        restaurantName: it.restaurantName,
        restaurantId: it.restaurantId,
        distanceKm: it.distanceKm,
        platforms: it.platforms,
        links: it.links,
        rationale: _coldStartRationale(it),
      }));
      return res.status(200).json({
        recommendations: recs,
        coldStart: true,
        generatedAt: new Date().toISOString(),
      });
    }

    // 4) Claude rationale generation
    const itemsTxt = top.map((it, i) =>
      `${i + 1}. ${it.name} | ${it.minPrice} TL | ${it.restaurantName} | ${it.distanceKm != null ? it.distanceKm + 'km' : '?km'}`
    ).join('\n');

    const historyTxt = history.slice(-5).join(' / ');

    const userPrompt = `Geçmiş aramalar: ${historyTxt}

Aday ürünler:
${itemsTxt}

Her ürün için MAX 1 cümle (8-12 kelime) rationale yaz. Geçmişteki aramayla bağlantı kurmaya çalış. Veriyi uydurma.

JSON formatı:
{"recommendations": [{"idx": 1, "rationale": "..."}, {"idx": 2, "rationale": "..."}]}`;

    let aiOutput = { recommendations: [] };
    try {
      const result = await generateText({
        model: anthropic(MODEL),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 500,
        temperature: 0.5,
      });
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) aiOutput = JSON.parse(match[0]);
    } catch (e) {
      console.warn('[recommendations] Claude rationale failed, falling back to heuristic:', e.message);
    }

    // 5) Merge AI rationale into top items
    const ratMap = new Map();
    for (const r of (aiOutput.recommendations || [])) {
      if (typeof r.idx === 'number' && typeof r.rationale === 'string') {
        ratMap.set(r.idx, r.rationale.trim());
      }
    }

    const recs = top.map((it, i) => ({
      name: it.name,
      minPrice: it.minPrice,
      prices: it.prices,
      kind: it.kind,
      restaurantName: it.restaurantName,
      restaurantId: it.restaurantId,
      distanceKm: it.distanceKm,
      platforms: it.platforms,
      links: it.links,
      rationale: ratMap.get(i + 1) || _coldStartRationale(it),
    }));

    return res.status(200).json({
      recommendations: recs,
      coldStart: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[recommendations] handler error:', e);
    return res.status(500).json({ error: 'Recommendations failed', detail: String(e?.message || e) });
  }
};
