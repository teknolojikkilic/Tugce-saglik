# Tuğçe Protokolü

Tuğçe Tartıcı için hazırlanan kişisel günlük protokol uygulaması:

- **24 saatlik güneş saati:** Bulunduğu yerin gün doğumu ve batımına göre günün evresini gösterir (sabah ışığı, odak, gün batımı, uykuya hazırlık…). Kafein ve uyku penceresi de kadranda görünür. Gece olunca ekran mavi ışık içermeyen amber tonlara geçer.
- **Görevler:** Tuğçe Hoca kendisi ekler: ad, simge, saat (ya da saatsiz), süre, tekrar (her gün / belirli günler / tek gün), not. Süreli görevlerde sayaç, bitince zil ve otomatik işaretleme var.
- **Beslenme:** Su (bardak, 500 ml, özel miktar), öğünler (isteğe bağlı kalori ve protein), son öğünden beri geçen açlık süresi, yeme penceresi.
- **EatBetter bağlantısı:** Apple Sağlık üzerinden. Su, kalori, adım, HRV ve nabız siteye gelir.
- **Geçmiş:** Son 14 gün; rutin tamamlama, su, yeme penceresi, enerji grafikleri ve seri.
- **iPhone widget'ı (4x4):** Görevler, su ve açlık süresi. Bir göreve dokununca o görev, suya dokununca bir bardak eklenmiş halde, öğüne dokununca öğün ekleme ekranı açılır.

## Yapı

| Dosya | Ne işe yarar |
|---|---|
| `server.js` | Render'da çalışan Node sunucusu, gündüz uyanık tutma |
| `src/uygulama.js` | Sayfa, ikonlar ve API |
| `src/depo.js` | Veri: Neon Postgres (yerelde JSON dosyası) |
| `src/shared.js` | Güneş saati, görev ve gün hesapları (sunucu ve tarayıcı ortak) |
| `src/app.html` | Arayüz |
| `scriptable/Protokol-widget.js` | iPhone widget'ı (sitedeki Ayarlar'dan hazır kopyalanır) |
| `.github/workflows/sabah-uyandir.yml` | Her sabah siteyi uyandırır |
| `test/` | Uçtan uca API testleri, arayüz ve widget testleri |

---

## 1. Render + Neon kurulumu

**Neden Neon:** Render'ın ücretsiz planında disk geçici (site uyuyunca silinir) ve ücretsiz Postgres 30 gün sonra siliniyor. Neon'un ücretsiz Postgres'i süresiz.

1. **Neon:** neon.tech → GitHub ile giriş → proje `tugce-protokol`, bölge **AWS Europe Central 1 (Frankfurt)** → **Connect** → `postgresql://…` adresini kopyala. Tablo ilk açılışta kendiliğinden oluşur.
2. **Render:** New → Web Service → bu repo → ayarlar:
   - Region: **Frankfurt**, Runtime: **Node**, Plan: **Free**
   - Build Command: `npm install`, Start Command: `npm start`
   - Health Check Path: `/saglik-kontrol`
3. **Environment** bölümüne:

| Değişken | Değer |
|---|---|
| `ANAHTAR` | Uygulamaya giriş anahtarı (uzun ve tahmin edilemez olsun) |
| `DATABASE_URL` | Neon'dan kopyalanan adres |
| `UYANIK_TUT` | `gunduz` (varsayılan), `hep` ya da `kapali` |

`DATABASE_URL` yoksa API çalışmaz ve neden çalışmadığını söyler. Böylece veriler fark edilmeden kaybolmaz.

### Uyanık tutma

Render'ın ücretsiz planı, 15 dakika istek gelmeyen siteyi uyutur. Uyandırması yaklaşık 1 dakika sürer ve bu sürede widget eski veriyi gösterir.

- **`UYANIK_TUT=gunduz`:** Site, uyanış saatinden 1 saat önce ile uyku saatinden 30 dakika sonrası arasında (varsayılan 05:30–23:00) 10 dakikada bir kendine istek atar ve uyumaz. Gece uyur. Ayda yaklaşık 540 saat harcar.
- **Sabah uyandırma:** `.github/workflows/sabah-uyandir.yml` her sabah 05:40 ve 06:40'ta siteyi uyandırır. GitHub zamanlayıcıları birkaç dakika gecikebilir. Saat ayarları değişirse dosyadaki `cron` satırlarını güncelle (saatler UTC, Türkiye = UTC+3).
- Render her workspace'e ayda **750 ücretsiz saat** veriyor ve bu süre tüm ücretsiz servislerde ortak. `UYANIK_TUT=hep` seçilirse neredeyse hepsini bu site kullanır ve ay sonunda diğer ücretsiz servisler durabilir.

---

## 2. Hediyeyi teslim et (Tuğçe Hoca'nın iPhone'unda)

1. Linki gönder: `https://tugce-saglik.onrender.com/?k=ANAHTAR`. İlk açılışta anahtar telefona kaydedilir ve adres çubuğundan silinir.
2. Hoş geldin ekranında **Konumumu kullan ve başla**. Güneş saati bu konuma göre hesaplanır.
3. **Ana ekrana ekle:** Safari'de Paylaş → **Ana Ekrana Ekle**. Ana ekrandaki uygulama Safari'den ayrı hafıza kullandığı için ilk açılışta anahtarı bir kez sorar.

> Anahtar, verilere erişimin tek koruması. Linki sadece Tuğçe Hoca'yla paylaş.

---

## 3. iPhone widget'ı (Scriptable)

iPhone'da bir web sitesi tek başına widget olamaz. Ücretsiz **Scriptable** uygulaması bu köprüyü kurar.

1. App Store'dan **Scriptable**'ı indir.
2. Sitede **Ayarlar → Widget kodunu kopyala**. Kod, site adresi ve anahtarla hazır kopyalanır.
3. Scriptable'da sağ üstteki **+** → kodu yapıştır → betik adını **Protokol** yap.
4. Ana ekranda boş bir yere basılı tut → sol üstteki **Düzenle → Widget Ekle** → **Scriptable** → en büyük boyutu seç → ekle.
5. Widget'a basılı tut → **Widget'ı Düzenle** → **Script: Protokol**.

Widget yaklaşık 15 dakikada bir yenilenir (zamanlamayı iOS belirler). Site uyurken son kaydettiği veriyi "Çevrimdışı" notuyla gösterir.

| Dokunulan yer | Ne olur |
|---|---|
| Boş alan | Uygulama açılır |
| Bir görev | O görevin sayfası açılır (başlat / tamamla / düzenle) |
| Su kutusu | Bir bardak eklenir, "Geri al" seçeneğiyle |
| Açlık kutusu | Öğün ekleme ekranı açılır |
| Sağlık senkronu | Aşağıdaki kestirme çalışır |

---

## 4. EatBetter → Apple Sağlık → site köprüsü

EatBetter'ın dışarıya açık bir API'si yok. Ama EatBetter su ve adımı **Apple Sağlık**'la senkronluyor. Bir **Kestirme** (Shortcut), bugünün toplamlarını Sağlık'tan okuyup siteye gönderir.

**Önce kontrol:** Sağlık uygulaması → Göz At → Beslenme → **Su** (ve **Alınan Enerji**) → en altta **Veri Kaynakları ve Erişim**. EatBetter orada yazıyor olmalı. Kalori orada yoksa EatBetter kaloriyi Sağlık'a yazmıyordur; o zaman kalori alanı boş gelir, gerisi çalışır.

### Kestirmeyi kur

Kestirmeler uygulaması → **+** → ad: **Protokol Senkron** (bu ad önemli: widget ve uygulamadaki "Şimdi senkronla" düğmesi bu adı çağırır).

1. **Sağlık Örneklerini Bul** (Find Health Samples) → Tür: **Su**, Başlangıç Tarihi: **Bugün**.
2. **İstatistikleri Hesapla** (Calculate Statistics) → **Toplam**. Çıktıyı `su` olarak düşün.
3. 1–2'yi tekrarla: **Alınan Enerji** (Dietary Energy) → `kalori`, **Adım** (Steps) → `adim`.
   İsteğe bağlı: **Protein** → `protein` (toplam); **Kalp Hızı Değişkenliği** (HRV) ve **Dinlenik Kalp Hızı** (Resting Heart Rate) için "en yeni 1 örnek" → `hrv`, `nabiz`.
4. **URL'nin İçeriğini Al** (Get Contents of URL):
   - URL: sitede **Ayarlar → Senkron adresini kopyala** ile alınan adres (`…/api/saglik?k=ANAHTAR`)
   - Yöntem: **POST**, İstek Gövdesi: **JSON**
   - Alanlar (Sayı türünde): `su`, `kalori`, `adim` (+ varsa `protein`, `hrv`, `nabiz`), değer olarak ilgili istatistik sonuçları
5. Bir kez elle çalıştır, Sağlık erişim izinlerine **İzin Ver**.

Sunucu Türkçe sayı biçimlerini (`1.640`, `1,25`) ve litre/mililitre farkını kendisi çözer. Site uyuyorsa ilk istek yaklaşık 1 dakika sürebilir; Kestirmeler bekler.

### Otomatik çalıştır

Kestirmeler → **Otomasyon** → **+** → **Uygulama** → **EatBetter** → **Kapatıldığında** → **Hemen Çalıştır** → **Protokol Senkron**.

> Su çift sayılmaz: Sitede eklenen su Sağlık'a yazılmaz. Gösterilen toplam = sitede eklenen + Sağlık'tan gelen.

---

## 5. Kişiselleştirme

- **Hediye notu ve imza:** `src/app.html` içinde `HEDIYE_NOTU` ve `HEDIYE_IMZA` satırları. Değiştirip GitHub'a gönderince Render kendiliğinden yeniden yayınlar.
- **Uyanış/uyku saati, kafein kuralları, su hedefi, konum:** Uygulamada **Ayarlar** ekranından.
- **Tema:** Ayarlar → Görünüm: güneşe göre / hep açık / hep koyu.
- **Yedek:** Ayarlar → **Verileri indir** (tüm veri JSON olarak).

## 6. Geliştirme

```bash
npm install
ANAHTAR=deneme npm run dev          # http://localhost:3000/?k=deneme  (veri: veri/protokol.json)
npm test                            # uçtan uca testler, JSON dosyasıyla
TEST_DATABASE_URL=postgres://… npm test   # aynı testler Postgres ile (kv tablosunu siler!)
npm run onizleme                    # onizleme/onizleme.html: sunucusuz, örnek verili önizleme
```

Önizlemede saati denemek için `?saat=21:40`, temayı zorlamak için `?tema=koyu`, hoş geldin ekranı için `?hosgeldin=1` ekle.
