// shared.js hem tarayıcıya gömülür hem sunucuda kullanılır.
// Tarayıcıda düz <script> olarak çalıştığı için burada metin olarak okunup değerlendirilir.
import fs from 'node:fs';

export const TP_KOD = fs.readFileSync(new URL('./shared.js', import.meta.url), 'utf8');
export const TP = new Function(`${TP_KOD}\nreturn TP;`)();
