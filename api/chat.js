const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { query, candidates } = req.body || {};
  if (!query || !Array.isArray(candidates)) {
    return res.status(400).json({ error: 'query ve candidates gerekli' });
  }

  const itemLines = candidates.slice(0, 80).map((it, i) =>
    `${i + 1}. "${it.n}" - ${it.rn} - min ${it.minP} TL`
  ).join('\n');

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Sen DealEat uygulamasının yemek sipariş asistanısın. Kullanıcının Türkçe isteğini analiz edip verilen menü listesinden en uygun öğeleri seç. SADECE JSON döndür, başka hiçbir şey yazma.`,
      messages: [{
        role: 'user',
        content: `Kullanıcı isteği: "${query}"

Mevcut menü öğeleri:
${itemLines}

En uygun 1-8 öğeyi seç. Şu JSON formatında yanıtla:
{"items":[{"idx":1,"reason":"kısa sebep"}],"summary":"1 cümle özet"}`
      }]
    });
  } catch (err) {
    return res.status(500).json({ error: 'Claude API hatası', detail: err.message });
  }

  const text = message.content[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return res.status(200).json({ items: [], summary: 'Sonuç bulunamadı.' });

  try {
    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch {
    return res.status(200).json({ items: [], summary: 'Yanıt ayrıştırılamadı.' });
  }
};
