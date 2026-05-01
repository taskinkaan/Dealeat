// api/chat.js
// Conversational chat endpoint for DealEat AI assistant.
// Powered by Vercel AI SDK v6 + Anthropic Claude (Haiku 4.5 default, with tool use loop).
// Multi-turn streaming via UI Message Stream Protocol.

const { streamText, stepCountIs, convertToModelMessages } = require('ai');
const { createAnthropic } = require('@ai-sdk/anthropic');
const { buildTools } = require('./_tools.js');

// Explicit provider config: bypass Vercel AI Gateway auto-routing (which has been
// surfacing 404s when VERCEL_OIDC_TOKEN is present without proper Gateway setup).
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});

const MODEL_DEFAULT = 'claude-haiku-4-5';
const MAX_TOOL_STEPS = 10;

const SYSTEM_PROMPT = `Sen DealEat'in yemek asistanısın — İstanbul'da Trendyol ve Getir platformlarındaki 1717 restoran, 141K menü item içeren bir veritabanına erişimin var. Kullanıcılar Türkçe sorar ("100 TL altı burger?", "yakınımda kahvaltı?", "tatlı önerin?") sen tool'larla arar ve 3-7 somut öneri sunarsın.

ÇALIŞMA STİLİ:
- Önce tool kullan, ezberden cevap verme. Veritabanında olmayan restoran/ürün uydurma.
- Cevap kısa, samimi, eylemli olsun. Emoji kullanabilirsin (🍔 🍕 🥗 ☕ 🧁).
- Her öneride: ürün adı, fiyat (TL), restoran adı, varsa platform link.
- Aynı ürün hem Trendyol hem Getir'de varsa fiyat farkını mutlaka belirt.

KIND EŞLEMELERİ (search_items / list_top_cheapest):
- "ana yemek / yemek / öğle / akşam" → kind=['main']
- "menü / kombo / ikili" → kind=['combo']
- "tatlı / dondurma / pasta" → kind=['dessert']
- "kahvaltı / serpme" → kind=['breakfast']
- "kahve / çay / içecek / soğuk içecek" → kind=['drink']
- "atıştırmalık / yan ürün / patates kızartması" → kind=['side']
- "ekmek / börek / simit / poğaça" → kind=['bakery']
Birden fazla kind aynı sorguda olabilir (örn. "menü veya ana yemek" → kind=['main','combo']).

LOKASYON:
- "yakınımda / civarımda / yakındaki" geçerse: önce get_user_context çağır. Lokasyon varsa distanceMax=5 (km) ile ara.
- Lokasyon yoksa kullanıcıya "Konum açabilir misin? Yakınındaki restoranları gösterebilirim" gibi nazik bir not ekle.

KARŞILAŞTIRMA:
- "Trendyol vs Getir" gibi sorularda compare_prices_for_item kullan.
- Cevapta hangi platformun daha ucuz olduğunu net söyle ve TL farkını belirt.

VERİMLİ TOOL KULLANIMI:
- search_items 1-2 çağrı yeter; sonuç boşsa filtreleri gevşet, gereksiz tekrar etme.
- get_restaurant_detail sadece kullanıcı belirli bir restoranın menüsünü/teslimatını sorduğunda.
- compare_prices_for_item sadece açık karşılaştırma sorusu varsa.
- list_top_cheapest "en ucuz X" gibi açık sorularda; başka tool kullandıysan tekrar çağırma.
- Yeterli veriye ulaşınca DUR ve cevabı yaz. Boş sonuç → "Aradığın kriterde ürün yok, X öneriyorum" de.

YASAKLI:
- Sipariş alma, ödeme, tarif, diyet tavsiyesi.
- Veritabanı dışı tahmin (örn. "muhtemelen X TL'dir").
- Tool çağırmadan fiyat söyleme.

Tool sonuçları sana strüktüre veri olarak gelir; kullanıcıya doğal Türkçe ile özetle. links field'ında URL varsa cevabında "🔗 Trendyol: ..." formatında ver.`;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  let { messages, userLocation, history } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Sanity-cap: never let runaway client send 200-message conversation
  if (messages.length > 40) {
    messages = messages.slice(-40);
  }

  // Convert client `{role, content: string}` to AI SDK UIMessage format if needed.
  // We accept both shapes. UIMessage has parts: [{type:'text', text}].
  const uiMessages = messages.map((m, i) => {
    if (m && Array.isArray(m.parts)) return { id: m.id || `m-${i}`, role: m.role, parts: m.parts };
    const text = typeof m.content === 'string' ? m.content : String(m.content ?? '');
    return { id: m.id || `m-${i}`, role: m.role || 'user', parts: [{ type: 'text', text }] };
  });

  const tools = buildTools({
    userLocation: (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number')
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : null,
    history: Array.isArray(history) ? history.slice(-10) : [],
  });

  try {
    const modelMessages = await convertToModelMessages(uiMessages);

    const result = streamText({
      model: anthropic(MODEL_DEFAULT),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      // Sane defaults; can be tuned per-model later
      temperature: 0.4,
      maxOutputTokens: 1200,
    });

    // Stream UI Message events to response (SSE-style)
    return result.pipeUIMessageStreamToResponse(res, {
      // Don't expose token usage to client (privacy + slight UX cleanup)
      sendUsage: false,
      // Keep onError minimal: surface a generic error message to the client
      onError: (err) => {
        console.error('[api/chat] stream error:', err);
        return 'Üzgünüm, bir sorun oluştu. Tekrar dener misin?';
      },
    });
  } catch (e) {
    console.error('[api/chat] handler error:', e);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Chat failed', detail: String(e?.message || e) });
    }
  }
};
