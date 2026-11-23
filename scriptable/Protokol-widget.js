// ───────────────────────────────────────────────────────────────
// Tuğçe Protokolü — iPhone widget'ı (Scriptable)
// En iyi büyük boyda (4x4) görünür; orta ve küçük boylar da çalışır.
// Sitedeki Ayarlar > "Widget kodunu kopyala" bu kodu adres ve anahtarla hazır verir.
// ───────────────────────────────────────────────────────────────
const SITE = "__SITE__";
const ANAHTAR = "__ANAHTAR__";
const KESTIRME = "Protokol Senkron";

const GECE_EVRELERI = ["uyku", "hazirlik", "aksam", "safak"];
const PALET = {
  gunduz: {
    zemin1: "#F8FBF9", zemin2: "#E7EEE9", yazi: "#13221C", ikinci: "#2E3F38", soluk: "#5E6E67",
    cizgi: "#D3DCD7", halka: "#DCE2EC", gunes: "#E39A00", gunes2: "#E0702F",
    yapildi: "#2E7A58", su: "#2A78B0", kutu: "#FFFFFF",
  },
  gece: {
    zemin1: "#1D140E", zemin2: "#110A06", yazi: "#F4D3B4", ikinci: "#E3BC98", soluk: "#AE8869",
    cizgi: "#3B2819", halka: "#2B1B11", gunes: "#FF9B3D", gunes2: "#C24E2A",
    yapildi: "#D9A441", su: "#E59A62", kutu: "#26180F",
  },
};

// ── ayarlar: kopyalanan kod hazır gelir; değilse bir kez sorulur ──
async function baglanti() {
  let site = SITE, anahtar = ANAHTAR;
  if (!site.startsWith("__") && !anahtar.startsWith("__")) return { site: site.replace(/\/$/, ""), anahtar };
  if (Keychain.contains("tp_site") && Keychain.contains("tp_anahtar")) {
    return { site: Keychain.get("tp_site"), anahtar: Keychain.get("tp_anahtar") };
  }
  if (config.runsInWidget) return null;
  const a = new Alert();
  a.title = "Tuğçe Protokolü";
  a.message = "Sitenin adresini ve anahtarını gir.";
  a.addTextField("https://....onrender.com", "");
  a.addSecureTextField("Anahtar", "");
  a.addAction("Kaydet");
  a.addCancelAction("Vazgeç");
  if ((await a.present()) === -1) return null;
  site = a.textFieldValue(0).trim().replace(/\/$/, "");
  anahtar = a.textFieldValue(1).trim();
  Keychain.set("tp_site", site);
  Keychain.set("tp_anahtar", anahtar);
  return { site, anahtar };
}

// ── veri: önce sunucu, olmazsa son kayıtlı veri ──
async function veriAl(b) {
  const fm = FileManager.local();
  const dosya = fm.joinPath(fm.documentsDirectory(), "protokol-onbellek.json");
  try {
    const r = new Request(`${b.site}/api/widget?k=${encodeURIComponent(b.anahtar)}`);
    r.timeoutInterval = 15;
    const veri = await r.loadJSON();
    if (veri.hata) throw new Error(veri.hata);
    fm.writeString(dosya, JSON.stringify(veri));
    return { veri, eski: false };
  } catch (e) {
    if (fm.fileExists(dosya)) return { veri: JSON.parse(fm.readString(dosya)), eski: true, hata: String(e.message || e) };
    throw e;
  }
}

const renk = (p, k) => new Color(p[k]);
function metin(stack, yazi, boyut, p, renkAdi = "yazi", agirlik = "normal") {
  const t = stack.addText(String(yazi));
  t.font = agirlik === "kalin" ? Font.semiboldSystemFont(boyut) : agirlik === "orta" ? Font.mediumSystemFont(boyut) : Font.systemFont(boyut);
  t.textColor = renk(p, renkAdi);
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.75;
  return t;
}
function sembol(stack, ad, boyut, p, renkAdi) {
  const s = SFSymbol.named(ad);
  if (!s) return null;
  s.applyFont(Font.mediumSystemFont(boyut));
  const g = stack.addImage(s.image);
  g.imageSize = new Size(boyut + 2, boyut + 2);
  g.tintColor = renk(p, renkAdi);
  return g;
}
function link(b, ek) {
  return `${b.site}/?k=${encodeURIComponent(b.anahtar)}${ek ? "&" + ek : ""}`;
}
const sureMetni = (dk) => {
  const d = Math.max(0, Math.round(dk || 0));
  const s = Math.floor(d / 60), k = d % 60;
  if (!s) return `${k} dk`;
  if (!k) return `${s} sa`;
  return `${s} sa ${k} dk`;
};
const litre = (ml) => (Math.round(ml / 100) / 10).toString().replace(".", ",");
function selam(n) {
  if (n < 300) return "İyi geceler";
  if (n < 660) return "Günaydın";
  if (n < 1020) return "İyi günler";
  if (n < 1320) return "İyi akşamlar";
  return "İyi geceler";
}

// ── çizimler ──
function gunesYayi(v, p, gen, yuk) {
  const dc = new DrawContext();
  dc.size = new Size(gen, yuk);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const ufuk = yuk - 6, cx = gen / 2, a = gen / 2 - 10, bb = yuk - 14;
  const noktaAl = (t) => new Point(cx - a * Math.cos(t), ufuk - bb * Math.sin(t));
  // ufuk çizgisi
  const u = new Path();
  u.move(new Point(0, ufuk));
  u.addLine(new Point(gen, ufuk));
  dc.addPath(u);
  dc.setStrokeColor(renk(p, "cizgi"));
  dc.setLineWidth(1.5);
  dc.strokePath();
  // tüm yay
  const tum = new Path();
  const adim = 48;
  tum.move(noktaAl(0));
  for (let i = 1; i <= adim; i++) tum.addLine(noktaAl((Math.PI * i) / adim));
  dc.addPath(tum);
  dc.setStrokeColor(renk(p, "halka"));
  dc.setLineWidth(5);
  dc.strokePath();
  const oran = v.gunes.oran;
  if (oran != null) {
    const gecen = new Path();
    gecen.move(noktaAl(0));
    const son = Math.max(1, Math.round(adim * oran));
    for (let i = 1; i <= son; i++) gecen.addLine(noktaAl((Math.PI * oran * i) / son));
    dc.addPath(gecen);
    dc.setStrokeColor(renk(p, "gunes"));
    dc.setLineWidth(5);
    dc.strokePath();
    const g = noktaAl(Math.PI * oran);
    dc.setFillColor(renk(p, "gunes"));
    dc.fillEllipse(new Rect(g.x - 8, g.y - 8, 16, 16));
  } else {
    // gece: ufkun altında küçük bir ay işareti
    const yolda = v.gunes.dogusDk != null && v.simdiDk < v.gunes.dogusDk;
    const x = yolda ? 16 : gen - 16;
    dc.setFillColor(renk(p, "soluk"));
    dc.fillEllipse(new Rect(x - 5, ufuk - 5, 10, 10));
  }
  return dc.getImage();
}
function cubuk(p, oran, gen, yuk, renkAdi) {
  const dc = new DrawContext();
  dc.size = new Size(gen, yuk);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const zemin = new Path();
  zemin.addRoundedRect(new Rect(0, 0, gen, yuk), yuk / 2, yuk / 2);
  dc.addPath(zemin);
  dc.setFillColor(renk(p, "cizgi"));
  dc.fillPath();
  const o = Math.max(0, Math.min(1, oran || 0));
  if (o > 0) {
    const dolu = new Path();
    dolu.addRoundedRect(new Rect(0, 0, Math.max(yuk, gen * o), yuk), yuk / 2, yuk / 2);
    dc.addPath(dolu);
    dc.setFillColor(renk(p, renkAdi));
    dc.fillPath();
  }
  return dc.getImage();
}

// Gösterilecek görevler: önce şimdiki ve sıradakiler, yer kalırsa tamamlananlar
function gorevSec(liste, adet) {
  const sira = { simdi: 0, sonra: 1, serbest: 2, gecti: 3 };
  const acik = liste.filter((g) => !g.yapildi).sort((a, b) => sira[a.durum] - sira[b.durum] || (a.saat || "99").localeCompare(b.saat || "99"));
  const secilen = acik.slice(0, adet);
  if (secilen.length < adet) {
    const biten = liste.filter((g) => g.yapildi).slice(-(adet - secilen.length));
    secilen.push(...biten);
  }
  return secilen.sort((a, b) => (a.saat || "99").localeCompare(b.saat || "99"));
}

function gorevSatiri(stack, g, b, p, boyut) {
  const s = stack.addStack();
  s.centerAlignContent();
  s.spacing = 6;
  s.url = link(b, "gorev=" + encodeURIComponent(g.id));
  const ad = g.yapildi ? "checkmark.circle.fill" : g.durum === "simdi" ? "play.circle.fill" : "circle";
  sembol(s, ad, boyut, p, g.yapildi ? "yapildi" : g.durum === "simdi" ? "gunes" : "soluk");
  const saat = metin(s, g.saat || "—", boyut - 1, p, "soluk");
  saat.font = Font.regularMonospacedSystemFont ? Font.regularMonospacedSystemFont(boyut - 1) : Font.systemFont(boyut - 1);
  metin(s, `${g.emoji} ${g.ad}`, boyut, p, g.yapildi ? "soluk" : "yazi", g.durum === "simdi" ? "kalin" : "normal");
  s.addSpacer();
  if (g.sure) metin(s, sureMetni(g.sure), boyut - 2, p, "soluk");
}

// ── büyük widget ──
function buyukWidget(v, b, p, eski) {
  const w = new ListWidget();
  w.setPadding(16, 16, 12, 16);
  w.url = link(b);

  const ust = w.addStack();
  ust.centerAlignContent();
  const sol = ust.addStack();
  sol.layoutVertically();
  metin(sol, `${selam(v.simdiDk)}, ${v.ad}`, 15, p, "yazi", "kalin");
  metin(sol, v.tarihMetin, 12, p, "soluk");
  ust.addSpacer();
  const em = ust.addText(v.evre.emoji);
  em.font = Font.systemFont(26);

  w.addSpacer(6);
  const yay = w.addImage(gunesYayi(v, p, 300, 46));
  yay.imageSize = new Size(300, 46);
  yay.centerAlignImage();
  const saatler = w.addStack();
  metin(saatler, `Doğuş ${v.gunes.dogus}`, 10.5, p, "soluk");
  saatler.addSpacer();
  metin(saatler, `Batış ${v.gunes.batis}`, 10.5, p, "soluk");

  w.addSpacer(6);
  const evre = w.addStack();
  evre.centerAlignContent();
  metin(evre, v.evre.baslik, 13.5, p, "yazi", "kalin");
  evre.addSpacer(8);
  metin(evre, v.kafein.metin, 11.5, p, "soluk");
  evre.addSpacer();
  const ipucu = metin(w, v.evre.ipucu, 11.5, p, "ikinci");
  ipucu.lineLimit = 2;

  w.addSpacer(8);
  const rb = w.addStack();
  rb.centerAlignContent();
  metin(rb, "Rutin", 12, p, "soluk", "orta");
  rb.addSpacer(6);
  const bar = rb.addImage(cubuk(p, v.planli ? v.yapilan / v.planli : 0, 150, 5, "yapildi"));
  bar.imageSize = new Size(150, 5);
  rb.addSpacer();
  metin(rb, `${v.yapilan}/${v.planli}`, 12, p, "soluk", "orta");
  w.addSpacer(4);

  // büyük ekranlı iPhone'larda bir görev fazla sığar
  const adet = Device.screenSize().height >= 800 ? 5 : 4;
  const secilen = gorevSec(v.gorevler, adet);
  if (!secilen.length) metin(w, "Bugün görev yok. Dokun, ekle.", 12.5, p, "soluk");
  secilen.forEach((g, i) => {
    gorevSatiri(w, g, b, p, 13);
    if (i < secilen.length - 1) w.addSpacer(3);
  });

  w.addSpacer();
  const alt = w.addStack();
  alt.spacing = 8;
  // su
  const su = alt.addStack();
  su.layoutVertically();
  su.size = new Size(149, 50);
  su.backgroundColor = renk(p, "kutu");
  su.cornerRadius = 12;
  su.setPadding(7, 10, 7, 10);
  su.url = link(b, "su=1");
  const su1 = su.addStack();
  su1.centerAlignContent();
  sembol(su1, "drop.fill", 12, p, "su");
  su1.addSpacer(4);
  metin(su1, `${litre(v.su.toplam)} / ${litre(v.su.hedef)} L`, 13, p, "yazi", "kalin");
  su1.addSpacer();
  metin(su1, `+${v.su.bardak}`, 11, p, "su", "kalin");
  su.addSpacer(5);
  const sb = su.addImage(cubuk(p, v.su.toplam / v.su.hedef, 124, 4, "su"));
  sb.imageSize = new Size(124, 4);
  // açlık
  const ac = alt.addStack();
  ac.layoutVertically();
  ac.size = new Size(149, 50);
  ac.backgroundColor = renk(p, "kutu");
  ac.cornerRadius = 12;
  ac.setPadding(7, 10, 7, 10);
  ac.url = link(b, "ogun=1");
  const ac1 = ac.addStack();
  ac1.centerAlignContent();
  sembol(ac1, "hourglass", 12, p, "gunes");
  ac1.addSpacer(4);
  metin(ac1, v.aclik ? sureMetni(v.aclik.dakika) : "Öğün yok", 13, p, "yazi", "kalin");
  ac1.addSpacer();
  ac.addSpacer(2);
  metin(ac, v.aclik ? `son öğün ${v.aclik.dun ? "dün " : ""}${v.aclik.son}` : "dokun, öğün ekle", 10.5, p, "soluk");

  w.addSpacer(5);
  const ayak = w.addStack();
  ayak.centerAlignContent();
  metin(ayak, eski ? `Çevrimdışı, ${v.saat} verisi` : `${v.saat} itibarıyla`, 9.5, p, "soluk");
  ayak.addSpacer();
  const sk = ayak.addStack();
  sk.url = "shortcuts://run-shortcut?name=" + encodeURIComponent(KESTIRME);
  sembol(sk, "arrow.triangle.2.circlepath", 9, p, "soluk");
  sk.addSpacer(3);
  metin(sk, "Sağlık senkronu", 9.5, p, "soluk");
  return w;
}

// ── orta widget ──
function ortaWidget(v, b, p) {
  const w = new ListWidget();
  w.setPadding(14, 16, 14, 16);
  w.url = link(b);
  const sat = w.addStack();
  const sol = sat.addStack();
  sol.layoutVertically();
  metin(sol, `${v.evre.emoji} ${v.evre.baslik}`, 14, p, "yazi", "kalin");
  metin(sol, v.kafein.metin, 11, p, "soluk");
  sol.addSpacer(8);
  const sira = v.siradaki;
  metin(sol, sira ? `Sıradaki${sira.saat ? ", " + sira.saat : ""}` : "Rutin tamam", 11, p, "soluk");
  if (sira) metin(sol, `${sira.emoji} ${sira.ad}`, 15, p, "yazi", "kalin");
  sol.addSpacer();
  metin(sol, `Rutin ${v.yapilan}/${v.planli}`, 11, p, "soluk");
  sat.addSpacer();
  const sag = sat.addStack();
  sag.layoutVertically();
  sag.url = link(b, "su=1");
  metin(sag, `💧 ${litre(v.su.toplam)}/${litre(v.su.hedef)} L`, 13, p, "yazi", "kalin");
  const sb = sag.addImage(cubuk(p, v.su.toplam / v.su.hedef, 110, 4, "su"));
  sb.imageSize = new Size(110, 4);
  sag.addSpacer(10);
  metin(sag, `⏳ ${v.aclik ? sureMetni(v.aclik.dakika) : "—"}`, 13, p, "yazi", "kalin");
  metin(sag, v.aclik ? `son öğün ${v.aclik.son}` : "öğün yok", 10.5, p, "soluk");
  return w;
}

// ── küçük widget ──
function kucukWidget(v, b, p) {
  const w = new ListWidget();
  w.setPadding(14, 14, 14, 14);
  w.url = link(b);
  const e = w.addText(v.evre.emoji);
  e.font = Font.systemFont(24);
  metin(w, v.evre.baslik, 13, p, "yazi", "kalin");
  w.addSpacer();
  if (v.siradaki) {
    metin(w, v.siradaki.saat || "Sıradaki", 11, p, "soluk");
    metin(w, `${v.siradaki.emoji} ${v.siradaki.ad}`, 13, p, "yazi", "orta");
  }
  w.addSpacer(6);
  metin(w, `💧 ${litre(v.su.toplam)} L  ✓ ${v.yapilan}/${v.planli}`, 11, p, "soluk");
  return w;
}

function hataWidget(mesaj) {
  const p = PALET.gunduz;
  const w = new ListWidget();
  w.backgroundColor = renk(p, "zemin1");
  w.setPadding(16, 16, 16, 16);
  metin(w, "Tuğçe Protokolü", 14, p, "yazi", "kalin");
  w.addSpacer(6);
  const t = metin(w, mesaj, 12, p, "soluk");
  t.lineLimit = 4;
  return w;
}

// ── çalıştır ──
let widget;
const b = await baglanti();
if (!b) {
  widget = hataWidget("Scriptable'da bu betiği bir kez açıp site adresini ve anahtarı gir.");
} else {
  try {
    const { veri, eski } = await veriAl(b);
    const p = PALET[GECE_EVRELERI.includes(veri.evre.anahtar) ? "gece" : "gunduz"];
    const aile = config.widgetFamily || "large";
    widget = aile === "small" ? kucukWidget(veri, b, p) : aile === "medium" ? ortaWidget(veri, b, p) : buyukWidget(veri, b, p, eski);
    const g = new LinearGradient();
    g.colors = [renk(p, "zemin1"), renk(p, "zemin2")];
    g.locations = [0, 1];
    widget.backgroundGradient = g;
  } catch (e) {
    widget = hataWidget("Veri alınamadı: " + (e.message || e));
  }
}
widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
