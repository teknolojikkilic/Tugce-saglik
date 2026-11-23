// Sunucuyu (server.js) gerçekten başlatıp HTTP üzerinden uçtan uca dener.
// Kullanım:
//   node test/api-test.mjs                                   → JSON dosyası deposuyla
//   TEST_DATABASE_URL=postgres://... node test/api-test.mjs  → Postgres ile (kv tablosu silinir!)
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const ANAHTAR = 'gizli-anahtar-123';
const B = `http://127.0.0.1:${PORT}`;
const PUBLIK = 'tugce-saglik.onrender.com';
const geciciDizin = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-'));
const DB = process.env.TEST_DATABASE_URL || '';

if (DB) {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  await c.query('DROP TABLE IF EXISTS kv');
  await c.end();
}

function sunucuBaslat(ekOrtam = {}) {
  const temel = { ...process.env };
  delete temel.RENDER; delete temel.RENDER_EXTERNAL_URL;
  const env = { ...temel, PORT: String(PORT), ANAHTAR, VERI_DOSYASI: path.join(geciciDizin, 'veri.json'), DATABASE_URL: DB, ...ekOrtam };
  for (const [k, v] of Object.entries(ekOrtam)) if (v === undefined) delete env[k];
  const s = spawn(process.execPath, ['server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  s.stdout.on('data', (d) => { log += d; });
  s.stderr.on('data', (d) => { log += d; });
  s.log = () => log;
  return s;
}
async function hazirBekle() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${B}/api/durum`, { headers: { 'x-anahtar': ANAHTAR } });
      if (r.status !== 503) return;
    } catch { /* henüz açılmadı */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Sunucu açılmadı');
}
async function istek(yol, { yontem = 'GET', govde, anahtar = ANAHTAR, basliksiz, ham } = {}) {
  const headers = { 'content-type': 'application/json', 'x-forwarded-host': PUBLIK, 'x-forwarded-proto': 'https' };
  if (!basliksiz) headers['x-anahtar'] = anahtar;
  const r = await fetch(B + yol, { method: yontem, headers, body: govde ? JSON.stringify(govde) : undefined });
  if (ham) return r;
  const tur = r.headers.get('content-type') || '';
  return { durum: r.status, tur, veri: tur.includes('json') ? await r.json() : await r.text() };
}
let gecen = 0;
const dene = async (ad, fn) => { await fn(); gecen++; console.log('✓', ad); };
const kapat = (s) => new Promise((r) => { s.once('exit', r); s.kill('SIGTERM'); });

console.log(`Depo: ${DB ? 'Postgres' : 'JSON dosyası'}\n`);

// Render'da DATABASE_URL yoksa veri kaybını önlemek için API kapanmalı
await dene('Render\'da DATABASE_URL yoksa API açıklayıcı 503 verir', async () => {
  const s = sunucuBaslat({ RENDER: 'true', DATABASE_URL: undefined });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(B + '/saglik-kontrol'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    const r = await istek('/api/durum');
    assert.equal(r.durum, 503);
    assert.match(r.veri.hata, /DATABASE_URL/);
  } finally {
    await kapat(s);
  }
});

const sunucu = sunucuBaslat();
try {
  await hazirBekle();

  await dene('Ana sayfa HTML döner (önizleme modu kapalı)', async () => {
    const r = await istek('/', { basliksiz: true });
    assert.equal(r.durum, 200);
    assert.match(r.veri, /Tuğçe Protokolü/);
    assert.doesNotMatch(r.veri, /window\.DEMO = true/);
    assert.match(r.veri, /const TP = /);
  });
  await dene('Sağlık kontrolü, ikon ve manifest', async () => {
    assert.equal((await istek('/saglik-kontrol', { basliksiz: true })).veri, 'ok');
    const r = await istek('/ikon-180.png', { ham: true });
    const b = new Uint8Array(await r.arrayBuffer());
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.deepEqual([...b.slice(1, 4)], [80, 78, 71]);
    assert.equal((await istek('/manifest.webmanifest', { basliksiz: true })).veri.name, 'Tuğçe Protokolü');
  });
  await dene('Anahtarsız ya da yanlış anahtarla API 401', async () => {
    assert.equal((await istek('/api/durum', { basliksiz: true })).durum, 401);
    assert.equal((await istek('/api/durum', { anahtar: 'yanlis-anahtar-12' })).durum, 401);
  });
  let tarih;
  await dene('İlk durum: varsayılan ayarlar ve örnek görevler', async () => {
    const r = await istek('/api/durum');
    assert.equal(r.durum, 200);
    assert.equal(r.veri.ayarlar.ad, 'Tuğçe');
    assert.equal(r.veri.gorevler.length, 6);
    tarih = r.veri.tarih;
  });
  await dene('Ayar güncelle (geçersiz değerler süzülür)', async () => {
    const r = await istek('/api/ayarlar', { yontem: 'PUT', govde: { uyanma: '06:00', uyku: '25:00', suHedef: '3.000', tz: 'Mars/Olympus', lat: '38,42', lon: 27.14, sehir: 'İzmir' } });
    assert.equal(r.veri.ayarlar.uyanma, '06:00');
    assert.equal(r.veri.ayarlar.uyku, '22:30');
    assert.equal(r.veri.ayarlar.suHedef, 3000);
    assert.equal(r.veri.ayarlar.tz, 'Europe/Istanbul');
    assert.equal(r.veri.ayarlar.lat, 38.42);
  });
  let gorevId;
  await dene('Görev listesi kaydet', async () => {
    const d = (await istek('/api/durum')).veri;
    const liste = [...d.gorevler, { ad: 'Sauna', emoji: '🔥', saat: '19:00', sure: '20', tekrar: 'gunler', gunler: [2, 4, 9] }, { ad: '<b>x</b>', saat: 'abc', tekrar: 'tek' }];
    const r = await istek('/api/gorevler', { yontem: 'PUT', govde: { gorevler: liste } });
    assert.equal(r.veri.gorevler.length, 8);
    assert.deepEqual(r.veri.gorevler.find((g) => g.ad === 'Sauna').gunler, [2, 4]);
    assert.equal(r.veri.gorevler[7].tekrar, 'her');
    gorevId = r.veri.gorevler[0].id;
  });
  await dene('Gün işlemleri: görev, su, öğün, enerji', async () => {
    const yolla = (govde) => istek(`/api/gun/${tarih}`, { yontem: 'POST', govde });
    let r = await yolla({ islem: 'gorev', id: gorevId, t: '07:12' });
    assert.equal(r.veri.gun.yapilan[gorevId], '07:12');
    await yolla({ islem: 'su', ml: 250, t: '08:00' });
    r = await yolla({ islem: 'su', ml: 500, t: '11:00' });
    assert.equal(r.veri.gun.su.length, 2);
    r = await yolla({ islem: 'su-sil', id: r.veri.gun.su[0].id });
    assert.equal(r.veri.gun.su.length, 1);
    r = await yolla({ islem: 'ogun', ogun: { tur: 'kahvalti', ad: 'Yumurta', t: '09:30', kcal: '420', protein: '' } });
    assert.equal(r.veri.gun.ogunler[0].kcal, 420);
    r = await yolla({ islem: 'enerji', deger: 4 });
    assert.equal(r.veri.gun.enerji, 4);
    r = await yolla({ islem: 'gorev', id: gorevId });
    assert.equal(r.veri.gun.yapilan[gorevId], undefined);
    assert.equal((await yolla({ islem: 'uydurma' })).durum, 400);
  });
  await dene('Eşzamanlı yazmalar sunucuyu bozmaz', async () => {
    const sonuclar = await Promise.all(Array.from({ length: 8 }, () => istek(`/api/gun/${tarih}`, { yontem: 'POST', govde: { islem: 'enerji', deger: 3 } })));
    assert.ok(sonuclar.every((x) => x.durum === 200));
  });
  await dene('Apple Sağlık köprüsü: POST JSON, Türkçe sayı biçimleri', async () => {
    const r = await istek('/api/saglik', { yontem: 'POST', govde: { su: '1,25', kalori: '1.640', adim: '8.432', hrv: 54.6, nabiz: '58' } });
    assert.equal(r.veri.saglik.su, 1250);
    assert.equal(r.veri.saglik.kalori, 1640);
    assert.equal(r.veri.saglik.adim, 8432);
  });
  await dene('Apple Sağlık köprüsü: GET ve ?k= ile', async () => {
    const r = await istek(`/api/saglik?k=${ANAHTAR}&su=900&adim=5000`, { basliksiz: true });
    assert.equal(r.veri.saglik.su, 900);
  });
  await dene('Widget özeti, dış adres https olarak görünür', async () => {
    const r = await istek(`/api/widget?k=${ANAHTAR}`, { basliksiz: true });
    const v = r.veri;
    for (const k of ['ad', 'tarihMetin', 'saat', 'evre', 'kafein', 'gunes', 'gorevler', 'su', 'site']) assert.ok(k in v, k);
    assert.equal(v.su.toplam, 500 + 900);
    assert.equal(v.site, `https://${PUBLIK}`);
    console.log('   ', v.saat, v.evre.emoji, v.evre.baslik, '|', v.kafein.metin, '| görev', `${v.yapilan}/${v.planli}`, '| su', v.su.toplam);
  });
  await dene('Geçmiş (anahtar aralığı sorgusu)', async () => {
    const r = await istek('/api/gecmis?gun=14');
    assert.equal(r.veri.gunler.length, 14);
    const bugun = r.veri.gunler.at(-1);
    assert.equal(bugun.tarih, tarih);
    assert.equal(bugun.su, 1400);
    assert.equal(bugun.enerji, 3);
    assert.equal(r.veri.gunler.filter((g) => g.kayitVar).length, 1);
  });
  await dene('Widget betiği site adresiyle hazır', async () => {
    const r = await istek('/widget.js', { basliksiz: true });
    assert.match(r.veri, new RegExp(`const SITE = "https://${PUBLIK.replace(/\./g, '\\.')}"`));
  });
  await dene('Yedek indir', async () => {
    const r = await istek(`/api/yedek?k=${ANAHTAR}`, { basliksiz: true });
    assert.ok(r.veri.ayarlar && r.veri.gorevler && r.veri[`gun:${tarih}`]);
  });
  await dene('Çok büyük istek reddedilir', async () => {
    const r = await fetch(`${B}/api/gorevler`, { method: 'PUT', headers: { 'x-anahtar': ANAHTAR, 'content-type': 'application/json' }, body: 'x'.repeat(1_200_000) }).catch((e) => ({ status: 'kesildi', e }));
    assert.ok(r.status === 413 || r.status === 'kesildi');
  });
} catch (e) {
  console.error('\nSunucu günlüğü:\n' + sunucu.log());
  throw e;
} finally {
  await kapat(sunucu);
}

await dene('Yeniden başlatınca veriler duruyor', async () => {
  const s = sunucuBaslat();
  try {
    await hazirBekle();
    const r = await istek('/api/durum');
    assert.equal(r.veri.ayarlar.uyanma, '06:00');
    assert.equal(r.veri.gorevler.length, 8);
    assert.equal(r.veri.gun.ogunler.length, 1);
  } finally {
    await kapat(s);
  }
});

console.log(`\n${gecen} test geçti`);
