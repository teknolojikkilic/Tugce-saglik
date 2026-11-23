// ───────────────────────────────────────────────────────────────
// Tuğçe Protokolü — Render sunucusu
//
// Ortam değişkenleri:
//   ANAHTAR       Uygulamaya ve API'ye giriş anahtarı (zorunlu)
//   DATABASE_URL  Neon Postgres bağlantı adresi (Render'da zorunlu; yoksa yerelde JSON dosyası kullanılır)
//   UYANIK_TUT    gunduz (varsayılan) | hep | kapali
//                 gunduz: uyanıştan 1 saat önce ile uykudan 30 dk sonrası arasında site uyumaz
//   PORT          Render kendisi verir
// ───────────────────────────────────────────────────────────────
import http from 'node:http';
import { Readable } from 'node:stream';
import { istekIsle, ayarlariOku } from './src/uygulama.js';
import { depoAc } from './src/depo.js';
import { TP } from './src/tp.js';

const PORT = Number(process.env.PORT) || 3000;
const RENDER_MI = !!process.env.RENDER;
const DIS_ADRES = process.env.RENDER_EXTERNAL_URL || '';
const UYANIK_TUT = (process.env.UYANIK_TUT || 'gunduz').toLowerCase();
const AZAMI_GOVDE = 1024 * 1024;

const ortam = { anahtar: process.env.ANAHTAR || '', depo: null, depoHatasi: null };

// ── depo bağlantısı (başarısız olursa 30 sn'de bir yeniden dener) ──
async function depoyuHazirla() {
  if (!process.env.DATABASE_URL && RENDER_MI) {
    ortam.depoHatasi =
      'Veritabanı bağlı değil. Render\'da Environment bölümüne DATABASE_URL adıyla Neon bağlantı adresini ekle. ' +
      'Bu olmadan girilen veriler site her uyuduğunda silinir.';
    console.error('[depo]', ortam.depoHatasi);
    return;
  }
  try {
    ortam.depo = await depoAc({ databaseUrl: process.env.DATABASE_URL, dosyaYolu: process.env.VERI_DOSYASI });
    ortam.depoHatasi = null;
    console.log(`[depo] hazır: ${ortam.depo.tur}`);
  } catch (e) {
    ortam.depoHatasi = 'Veritabanına bağlanılamadı: ' + e.message;
    console.error('[depo]', ortam.depoHatasi);
    setTimeout(depoyuHazirla, 30_000);
  }
}

// ── Node isteğini web standardı Request'e çevir ──
function webIstegi(req, govde) {
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const basliklar = new Headers();
  for (const [ad, deger] of Object.entries(req.headers)) {
    if (Array.isArray(deger)) deger.forEach((d) => basliklar.append(ad, d));
    else if (deger != null) basliklar.set(ad, deger);
  }
  return new Request(`${proto}://${host}${req.url}`, {
    method: req.method,
    headers: basliklar,
    body: govde && govde.length ? govde : undefined,
  });
}

function govdeTopla(req) {
  return new Promise((coz, red) => {
    if (req.method === 'GET' || req.method === 'HEAD') return coz(null);
    const parcalar = [];
    let boyut = 0;
    req.on('data', (p) => {
      boyut += p.length;
      if (boyut > AZAMI_GOVDE) { red(Object.assign(new Error('İstek çok büyük'), { durum: 413 })); req.destroy(); return; }
      parcalar.push(p);
    });
    req.on('end', () => coz(Buffer.concat(parcalar)));
    req.on('error', red);
  });
}

const sunucu = http.createServer(async (req, res) => {
  const bas = Date.now();
  try {
    const govde = await govdeTopla(req);
    const yanit = await istekIsle(webIstegi(req, govde), ortam);
    const basliklar = {};
    yanit.headers.forEach((d, a) => { basliklar[a] = d; });
    res.writeHead(yanit.status, basliklar);
    if (req.method === 'HEAD' || !yanit.body) res.end();
    else Readable.fromWeb(yanit.body).pipe(res);
    if (req.url.startsWith('/api/') && yanit.status >= 400) {
      console.warn(`[istek] ${req.method} ${req.url.replace(/k=[^&]+/, 'k=***')} → ${yanit.status} (${Date.now() - bas} ms)`);
    }
  } catch (e) {
    const durum = e.durum || 500;
    if (!res.headersSent) res.writeHead(durum, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ hata: e.message || 'Sunucu hatası' }));
  }
});

// ── uyanık tutma ──
// Render'ın ücretsiz planı 15 dk istek gelmezse siteyi uyutur. Site kendi dış adresine
// 10 dk'da bir istek atarak açık kalır; varsayılan olarak sadece gündüz.
async function uyanikMiKalsin() {
  if (UYANIK_TUT === 'hep') return true;
  if (UYANIK_TUT !== 'gunduz' || !ortam.depo) return false;
  const a = await ayarlariOku(ortam.depo);
  const n = TP.anParcalari(new Date(), a.tz).dakika;
  const bas = TP.mod((TP.dk(a.uyanma) ?? 390) - 60, 1440);
  const son = TP.mod((TP.dk(a.uyku) ?? 1350) + 30, 1440);
  return bas <= son ? n >= bas && n < son : n >= bas || n < son;
}
async function uyanikTut() {
  try {
    if (!(await uyanikMiKalsin())) return;
    const r = await fetch(`${DIS_ADRES}/saglik-kontrol`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) console.warn('[uyanik] yanıt', r.status);
  } catch (e) {
    console.warn('[uyanik]', e.message);
  }
}

sunucu.listen(PORT, () => {
  console.log(`Tuğçe Protokolü ${PORT} portunda çalışıyor`);
  if (!ortam.anahtar) console.warn('[uyarı] ANAHTAR tanımlı değil, API kapalı');
  depoyuHazirla();
  if (DIS_ADRES && UYANIK_TUT !== 'kapali') {
    console.log(`[uyanik] mod: ${UYANIK_TUT}`);
    setTimeout(uyanikTut, 60_000);
    setInterval(uyanikTut, 10 * 60_000);
  }
});

async function kapat() {
  sunucu.close();
  try { if (ortam.depo) await ortam.depo.kapat(); } catch { /* önemsiz */ }
  process.exit(0);
}
process.on('SIGTERM', kapat);
process.on('SIGINT', kapat);
