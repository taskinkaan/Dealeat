// api/_tools.js
// Vercel AI SDK tool definitions for Claude tool use.
// Factory pattern: buildTools(context) returns tool registry with userLocation/history bound.

const { tool } = require('ai');
const { z } = require('zod');
const data = require('./_data.js');

const KIND_ENUM = z.enum(['main', 'combo', 'side', 'drink', 'dessert', 'bakery', 'breakfast', 'sauce', 'extra', 'retail', 'other']);
const PLAT_ENUM = z.enum(['trendyol', 'getir']);

/**
 * Build a tool registry bound to a request context.
 * @param {Object} ctx - Request-scoped context.
 * @param {{lat:number, lng:number} | null} ctx.userLocation - User's current location (optional).
 * @param {Array<string>} [ctx.history] - Recent user queries for personalization.
 * @param {Object} [ctx.preferences] - User preferences (dietary, etc.).
 */
function buildTools(ctx = {}) {
  const userLocation = ctx.userLocation || null;
  const history = ctx.history || [];
  const preferences = ctx.preferences || {};

  return {
    search_items: tool({
      description:
        'DealEat veritabanında menü ürünü ara. 1717 restoran, 141K item (Trendyol + Getir). ' +
        'Filtreler: kind (main, combo, dessert, vb.), fiyat aralığı, platform, mesafe, isim/restoran araması. ' +
        'Türkçe destekli (ç, ğ, ı, ö, ş, ü). Sonuçlar fiyata göre artan sıralı.',
      inputSchema: z.object({
        query: z.string().optional().describe(
          'Türkçe arama metni — item adı, restoran adı veya menü bölümünde geçen kelime. Örn: "köfte", "burger king", "menü"'
        ),
        kind: z.array(KIND_ENUM).optional().describe(
          'Yemek türü filtresi. main=ana yemek, combo=menü/kombo, dessert=tatlı, breakfast=kahvaltı, side=yan ürün, drink=içecek. Birden fazla seçilebilir.'
        ),
        priceMax: z.number().positive().optional().describe('Maksimum TL fiyat (sadece bu fiyata kadar olan ürünler)'),
        priceMin: z.number().nonnegative().optional().describe('Minimum TL fiyat'),
        platform: PLAT_ENUM.optional().describe('Sadece bu platforma sahip restoranlar (trendyol veya getir)'),
        distanceMax: z.number().positive().optional().describe(
          'Maksimum km. Sadece kullanıcı lokasyonu varsa anlamlı; yoksa filtre uygulanmaz.'
        ),
        limit: z.number().int().min(1).max(50).default(10).describe('Maksimum sonuç sayısı (varsayılan 10)'),
      }),
      execute: async (input) => {
        const results = await data.searchItems({ ...input, userLocation });
        return { count: results.length, items: results };
      },
    }),

    get_restaurant_detail: tool({
      description:
        'Belirli bir restoranın detayını al: menü (en popüler 6 item × 12 bölüm), fiyatlar, teslimat ücreti, ' +
        'min sipariş, lokasyon, hangi platformlarda olduğu, deep-link URL\'leri. ' +
        'Önce search_items ile restoranID öğrendikten sonra çağır.',
      inputSchema: z.object({
        restaurantId: z.string().describe('Restoran ID (örn. "ty_153613" Trendyol için, "gr_burger-king" Getir için)'),
      }),
      execute: async ({ restaurantId }) => {
        const detail = await data.getRestaurantDetail(restaurantId);
        if (!detail) return { error: 'Restoran bulunamadı', restaurantId };
        return detail;
      },
    }),

    compare_prices_for_item: tool({
      description:
        'Bir ürün adı için fiyat karşılaştırması yap. Aynı ürün farklı restoranlarda + farklı platformlarda kaç TL? ' +
        'Trendyol vs Getir kıyasını göstermek için kullan. Türkçe substring match yapar (örn. "köfte" → "Izgara Köfte" eşleşir).',
      inputSchema: z.object({
        itemName: z.string().min(2).describe('Aranan ürünün adı veya parçası (örn. "Köfteli Pilav", "burger")'),
        restaurantName: z.string().optional().describe('Belirli bir restoran zinciriyle filtrele (örn. "Burger King")'),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ itemName, restaurantName, limit }) => {
        const matches = await data.comparePricesForItem({
          itemName, restaurantName, userLocation, limit,
        });
        return { count: matches.length, matches };
      },
    }),

    get_user_context: tool({
      description:
        'Kullanıcının lokasyonu, geçmiş sorguları ve tercihlerini döndür. ' +
        'Kullanıcı "yakınımda", "bana özel", "bütçeme uygun" gibi konuma/geçmişe bağımlı bir şey sorduğunda çağır. ' +
        'Lokasyon yoksa null döner — bu durumda kullanıcıdan konum istenebilir.',
      inputSchema: z.object({}),
      execute: async () => {
        return {
          userLocation,
          historyCount: history.length,
          recentQueries: history.slice(-5),
          preferences,
        };
      },
    }),

    list_top_cheapest: tool({
      description:
        'Bir kategori için (main/combo/dessert/breakfast vb.) en ucuz N ürünü listele. ' +
        '"En ucuz öğle yemeği", "en ucuz kahvaltı" gibi sorularda kullan. ' +
        'Kullanıcı lokasyonu varsa otomatik 8km içinde filtreler.',
      inputSchema: z.object({
        kind: z.enum(['main', 'combo', 'breakfast', 'dessert', 'bakery', 'side']).describe('Yemek kategorisi'),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ kind, limit }) => {
        const items = await data.listTopCheapest({ kind, limit, userLocation });
        return { count: items.length, items };
      },
    }),
  };
}

module.exports = { buildTools };
