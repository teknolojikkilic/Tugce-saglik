// Scriptable API'sinin küçük bir taklidi: widget betiğini Node'da çalıştırır,
// hata olmadığını doğrular ve yaklaşık bir HTML görüntüsü üretir.
// Kullanım: node test/widget-mock.mjs <widget-json-dosyası> <cikti.html> [large|medium|small]
import fs from 'node:fs';

const [, , jsonDosya, ciktiDosya, aile = 'large'] = process.argv;
const veri = JSON.parse(fs.readFileSync(jsonDosya, 'utf8'));
const kayit = { acilanUrller: [] };

class Color { constructor(hex, a = 1) { this.hex = hex; this.a = a; } }
class Size { constructor(w, h) { this.width = w; this.height = h; } }
class Point { constructor(x, y) { this.x = x; this.y = y; } }
class Rect { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
class Font {
  constructor(boyut, agirlik = 400, mono = false) { Object.assign(this, { boyut, agirlik, mono }); }
  static systemFont(b) { return new Font(b, 400); }
  static mediumSystemFont(b) { return new Font(b, 500); }
  static semiboldSystemFont(b) { return new Font(b, 600); }
  static boldSystemFont(b) { return new Font(b, 700); }
  static regularMonospacedSystemFont(b) { return new Font(b, 400, true); }
}
class Path {
  constructor() { this.d = ''; }
  move(p) { this.d += `M${p.x} ${p.y}`; }
  addLine(p) { this.d += `L${p.x} ${p.y}`; }
  addRoundedRect(r, rx, ry) { this.d += `M${r.x + rx} ${r.y}H${r.x + r.width - rx}A${rx} ${ry} 0 0 1 ${r.x + r.width} ${r.y + ry}V${r.y + r.height - ry}A${rx} ${ry} 0 0 1 ${r.x + r.width - rx} ${r.y + r.height}H${r.x + rx}A${rx} ${ry} 0 0 1 ${r.x} ${r.y + r.height - ry}V${r.y + ry}A${rx} ${ry} 0 0 1 ${r.x + rx} ${r.y}Z`; }
}
class Image { constructor(svg) { this.svg = svg; } }
class DrawContext {
  constructor() { this.parca = []; this.yol = null; this.dolgu = '#000'; this.cizgi = '#000'; this.kalinlik = 1; }
  setFillColor(c) { this.dolgu = c.hex; }
  setStrokeColor(c) { this.cizgi = c.hex; }
  setLineWidth(w) { this.kalinlik = w; }
  addPath(p) { this.yol = p.d; }
  strokePath() { this.parca.push(`<path d="${this.yol}" fill="none" stroke="${this.cizgi}" stroke-width="${this.kalinlik}" stroke-linejoin="round" stroke-linecap="round"/>`); }
  fillPath() { this.parca.push(`<path d="${this.yol}" fill="${this.dolgu}"/>`); }
  fillEllipse(r) { this.parca.push(`<ellipse cx="${r.x + r.width / 2}" cy="${r.y + r.height / 2}" rx="${r.width / 2}" ry="${r.height / 2}" fill="${this.dolgu}"/>`); }
  fillRect(r) { this.parca.push(`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${this.dolgu}"/>`); }
  getImage() { return new Image(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.size.width} ${this.size.height}">${this.parca.join('')}</svg>`); }
}
const SEMBOL = { 'checkmark.circle.fill': '✔', 'play.circle.fill': '▶', circle: '○', 'drop.fill': '●', hourglass: '⧗', 'arrow.triangle.2.circlepath': '↻' };
class SFSymbol {
  static named(ad) { const s = new SFSymbol(); s.ad = ad; return s; }
  applyFont(f) { this.font = f; }
  get image() { return new Image(null, this.ad); }
}
Object.defineProperty(Image.prototype, 'sembol', { writable: true, value: null });
const eskiImage = SFSymbol.prototype;
Object.defineProperty(eskiImage, 'image', { get() { const i = new Image(null); i.sembol = this.ad; return i; } });

class Oge { constructor(tur) { this.tur = tur; } }
class WidgetStack extends Oge {
  constructor(dikey = false) { super('stack'); this.cocuk = []; this.dikey = dikey; this.hiza = 'ust'; this.spacing = 0; this.pad = null; }
  layoutVertically() { this.dikey = true; }
  layoutHorizontally() { this.dikey = false; }
  centerAlignContent() { this.hiza = 'orta'; }
  topAlignContent() { this.hiza = 'ust'; }
  bottomAlignContent() { this.hiza = 'alt'; }
  setPadding(t, l, b, r) { this.pad = [t, l, b, r]; }
  addStack() { const s = new WidgetStack(); this.cocuk.push(s); return s; }
  addText(t) { const o = new Oge('metin'); o.metin = t; o.lineLimit = 0; this.cocuk.push(o); return o; }
  addImage(img) { const o = new Oge('resim'); o.img = img; o.centerAlignImage = () => {}; this.cocuk.push(o); return o; }
  addSpacer(n) { const o = new Oge('bosluk'); o.n = n; this.cocuk.push(o); return o; }
}
class ListWidget extends WidgetStack {
  constructor() { super(true); this.kok = true; }
  async presentLarge() { kayit.widget = this; }
}
class LinearGradient {}
class Request {
  constructor(url) { this.url = url; kayit.istek = url; }
  async loadJSON() { return veri; }
}
const depo = {};
const FileManager = { local: () => ({ documentsDirectory: () => '/belgeler', joinPath: (a, b) => a + '/' + b, writeString: (p, s) => { depo[p] = s; }, readString: (p) => depo[p], fileExists: (p) => p in depo }) };
const Keychain = { contains: () => false, get: () => null, set: () => {} };
class Alert {}
const config = { runsInWidget: true, widgetFamily: aile };
const Device = { screenSize: () => new Size(393, 852) };
const Script = { setWidget: (w) => { kayit.widget = w; }, complete: () => {} };

const kod = fs.readFileSync(new URL('../scriptable/Protokol-widget.js', import.meta.url), 'utf8')
  .replace('"__SITE__"', JSON.stringify(veri.site || 'https://ornek.workers.dev'))
  .replace('"__ANAHTAR__"', '"test-anahtari"');
const calistir = new Function('Color', 'Size', 'Point', 'Rect', 'Font', 'Path', 'DrawContext', 'SFSymbol', 'ListWidget', 'LinearGradient', 'Request', 'FileManager', 'Keychain', 'Alert', 'config', 'Script', 'Device',
  `return (async () => { ${kod} })();`);
await calistir(Color, Size, Point, Rect, Font, Path, DrawContext, SFSymbol, ListWidget, LinearGradient, Request, FileManager, Keychain, Alert, config, Script, Device);

// ── HTML'e çevir ──
const urller = [];
function ciz(o, ebeveynDikey) {
  if (o.tur === 'bosluk') return o.n == null ? `<div style="flex:1 1 0"></div>` : `<div style="flex:0 0 ${o.n}px"></div>`;
  if (o.tur === 'metin') {
    const f = o.font || Font.systemFont(16);
    const renk = o.textColor ? o.textColor.hex : '#000';
    const satir = o.lineLimit === 1 ? 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' : o.lineLimit > 1 ? `display:-webkit-box;-webkit-line-clamp:${o.lineLimit};-webkit-box-orient:vertical;overflow:hidden;` : '';
    return `<div style="font-size:${f.boyut}px;font-weight:${f.agirlik};color:${renk};${f.mono ? 'font-variant-numeric:tabular-nums;' : ''}${satir}min-width:0;flex-shrink:1">${String(o.metin).replace(/</g, '&lt;')}</div>`;
  }
  if (o.tur === 'resim') {
    const w = o.imageSize ? o.imageSize.width : 20, h = o.imageSize ? o.imageSize.height : 20;
    if (o.img.sembol) return `<div style="width:${w}px;height:${h}px;flex:none;display:grid;place-items:center;font-size:${h - 2}px;line-height:1;color:${o.tintColor ? o.tintColor.hex : '#000'}">${SEMBOL[o.img.sembol] || '?'}</div>`;
    return `<img style="width:${w}px;height:${h}px;flex:none;${ebeveynDikey ? 'align-self:center' : ''}" src="data:image/svg+xml;base64,${Buffer.from(o.img.svg).toString('base64')}">`;
  }
  if (o.url) urller.push(o.url);
  const pad = o.pad ? `padding:${o.pad[0]}px ${o.pad[3]}px ${o.pad[2]}px ${o.pad[1]}px;` : '';
  const hiza = o.dikey ? 'align-items:flex-start' : `align-items:${o.hiza === 'orta' ? 'center' : o.hiza === 'alt' ? 'flex-end' : 'flex-start'}`;
  const arka = o.backgroundColor ? `background:${o.backgroundColor.hex};` : '';
  const kose = o.cornerRadius ? `border-radius:${o.cornerRadius}px;` : '';
  const cocuk = o.cocuk.map((c) => ciz(c, o.dikey)).join('');
  let genislik = ebeveynDikey ? 'align-self:stretch;' : 'flex:0 1 auto;';
  if (o.size) genislik = `${o.size.width ? `width:${o.size.width}px;flex:none;align-self:auto;` : ''}${o.size.height ? `height:${o.size.height}px;` : ''}box-sizing:border-box;`;
  return `<div style="display:flex;flex-direction:${o.dikey ? 'column' : 'row'};${hiza};gap:${o.spacing || 0}px;${pad}${arka}${kose}${genislik}min-width:0;min-height:0">${cocuk}</div>`;
}
const w = kayit.widget;
const olcu = { large: [338, 354], medium: [338, 158], small: [158, 158] }[aile];
const arka = w.backgroundGradient && w.backgroundGradient.colors ? `linear-gradient(${w.backgroundGradient.colors.map((c) => c.hex).join(',')})` : (w.backgroundColor ? w.backgroundColor.hex : '#fff');
const ic = ciz(Object.assign(w, { pad: w.pad || [16, 16, 16, 16] }), true);
if (w.url) urller.unshift(w.url);
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:24px;background:#888;font-family:-apple-system,system-ui,sans-serif">
<div style="width:${olcu[0]}px;height:${olcu[1]}px;border-radius:22px;overflow:hidden;background:${arka};display:flex;flex-direction:column">${ic.replace('align-self:stretch;', 'flex:1;')}</div></body>`;
fs.writeFileSync(ciktiDosya, html);
console.log('istek:', kayit.istek.replace(/k=[^&]+/, 'k=***'));
console.log('dokunma adresleri:', [...new Set(urller)].map((u) => u.replace(/k=[^&]+/, 'k=***')).join('\n  '));
