// ───────────────────────────────────────────────────────────────
// Tuğçe Protokolü — ortak mantık
// Hem sunucu (Node, Render) hem uygulama (tarayıcı) bu kodu kullanır.
// ───────────────────────────────────────────────────────────────
const TP = (() => {
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  const VARSAYILAN_AYARLAR = {
    ad: 'Tuğçe',
    soyad: 'Tartıcı',
    sehir: 'İstanbul',
    lat: 41.0082,
    lon: 28.9784,
    tz: 'Europe/Istanbul',
    uyanma: '06:30',
    uyku: '22:30',
    kafeinBekle: 90, // uyandıktan kaç dk sonra kafein
    kafeinSon: '14:00', // kafeinin son saati
    suHedef: 2500, // ml
    bardak: 250, // ml
    hosgeldinGoruldu: false,
    notOkundu: false,
    konumAyarlandi: false,
  };

  const ORNEK_GOREVLER = [
    { ad: 'Sabah güneşi', emoji: '☀️', saat: '07:10', sure: 10, tekrar: 'her' },
    { ad: 'Soğuk duş', emoji: '🧊', saat: '07:25', sure: 3, tekrar: 'her' },
    { ad: 'Nefes çalışması', emoji: '🌬️', saat: '07:35', sure: 5, tekrar: 'her' },
    { ad: 'Zone 2 yürüyüş', emoji: '🚶‍♀️', saat: '17:30', sure: 40, tekrar: 'gunler', gunler: [1, 3, 5] },
    { ad: 'Mobilite', emoji: '🧘‍♀️', saat: '21:00', sure: 15, tekrar: 'her' },
    { ad: 'Günün notu', emoji: '📓', saat: '21:40', sure: 5, tekrar: 'her' },
  ];

  const HAZIR_GOREVLER = [
    { ad: 'Sabah güneşi', emoji: '☀️', sure: 10, saat: '07:00' },
    { ad: 'Soğuk duş', emoji: '🧊', sure: 3, saat: '07:20' },
    { ad: 'Kutu nefesi', emoji: '🌬️', sure: 5, saat: '07:30' },
    { ad: 'Meditasyon', emoji: '🪷', sure: 10, saat: '07:40' },
    { ad: 'Takviyeler', emoji: '💊', sure: 1, saat: '08:30' },
    { ad: 'Zone 2 kardiyo', emoji: '🚴‍♀️', sure: 40, saat: '17:00' },
    { ad: 'Kuvvet antrenmanı', emoji: '🏋️‍♀️', sure: 45, saat: '18:00' },
    { ad: 'Topraklanma', emoji: '🌱', sure: 10, saat: '12:30' },
    { ad: 'Sauna', emoji: '🔥', sure: 20, saat: '19:00' },
    { ad: 'Gün batımı yürüyüşü', emoji: '🌇', sure: 15, saat: '' },
    { ad: 'Ekransız saat', emoji: '📵', sure: 60, saat: '21:00' },
    { ad: 'Okuma', emoji: '📖', sure: 20, saat: '21:30' },
  ];

  const OGUN_TURLERI = [
    { id: 'kahvalti', ad: 'Kahvaltı', emoji: '🍳' },
    { id: 'ogle', ad: 'Öğle', emoji: '🥗' },
    { id: 'aksam', ad: 'Akşam', emoji: '🍲' },
    { id: 'ara', ad: 'Ara öğün', emoji: '🍎' },
    { id: 'icecek', ad: 'İçecek', emoji: '🥤' },
  ];

  // ── yardımcılar ──────────────────────────────────────────────
  const pad = (n) => String(n).padStart(2, '0');
  const mod = (a, n) => ((a % n) + n) % n;
  const hm = (dk) => {
    if (dk == null || isNaN(dk)) return '--:--';
    const m = mod(Math.round(dk), 1440);
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  };
  const dk = (s) => {
    if (!s || typeof s !== 'string' || !/^\d{1,2}:\d{2}$/.test(s)) return null;
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const sureMetni = (dakika) => {
    if (dakika == null) return '';
    const d = Math.max(0, Math.round(dakika));
    const s = Math.floor(d / 60);
    const k = d % 60;
    if (!s) return `${k} dk`;
    if (!k) return `${s} sa`;
    return `${s} sa ${k} dk`;
  };
  const yeniId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  // Saate doğru Türkçe eki ekler: saatEk('14:00','e') → "14:00'e", saatEk('18:37','de') → "18:37'de"
  const EK_TABLO = {
    sıfır: ['da', 'dan', 'a'], bir: ['de', 'den', 'e'], iki: ['de', 'den', 'ye'], üç: ['te', 'ten', 'e'],
    dört: ['te', 'ten', 'e'], beş: ['te', 'ten', 'e'], altı: ['da', 'dan', 'ya'], yedi: ['de', 'den', 'ye'],
    sekiz: ['de', 'den', 'e'], dokuz: ['da', 'dan', 'a'], on: ['da', 'dan', 'a'], yirmi: ['de', 'den', 'ye'],
    otuz: ['da', 'dan', 'a'], kırk: ['ta', 'tan', 'a'], elli: ['de', 'den', 'ye'],
  };
  const BIRLER = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
  const ONLAR = { 1: 'on', 2: 'yirmi', 3: 'otuz', 4: 'kırk', 5: 'elli' };
  const sonKelime = (x) => (x % 10 ? BIRLER[x % 10] : x === 0 ? 'sıfır' : ONLAR[Math.floor(x / 10)]);
  function saatEk(saat, tur) {
    const s = typeof saat === 'number' ? hm(saat) : saat;
    const [h, m] = s.split(':').map(Number);
    const kelime = sonKelime(m ? m : h % 24);
    const i = { de: 0, den: 1, e: 2 }[tur];
    return `${s}'${EK_TABLO[kelime][i]}`;
  }

  // Bir anın verilen saat dilimindeki parçaları
  function anParcalari(tarih, tz) {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const p = {};
    for (const x of f.formatToParts(tarih)) p[x.type] = x.value;
    const ymd = `${p.year}-${p.month}-${p.day}`;
    const saat = Number(p.hour) % 24;
    return { ymd, dakika: saat * 60 + Number(p.minute), hm: pad(saat) + ':' + p.minute };
  }

  const ymdParcala = (ymd) => ymd.split('-').map(Number);
  function ymdEkle(ymd, n) {
    const [y, m, d] = ymdParcala(ymd);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }
  function haftaGunu(ymd) {
    const [y, m, d] = ymdParcala(ymd);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  function tarihMetni(ymd, kisa = false) {
    const [, m, d] = ymdParcala(ymd);
    const g = GUNLER[haftaGunu(ymd)];
    return kisa ? `${d} ${AYLAR[m - 1]}` : `${g}, ${d} ${AYLAR[m - 1]}`;
  }

  // ── güneş (NOAA/SunCalc formülleri) ─────────────────────────
  const RAD = Math.PI / 180;
  const GUN_MS = 864e5;
  const J1970 = 2440588;
  const J2000 = 2451545;
  const EGIM = RAD * 23.4397;
  const J0 = 0.0009;
  const juliana = (t) => t / GUN_MS - 0.5 + J1970;
  const juliandan = (j) => (j + 0.5 - J1970) * GUN_MS;
  const ortalamaAnomali = (d) => RAD * (357.5291 + 0.98560028 * d);
  const ekliptikBoylam = (M) =>
    M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
  const sapma = (L) => Math.asin(Math.sin(EGIM) * Math.sin(L));
  const gecisJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

  // ymd günü için doğuş, öğle ve batış (yerel saat diliminde dakika)
  function gunes(ymd, lat, lon, tz) {
    const [y, m, d] = ymdParcala(ymd);
    const t = Date.UTC(y, m - 1, d, 12);
    const lw = RAD * -lon;
    const phi = RAD * lat;
    const gun = juliana(t) - J2000;
    const n = Math.round(gun - J0 - lw / (2 * Math.PI));
    const ds = J0 + lw / (2 * Math.PI) + n;
    const M = ortalamaAnomali(ds);
    const L = ekliptikBoylam(M);
    const dec = sapma(L);
    const jOgle = gecisJ(ds, M, L);
    const ogleMs = juliandan(jOgle);
    const h0 = RAD * -0.833;
    const cosW = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    const yerel = (ms) => anParcalari(new Date(ms), tz).dakika;
    if (cosW < -1 || cosW > 1) {
      return { dogus: null, batis: null, ogle: yerel(ogleMs), kutup: cosW < -1 ? 'gunduz' : 'gece' };
    }
    const w = Math.acos(cosW);
    const jBatis = gecisJ(J0 + (w + lw) / (2 * Math.PI) + n, M, L);
    const jDogus = jOgle - (jBatis - jOgle);
    return { dogus: yerel(juliandan(jDogus)), ogle: yerel(ogleMs), batis: yerel(juliandan(jBatis)), kutup: null };
  }

  // ── sirkadiyen evre ─────────────────────────────────────────
  function uykuda(n, W, S) {
    return S > W ? n >= S || n < W : n >= S && n < W;
  }

  function kafein(n, ayarlar) {
    const W = dk(ayarlar.uyanma) ?? 390;
    const bas = W + (Number(ayarlar.kafeinBekle) || 0);
    const son = dk(ayarlar.kafeinSon) ?? 840;
    const rel = (x) => mod(x - W, 1440);
    const r = rel(n);
    if (uykuda(n, W, dk(ayarlar.uyku) ?? 1350) || r < rel(bas)) return { durum: 'bekle', metin: `Kafein ${saatEk(bas, 'den')} sonra`, bas, son };
    if (r < rel(son)) return { durum: 'acik', metin: `Kafein ${saatEk(son, 'e')} kadar`, bas, son };
    return { durum: 'kapali', metin: 'Kafein bugünlük kapandı', bas, son };
  }

  function evre(n, ayarlar, g) {
    const W = dk(ayarlar.uyanma) ?? 390;
    const S = dk(ayarlar.uyku) ?? 1350;
    const R = g && g.dogus != null ? g.dogus : null;
    const T = g && g.batis != null ? g.batis : null;
    const N = g ? g.ogle : 750;
    const uykuyaKalan = mod(S - n, 1440);

    if (uykuda(n, W, S)) {
      return { anahtar: 'uyku', emoji: '🌙', baslik: 'Uyku penceresi', ipucu: `Karanlık, serin, sessiz. Uyanış ${hm(W)}.` };
    }
    if (uykuyaKalan <= 60) {
      return { anahtar: 'hazirlik', emoji: '😴', baslik: 'Uykuya hazırlık', ipucu: `Uykuya ${sureMetni(uykuyaKalan)} var. Ekranı bırak, ışıkları kıs.` };
    }
    if (R != null && n < R) {
      return { anahtar: 'safak', emoji: '🌅', baslik: 'Gün doğmadan', ipucu: `Güneş ${saatEk(R, 'de')} doğuyor. Doğunca 10 dk dışarı çık.` };
    }
    if (n < Math.max(W, R ?? W) + 60) {
      return { anahtar: 'sabah', emoji: '☀️', baslik: 'Sabah ışığı', ipucu: 'Güneş alçakta: 10–20 dk dışarıda, güneş gözlüğü olmadan.' };
    }
    if (n < N - 30) {
      return { anahtar: 'odak', emoji: '🧠', baslik: 'Sabah odağı', ipucu: 'Zihin en keskin saatlerinde. Zor işi şimdi yap.' };
    }
    if (n < N + 90) {
      return { anahtar: 'ogle', emoji: '🔆', baslik: 'Güneş tepede', ipucu: `Güneş ${saatEk(N, 'de')} en yüksekte. Öğleyi ışıkta geçir.` };
    }
    if (T != null && n < T - 60) {
      return { anahtar: 'oglesonra', emoji: '🚶‍♀️', baslik: 'Öğleden sonra', ipucu: 'Hareket zamanı. Kısa bir yürüyüş enerjiyi toplar.' };
    }
    if (T != null && n < T + 20) {
      return { anahtar: 'gunbatimi', emoji: '🌇', baslik: 'Gün batımı', ipucu: `Güneş ${saatEk(T, 'de')} batıyor. Batı ışığına birkaç dakika bak.` };
    }
    return { anahtar: 'aksam', emoji: '🕯️', baslik: 'Akşam', ipucu: 'Sıcak, loş ışığa geç. Mavi ışığı azalt.' };
  }

  // ── görevler ─────────────────────────────────────────────────
  function bugunMu(g, ymd) {
    if (!g || g.pasif) return false;
    if (g.tekrar === 'tek') return g.tarih === ymd;
    if (g.tekrar === 'gunler') return Array.isArray(g.gunler) && g.gunler.includes(haftaGunu(ymd));
    return true;
  }
  function gununGorevleri(gorevler, ymd) {
    return (gorevler || [])
      .filter((g) => bugunMu(g, ymd))
      .sort((a, b) => (dk(a.saat) ?? 9999) - (dk(b.saat) ?? 9999) || String(a.ad).localeCompare(String(b.ad), 'tr'));
  }
  function tekrarMetni(g) {
    if (g.tekrar === 'tek') return g.tarih ? tarihMetni(g.tarih, true) : 'Tek sefer';
    if (g.tekrar === 'gunler') {
      const s = [...(g.gunler || [])].sort((a, b) => mod(a - 1, 7) - mod(b - 1, 7));
      if (s.length === 7) return 'Her gün';
      if (s.join() === '1,2,3,4,5') return 'Hafta içi';
      if (s.join() === '6,0') return 'Hafta sonu';
      return s.map((x) => GUN_KISA[x]).join(' ');
    }
    return 'Her gün';
  }
  function gorevDurumu(g, n, yapildi) {
    if (yapildi) return 'yapildi';
    const b = dk(g.saat);
    if (b == null) return 'serbest';
    const bitis = b + (Number(g.sure) || 0);
    if (n >= b && n < Math.max(bitis, b + 1)) return 'simdi';
    if (n < b) return 'sonra';
    return 'gecti';
  }
  function siradaki(gorevler, gun, n) {
    const yap = (gun && gun.yapilan) || {};
    const acik = gorevler.filter((g) => !yap[g.id]);
    return (
      acik.find((g) => gorevDurumu(g, n, false) === 'simdi') ||
      acik.find((g) => gorevDurumu(g, n, false) === 'sonra') ||
      acik.find((g) => gorevDurumu(g, n, false) === 'serbest') ||
      null
    );
  }

  // ── gün kaydı ───────────────────────────────────────────────
  const bosGun = () => ({ yapilan: {}, su: [], ogunler: [], enerji: null, saglik: null, planli: 0 });
  function gunNormalle(g) {
    const b = bosGun();
    if (!g || typeof g !== 'object') return b;
    return {
      yapilan: g.yapilan && typeof g.yapilan === 'object' ? g.yapilan : {},
      su: Array.isArray(g.su) ? g.su : [],
      ogunler: Array.isArray(g.ogunler) ? g.ogunler : [],
      enerji: g.enerji ?? null,
      saglik: g.saglik ?? null,
      planli: g.planli ?? 0,
    };
  }
  // "1.250", "1,5", "2 L", 8432 gibi değerleri sayıya çevirir (Kestirmeler Türkçe biçimle gönderebilir)
  function sayiCoz(x) {
    if (typeof x === 'number') return isFinite(x) ? x : null;
    if (x == null) return null;
    let s = String(x).trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
    if (!s) return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    const v = Number(s);
    return isFinite(v) ? v : null;
  }
  const sayi = (x, min, max) => {
    const v = sayiCoz(x);
    if (v == null) return null;
    return Math.min(max, Math.max(min, v));
  };

  const SAAT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

  function gorevTemizle(g) {
    g = g && typeof g === 'object' ? g : {};
    const gunler = Array.isArray(g.gunler) ? [...new Set(g.gunler.map(Number).filter((x) => x >= 0 && x <= 6))] : [];
    let tekrar = ['her', 'gunler', 'tek'].includes(g.tekrar) ? g.tekrar : 'her';
    if (tekrar === 'gunler' && !gunler.length) tekrar = 'her';
    const tarih = YMD_RE.test(g.tarih || '') ? g.tarih : null;
    if (tekrar === 'tek' && !tarih) tekrar = 'her';
    return {
      id: String(g.id || yeniId()).replace(/[^\w-]/g, '').slice(0, 24) || yeniId(),
      ad: String(g.ad || '').trim().slice(0, 60) || 'Görev',
      emoji: String(g.emoji || '•').trim().slice(0, 12) || '•',
      saat: SAAT_RE.test(g.saat || '') ? g.saat : '',
      sure: Math.round(Math.min(600, Math.max(0, sayiCoz(g.sure) || 0))),
      tekrar,
      gunler: tekrar === 'gunler' ? gunler : [],
      tarih: tekrar === 'tek' ? tarih : null,
      not: String(g.not || '').slice(0, 300),
      pasif: !!g.pasif,
    };
  }

  function ayarTemizle(girdi, mevcut) {
    const a = { ...VARSAYILAN_AYARLAR, ...(mevcut || {}) };
    const x = girdi || {};
    if (x.ad != null) a.ad = String(x.ad).trim().slice(0, 40) || a.ad;
    if (x.soyad != null) a.soyad = String(x.soyad).trim().slice(0, 40);
    if (x.sehir != null) a.sehir = String(x.sehir).trim().slice(0, 60);
    if (x.lat != null && sayiCoz(x.lat) != null) a.lat = sayi(x.lat, -89.9, 89.9);
    if (x.lon != null && sayiCoz(x.lon) != null) a.lon = sayi(x.lon, -180, 180);
    if (x.tz != null) {
      try { new Intl.DateTimeFormat('en', { timeZone: String(x.tz) }); a.tz = String(x.tz); } catch (e) { /* geçersiz dilim */ }
    }
    for (const k of ['uyanma', 'uyku', 'kafeinSon']) if (SAAT_RE.test(x[k] || '')) a[k] = x[k];
    if (x.kafeinBekle != null && sayiCoz(x.kafeinBekle) != null) a.kafeinBekle = Math.round(sayi(x.kafeinBekle, 0, 300));
    if (x.suHedef != null && sayiCoz(x.suHedef) != null) a.suHedef = Math.round(sayi(x.suHedef, 250, 8000));
    if (x.bardak != null && sayiCoz(x.bardak) != null) a.bardak = Math.round(sayi(x.bardak, 50, 1500));
    for (const k of ['hosgeldinGoruldu', 'konumAyarlandi', 'notOkundu']) if (x[k] != null) a[k] = !!x[k];
    return a;
  }

  // Gün kaydına tek bir işlemi uygular. Hem sunucu hem önizleme bunu kullanır.
  function gunIslem(gunVeri, govde, simdiHM) {
    const g = gunNormalle(JSON.parse(JSON.stringify(gunVeri || {})));
    const t = /^\d{2}:\d{2}$/.test(govde.t || '') ? govde.t : simdiHM;
    switch (govde.islem) {
      case 'gorev': {
        if (!govde.id) throw new Error('Görev kimliği eksik');
        const hedef = typeof govde.durum === 'boolean' ? govde.durum : !g.yapilan[govde.id];
        if (hedef) g.yapilan[govde.id] = t;
        else delete g.yapilan[govde.id];
        break;
      }
      case 'su': {
        const ml = sayi(govde.ml, 1, 3000);
        if (!ml) throw new Error('Su miktarı geçersiz');
        g.su.push({ id: yeniId(), t, ml });
        break;
      }
      case 'su-sil': {
        g.su = g.su.filter((s) => s.id !== govde.id);
        break;
      }
      case 'ogun': {
        const o = govde.ogun || {};
        const ad = String(o.ad || '').trim().slice(0, 80);
        g.ogunler.push({
          id: yeniId(),
          t: /^\d{2}:\d{2}$/.test(o.t || '') ? o.t : t,
          tur: OGUN_TURLERI.some((x) => x.id === o.tur) ? o.tur : 'ara',
          ad,
          kcal: o.kcal === '' || o.kcal == null ? null : sayi(o.kcal, 0, 5000),
          protein: o.protein === '' || o.protein == null ? null : sayi(o.protein, 0, 400),
        });
        g.ogunler.sort((a, b) => (dk(a.t) ?? 0) - (dk(b.t) ?? 0));
        break;
      }
      case 'ogun-sil': {
        g.ogunler = g.ogunler.filter((o) => o.id !== govde.id);
        break;
      }
      case 'enerji': {
        g.enerji = govde.deger == null ? null : sayi(govde.deger, 1, 5);
        break;
      }
      case 'saglik': {
        const v = govde.veri || {};
        const al = (k, min, max) => (v[k] === '' || v[k] == null ? null : sayi(v[k], min, max));
        let su = al('su', 0, 20000);
        // Kestirme litre gönderirse mililitreye çevir
        if (su != null && su > 0 && su < 20) su = Math.round(su * 1000);
        g.saglik = {
          su: su != null ? Math.round(su) : null,
          kalori: al('kalori', 0, 20000),
          protein: al('protein', 0, 1000),
          adim: al('adim', 0, 200000),
          hrv: al('hrv', 0, 400),
          nabiz: al('nabiz', 0, 250),
          saat: t,
        };
        break;
      }
      default:
        throw new Error('Bilinmeyen işlem');
    }
    return g;
  }

  function suToplam(gun) {
    const g = gunNormalle(gun);
    const site = g.su.reduce((a, s) => a + (Number(s.ml) || 0), 0);
    const saglik = g.saglik && g.saglik.su ? g.saglik.su : 0;
    return { site, saglik, toplam: site + saglik };
  }

  // Son öğünden beri geçen süre (dün akşamki öğünü de hesaba katar)
  function aclik(bugun, dun, n) {
    const b = gunNormalle(bugun).ogunler.filter((o) => dk(o.t) != null && dk(o.t) <= n);
    if (b.length) {
      const son = Math.max(...b.map((o) => dk(o.t)));
      return { son: hm(son), dakika: n - son, dun: false };
    }
    const d = gunNormalle(dun).ogunler.filter((o) => dk(o.t) != null);
    if (d.length) {
      const son = Math.max(...d.map((o) => dk(o.t)));
      return { son: hm(son), dakika: n + 1440 - son, dun: true };
    }
    return null;
  }

  function yemePenceresi(gun) {
    const o = gunNormalle(gun).ogunler.map((x) => dk(x.t)).filter((x) => x != null);
    if (!o.length) return null;
    const ilk = Math.min(...o);
    const son = Math.max(...o);
    return { ilk: hm(ilk), son: hm(son), dakika: son - ilk };
  }

  function beslenmeToplam(gun) {
    const g = gunNormalle(gun);
    let kcal = 0, protein = 0, kcalVar = false, proteinVar = false;
    for (const o of g.ogunler) {
      if (o.kcal != null) { kcal += Number(o.kcal) || 0; kcalVar = true; }
      if (o.protein != null) { protein += Number(o.protein) || 0; proteinVar = true; }
    }
    return { kcal: kcalVar ? Math.round(kcal) : null, protein: proteinVar ? Math.round(protein) : null };
  }

  // Widget ve özet ekranları için günün tamamı
  function gunOzeti({ ayarlar, gorevler, bugun, dun, an }) {
    const a = { ...VARSAYILAN_AYARLAR, ...(ayarlar || {}) };
    const p = anParcalari(an || new Date(), a.tz);
    const n = p.dakika;
    const g = gunes(p.ymd, a.lat, a.lon, a.tz);
    const liste = gununGorevleri(gorevler, p.ymd);
    const gunV = gunNormalle(bugun);
    const sira = siradaki(liste, gunV, n);
    const su = suToplam(gunV);
    const ac = aclik(gunV, dun, n);
    let gunesOran = null;
    if (g.dogus != null && g.batis != null && n >= g.dogus && n <= g.batis) {
      gunesOran = (n - g.dogus) / Math.max(1, g.batis - g.dogus);
    }
    return {
      ad: a.ad,
      tarih: p.ymd,
      tarihMetin: tarihMetni(p.ymd),
      saat: p.hm,
      simdiDk: n,
      evre: evre(n, a, g),
      kafein: kafein(n, a),
      gunes: { dogus: hm(g.dogus), batis: hm(g.batis), ogle: hm(g.ogle), dogusDk: g.dogus, batisDk: g.batis, oran: gunesOran, kutup: g.kutup },
      uyanma: a.uyanma,
      uyku: a.uyku,
      gorevler: liste.map((x) => ({
        id: x.id, ad: x.ad, emoji: x.emoji || '•', saat: x.saat || '', sure: Number(x.sure) || 0,
        yapildi: !!gunV.yapilan[x.id], durum: gorevDurumu(x, n, !!gunV.yapilan[x.id]),
      })),
      yapilan: liste.filter((x) => gunV.yapilan[x.id]).length,
      planli: liste.length,
      siradaki: sira ? { id: sira.id, ad: sira.ad, emoji: sira.emoji || '•', saat: sira.saat || '', sure: Number(sira.sure) || 0 } : null,
      su: { ...su, hedef: Number(a.suHedef) || 2500, bardak: Number(a.bardak) || 250 },
      aclik: ac,
      ogunSayisi: gunV.ogunler.length,
      beslenme: beslenmeToplam(gunV),
      saglik: gunV.saglik,
      enerji: gunV.enerji,
    };
  }

  return {
    AYLAR, GUNLER, GUN_KISA, VARSAYILAN_AYARLAR, ORNEK_GOREVLER, HAZIR_GOREVLER, OGUN_TURLERI,
    pad, mod, hm, dk, sureMetni, yeniId, saatEk, anParcalari, ymdEkle, haftaGunu, tarihMetni,
    gunes, uykuda, kafein, evre, bugunMu, gununGorevleri, tekrarMetni, gorevDurumu, siradaki,
    sayiCoz, gorevTemizle, ayarTemizle, SAAT_RE, YMD_RE,
    bosGun, gunNormalle, gunIslem, suToplam, aclik, yemePenceresi, beslenmeToplam, gunOzeti,
  };
})();
