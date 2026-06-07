# Kafe Menü Sitesi

Tek bir kafe için bağımsız, mobil öncelikli **dijital QR menü**. Çerçeve yok, kurulum yok — sadece statik dosyalar.

## Dosyalar
- `index.html` — Menü sayfası (tasarım + içerik aynı dosyada).
- `qr.html` — Masaya konacak yazdırılabilir QR kodu üretir.

## İçeriği düzenleme
`index.html` dosyasını aç. En üstteki iki bölümü değiştirmen yeterli:

1. **`CAFE`** — kafe adı, slogan, adres, telefon, çalışma saatleri, Instagram/WhatsApp.
2. **`MENU`** — kategoriler ve ürünler. Her ürün: `{ name, desc, price, tag }`
   - `desc` ve `tag` isteğe bağlıdır.
   - `tag` örnekleri: `"YENİ"`, `"POPÜLER"`, `"VEGAN"`.

Başka hiçbir yere dokunmana gerek yok; menü ve sekmeler otomatik oluşur.

## Yayınlama
Statik olduğu için herhangi bir yerde yayınlanabilir (Vercel, Netlify, GitHub Pages...).
Yayınlandıktan sonra `qr.html` sayfasını aç, menü adresini gir, QR kodu **Yazdır** veya **PNG indir** ile al ve masalara koy.

## Yerelde önizleme
```bash
cd cafe-menu
python3 -m http.server 8090
# Tarayıcıda: http://localhost:8090
```
