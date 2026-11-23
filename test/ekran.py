# Önizlemeyi telefon boyutunda açıp ekran görüntüsü alır, konsol hatalarını yazar.
import sys, asyncio, pathlib
from playwright.async_api import async_playwright
kok = pathlib.Path(__file__).resolve().parent.parent
cikti = pathlib.Path(sys.argv[1])
senaryolar = sys.argv[2:] or ['bugun-gunduz:saat=10:40&tema=gunes']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for sen in senaryolar:
            ad, sorgu = sen.split(':', 1)
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='tr-TR', timezone_id='Europe/Istanbul')
            sayfa = await ctx.new_page()
            hatalar = []
            sayfa.on('console', lambda m: m.type in ('error', 'warning') and hatalar.append(m.text))
            sayfa.on('pageerror', lambda e: hatalar.append('PAGEERROR ' + str(e)))
            await sayfa.route('**/fonts.googleapis.com/**', lambda r: r.abort())
            await sayfa.route('**/fonts.gstatic.com/**', lambda r: r.abort())
            parcalar = sorgu.split('|')
            await sayfa.goto((kok / 'onizleme/onizleme.html').as_uri() + '?' + parcalar[0])
            await sayfa.wait_for_timeout(600)
            for adim in parcalar[1:]:
                if adim.startswith('tik='):
                    await sayfa.click(adim[4:])
                elif adim.startswith('bekle='):
                    await sayfa.wait_for_timeout(int(adim[6:]))
                elif adim.startswith('kaydir='):
                    await sayfa.evaluate(f'window.scrollTo(0,{adim[7:]})')
                await sayfa.wait_for_timeout(450)
            tam = '&tam' in parcalar[0]
            await sayfa.screenshot(path=str(cikti / f'{ad}.png'), full_page=tam)
            print(ad, 'HATALAR:' if hatalar else 'temiz', *hatalar[:8], sep='\n  ' if hatalar else ' ')
            await ctx.close()
        await b.close()
asyncio.run(main())
