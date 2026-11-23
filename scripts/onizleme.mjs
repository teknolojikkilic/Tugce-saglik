// Sunucusuz önizleme sayfası üretir (örnek verilerle çalışır): onizleme/onizleme.html
// Saat denemek için ?saat=21:40, tema için ?tema=koyu, hoş geldin için ?hosgeldin=1
import fs from 'node:fs';
import { uygulamaHtml } from '../src/uygulama.js';

fs.mkdirSync('onizleme', { recursive: true });
fs.writeFileSync('onizleme/onizleme.html', uygulamaHtml({ onizleme: true }));
console.log('onizleme/onizleme.html hazır');
