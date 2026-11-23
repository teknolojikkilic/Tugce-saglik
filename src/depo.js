// ───────────────────────────────────────────────────────────────
// Depolama: anahtar → JSON değer
//   • DATABASE_URL varsa Postgres (Neon)  → kalıcı
//   • yoksa yerel JSON dosyası              → sadece bilgisayarda deneme için
// Her iki depo da aynı dört işlemi verir: oku, yaz, aralik, hepsi.
// ───────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

export async function depoAc({ databaseUrl, dosyaYolu }) {
  if (databaseUrl) return postgresDepo(databaseUrl);
  return dosyaDepo(dosyaYolu);
}

// ── Postgres ──────────────────────────────────────────────────
async function postgresDepo(databaseUrl) {
  const { default: pg } = await import('pg');
  // Neon adresleri "sslmode=require" ile gelir; pg bunu zaten "verify-full" gibi uygular.
  // Açıkça yazınca gereksiz güvenlik uyarısı da kalkar.
  const adres = databaseUrl.replace(/([?&])sslmode=(require|prefer|verify-ca)\b/, '$1sslmode=verify-full');
  const havuz = new pg.Pool({
    connectionString: adres,
    enableChannelBinding: /[?&]channel_binding=require\b/.test(databaseUrl),
    max: 4,
    // Neon boşta kalan bağlantıyı birkaç dakika sonra kapatır; bizim önce bırakmamız lazım
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  // Boştaki bir bağlantı koparsa süreç çökmesin
  havuz.on('error', (e) => console.warn('[depo] boştaki bağlantı koptu:', e.message));

  // Neon uykudan uyanırken ilk sorgu bağlantı hatası verebilir: bir kez daha dene
  async function sorgu(metin, degerler = []) {
    try {
      return await havuz.query(metin, degerler);
    } catch (e) {
      const gecici = /ECONNRESET|terminat|Connection terminated|timeout|ETIMEDOUT|57P01/i.test(`${e.code} ${e.message}`);
      if (!gecici) throw e;
      await new Promise((r) => setTimeout(r, 400));
      return havuz.query(metin, degerler);
    }
  }

  // COLLATE "C": anahtarlar ("gun:2026-10-11") harf sırasına göre değil bayt sırasına göre karşılaştırılsın
  await sorgu(`CREATE TABLE IF NOT EXISTS kv (
    k TEXT COLLATE "C" PRIMARY KEY,
    v JSONB NOT NULL,
    guncel TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  return {
    tur: 'postgres',
    async oku(k) {
      const r = await sorgu('SELECT v FROM kv WHERE k = $1', [k]);
      return r.rows.length ? r.rows[0].v : null;
    },
    async yaz(k, v) {
      await sorgu(
        `INSERT INTO kv (k, v, guncel) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, guncel = now()`,
        [k, JSON.stringify(v)]
      );
    },
    async aralik(bas, son) {
      const r = await sorgu('SELECT k, v FROM kv WHERE k >= $1 AND k <= $2 ORDER BY k', [bas, son]);
      return r.rows;
    },
    async hepsi() {
      const r = await sorgu('SELECT k, v FROM kv ORDER BY k');
      return r.rows;
    },
    kapat: () => havuz.end(),
  };
}

// ── JSON dosyası ──────────────────────────────────────────────
function dosyaDepo(dosyaYolu) {
  const yol = path.resolve(dosyaYolu || 'veri/protokol.json');
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  let veri = {};
  try { veri = JSON.parse(fs.readFileSync(yol, 'utf8')); } catch { veri = {}; }
  let bekleyen = Promise.resolve();
  const kaydet = () => {
    // Yazmaları sıraya koy, yarım dosya kalmasın diye önce geçici dosyaya yaz
    bekleyen = bekleyen.then(() => {
      const gecici = `${yol}.${process.pid}.tmp`;
      fs.writeFileSync(gecici, JSON.stringify(veri));
      fs.renameSync(gecici, yol);
    });
    return bekleyen;
  };
  const kopya = (x) => (x == null ? null : JSON.parse(JSON.stringify(x)));
  const sirali = () => Object.keys(veri).sort();
  return {
    tur: 'dosya',
    async oku(k) { return kopya(veri[k]); },
    async yaz(k, v) { veri[k] = kopya(v); await kaydet(); },
    async aralik(bas, son) { return sirali().filter((k) => k >= bas && k <= son).map((k) => ({ k, v: kopya(veri[k]) })); },
    async hepsi() { return sirali().map((k) => ({ k, v: kopya(veri[k]) })); },
    kapat: async () => { await bekleyen; },
  };
}
