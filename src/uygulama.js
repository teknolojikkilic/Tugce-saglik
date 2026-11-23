// ───────────────────────────────────────────────────────────────
// Tuğçe Protokolü — istek yönlendirici
// Uygulamayı sunar, verileri depoda tutar, widget ve Apple Sağlık köprüsü için API verir.
// Web standardı Request/Response ile çalışır; server.js bunu Node'a bağlar.
// ───────────────────────────────────────────────────────────────
import fs from 'node:fs';
import { TP, TP_KOD } from './tp.js';

const kok = new URL('../', import.meta.url);
const oku = (yol) => fs.readFileSync(new URL(yol, kok));

function yerlestir(metin, isaret, deger) {
  const adet = metin.split(isaret).length - 1;
  if (adet !== 1) throw new Error(`"${isaret}" işareti ${adet} kez bulundu (1 olmalı)`);
  return metin.replace(isaret, () => deger);
}

export const WIDGET_JS = oku('scriptable/Protokol-widget.js').toString('utf8');

// Uygulama sayfası: ortak kod ve widget şablonu içine gömülür
export function uygulamaHtml({ onizleme = false } = {}) {
  let h = oku('src/app.html').toString('utf8');
  h = yerlestir(h, '/*__SHARED__*/', TP_KOD);
  h = yerlestir(h, '"__WIDGET_JS__"', JSON.stringify(WIDGET_JS));
  h = yerlestir(h, '/*__DEMO__*/', onizleme ? 'window.DEMO = true;' : '');
  return h;
}

const UYGULAMA_HTML = uygulamaHtml();
const IKON_180 = oku('ikon/ikon-180.png');
const IKON_512 = oku('ikon/ikon-512.png');

const JSON_BASLIK = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (veri, durum = 200) => new Response(JSON.stringify(veri), { status: durum, headers: JSON_BASLIK });
const hata = (mesaj, durum = 400) => json({ hata: mesaj }, durum);
const gunAnahtari = (ymd) => `gun:${ymd}`;

function manifest() {
  return {
    name: 'Tuğçe Protokolü',
    short_name: 'Protokol',
    start_url: '/',
    display: 'standalone',
    background_color: '#F3F6F4',
    theme_color: '#F3F6F4',
    lang: 'tr',
    icons: [
      { src: '/ikon-180.png', sizes: '180x180', type: 'image/png' },
      { src: '/ikon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}

function anahtarDogru(istek, url, anahtar) {
  const gelen = istek.headers.get('x-anahtar') || url.searchParams.get('k') || '';
  const dogru = String(anahtar || '');
  if (!dogru || gelen.length !== dogru.length) return false;
  let fark = 0;
  for (let i = 0; i < dogru.length; i++) fark |= gelen.charCodeAt(i) ^ dogru.charCodeAt(i);
  return fark === 0;
}

async function govdeOku(istek) {
  const tur = istek.headers.get('content-type') || '';
  try {
    if (tur.includes('application/json')) return await istek.json();
    if (tur.includes('form')) return Object.fromEntries((await istek.formData()).entries());
    const metin = await istek.text();
    return metin ? JSON.parse(metin) : {};
  } catch {
    return {};
  }
}

// ── veri yardımcıları ────────────────────────────────────────
export async function ayarlariOku(depo) {
  return TP.ayarTemizle({}, (await depo.oku('ayarlar')) || {});
}
async function gorevleriOku(depo) {
  let g = await depo.oku('gorevler');
  if (!Array.isArray(g)) {
    // İlk açılış: örnek bir rutinle başla
    g = TP.ORNEK_GOREVLER.map((x) => TP.gorevTemizle(x));
    await depo.yaz('gorevler', g);
  }
  return g;
}

// ── API ──────────────────────────────────────────────────────
async function api(istek, url, depo) {
  const yol = url.pathname.replace(/^\/api\/?/, '');
  const yontem = istek.method;
  const ayarlar = await ayarlariOku(depo);
  const simdi = TP.anParcalari(new Date(), ayarlar.tz);

  // Tüm uygulama durumu
  if (yol === 'durum' && yontem === 'GET') {
    const tarih = TP.YMD_RE.test(url.searchParams.get('tarih') || '') ? url.searchParams.get('tarih') : simdi.ymd;
    const [gorevler, gun, dun] = await Promise.all([
      gorevleriOku(depo),
      depo.oku(gunAnahtari(tarih)),
      depo.oku(gunAnahtari(TP.ymdEkle(tarih, -1))),
    ]);
    return json({ ayarlar, gorevler, tarih, gun: TP.gunNormalle(gun), dun: TP.gunNormalle(dun), simdi });
  }

  if (yol === 'ayarlar' && (yontem === 'PUT' || yontem === 'POST')) {
    const yeni = TP.ayarTemizle(await govdeOku(istek), ayarlar);
    await depo.yaz('ayarlar', yeni);
    return json({ ayarlar: yeni });
  }

  if (yol === 'gorevler' && (yontem === 'PUT' || yontem === 'POST')) {
    const govde = await govdeOku(istek);
    if (!Array.isArray(govde.gorevler)) return hata('gorevler listesi bekleniyor');
    const temiz = govde.gorevler.slice(0, 120).map(TP.gorevTemizle);
    await depo.yaz('gorevler', temiz);
    return json({ gorevler: temiz });
  }

  // Günlük kayıt işlemleri: görev işaretle, su, öğün, enerji
  const gunEslesme = yol.match(/^gun\/(\d{4}-\d{2}-\d{2})$/);
  if (gunEslesme && yontem === 'POST') {
    const tarih = gunEslesme[1];
    const govde = await govdeOku(istek);
    const [mevcut, gorevler] = await Promise.all([depo.oku(gunAnahtari(tarih)), gorevleriOku(depo)]);
    let gun;
    try {
      gun = TP.gunIslem(mevcut, govde, simdi.hm);
    } catch (e) {
      return hata(e.message);
    }
    gun.planli = TP.gununGorevleri(gorevler, tarih).length;
    await depo.yaz(gunAnahtari(tarih), gun);
    return json({ gun });
  }

  if (yol === 'gecmis' && yontem === 'GET') {
    const gunSayisi = Math.min(90, Math.max(1, parseInt(url.searchParams.get('gun') || '14', 10) || 14));
    const bitis = simdi.ymd;
    const baslangic = TP.ymdEkle(bitis, -(gunSayisi - 1));
    const satirlar = await depo.aralik(gunAnahtari(baslangic), gunAnahtari(bitis));
    const harita = {};
    for (const r of satirlar) harita[r.k.slice(4)] = r.v;
    const gorevler = await gorevleriOku(depo);
    const gunler = [];
    for (let i = 0; i < gunSayisi; i++) {
      const t = TP.ymdEkle(baslangic, i);
      const g = TP.gunNormalle(harita[t]);
      const liste = TP.gununGorevleri(gorevler, t);
      const planli = harita[t] && g.planli ? g.planli : liste.length;
      const pencere = TP.yemePenceresi(g);
      gunler.push({
        tarih: t,
        yapilan: Object.keys(g.yapilan).length,
        planli,
        su: TP.suToplam(g).toplam,
        pencere: pencere ? pencere.dakika : null,
        enerji: g.enerji,
        kalori: TP.beslenmeToplam(g).kcal ?? (g.saglik && g.saglik.kalori) ?? null,
        adim: g.saglik && g.saglik.adim != null ? g.saglik.adim : null,
        kayitVar: !!harita[t],
      });
    }
    return json({ gunler, suHedef: ayarlar.suHedef });
  }

  // Scriptable widget'ı için özet
  if (yol === 'widget' && yontem === 'GET') {
    const [gorevler, bugun, dun] = await Promise.all([
      gorevleriOku(depo),
      depo.oku(gunAnahtari(simdi.ymd)),
      depo.oku(gunAnahtari(TP.ymdEkle(simdi.ymd, -1))),
    ]);
    const ozet = TP.gunOzeti({ ayarlar, gorevler, bugun, dun, an: new Date() });
    return json({ ...ozet, site: url.origin });
  }

  // Apple Sağlık köprüsü (Kestirmeler buraya gönderir). GET de kabul edilir.
  if (yol === 'saglik' && (yontem === 'POST' || yontem === 'GET')) {
    const veri = yontem === 'GET' ? Object.fromEntries(url.searchParams.entries()) : await govdeOku(istek);
    const tarih = TP.YMD_RE.test(veri.tarih || '') ? veri.tarih : simdi.ymd;
    const [mevcut, gorevler] = await Promise.all([depo.oku(gunAnahtari(tarih)), gorevleriOku(depo)]);
    const gun = TP.gunIslem(mevcut, { islem: 'saglik', veri }, simdi.hm);
    gun.planli = TP.gununGorevleri(gorevler, tarih).length;
    await depo.yaz(gunAnahtari(tarih), gun);
    return json({ tamam: true, tarih, saglik: gun.saglik, mesaj: 'Sağlık verisi kaydedildi' });
  }

  // Yedek: tüm veriyi indir
  if (yol === 'yedek' && yontem === 'GET') {
    const veri = {};
    for (const r of await depo.hepsi()) veri[r.k] = r.v;
    return new Response(JSON.stringify(veri, null, 2), {
      headers: { ...JSON_BASLIK, 'content-disposition': `attachment; filename="protokol-yedek-${simdi.ymd}.json"` },
    });
  }

  return hata('Böyle bir adres yok', 404);
}

// ── giriş noktası ────────────────────────────────────────────
// ortam: { depo, anahtar, depoHatasi }
export async function istekIsle(istek, ortam) {
  const url = new URL(istek.url);
  const yol = url.pathname;

  if (yol === '/' || yol === '/index.html') {
    return new Response(UYGULAMA_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
    });
  }
  if (yol === '/saglik-kontrol') {
    return new Response('ok', { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
  }
  if (yol === '/manifest.webmanifest') {
    return new Response(JSON.stringify(manifest()), {
      headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=86400' },
    });
  }
  if (yol === '/ikon-180.png' || yol === '/apple-touch-icon.png' || yol === '/ikon-512.png' || yol === '/favicon.ico') {
    return new Response(yol === '/ikon-512.png' ? IKON_512 : IKON_180, {
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' },
    });
  }
  if (yol === '/widget.js') {
    return new Response(WIDGET_JS.replace('__SITE__', url.origin), {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' },
    });
  }

  if (yol.startsWith('/api/')) {
    if (!ortam.anahtar) return hata('ANAHTAR tanımlı değil. Render\'da Environment bölümüne ANAHTAR adıyla bir değişken ekle.', 500);
    if (ortam.depoHatasi) return hata(ortam.depoHatasi, 503);
    if (!ortam.depo) return hata('Veritabanı hazırlanıyor, birkaç saniye sonra tekrar dene.', 503);
    if (!anahtarDogru(istek, url, ortam.anahtar)) return hata('Anahtar yanlış', 401);
    try {
      return await api(istek, url, ortam.depo);
    } catch (e) {
      console.error('[api]', e);
      return hata('Sunucu hatası: ' + (e && e.message ? e.message : String(e)), 500);
    }
  }

  return new Response('Bulunamadı', { status: 404 });
}
