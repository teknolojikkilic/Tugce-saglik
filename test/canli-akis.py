# Yerelde çalışan Worker'a karşı gerçek kullanıcı akışı: hoş geldin, su, görev, öğün, widget bağlantıları.
import sys, json, asyncio, urllib.request, pathlib
from playwright.async_api import async_playwright
B = sys.argv[1]; K = sys.argv[2]; CIKTI = pathlib.Path(sys.argv[3])
def api(yol):
    req = urllib.request.Request(B + yol, headers={'x-anahtar': K})
    op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    return json.loads(op.open(req).read())
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='tr-TR', timezone_id='Europe/Istanbul')
        await ctx.route('**/fonts.g*/**', lambda r: r.abort())
        s = await ctx.new_page()
        hatalar = []
        s.on('pageerror', lambda e: hatalar.append(str(e)))
        await s.goto(f'{B}/?k={K}'); print('1 açıldı')
        await s.wait_for_selector('.hosgeldin')
        await s.screenshot(path=str(CIKTI / 'canli-hosgeldin.png'))
        await s.click('[data-eylem="hos-gec"]'); print('2 hoşgeldin geçildi')
        await s.wait_for_selector('.kadran')
        assert s.url.rstrip('/') == B, s.url  # ?k= adresten silindi
        assert api('/api/durum')['ayarlar']['hosgeldinGoruldu'] is True
        print('  ana ekran')
        once = api('/api/durum')['gun']
        # su ekle
        await s.click('.alet [data-eylem^="su:"]')
        await s.wait_for_timeout(500)
        assert len(api('/api/durum')['gun']['su']) == len(once['su']) + 1
        # ilk görevi işaretle
        ilk = await s.get_attribute('.satir .isaret', 'data-eylem')
        await s.click('.satir .isaret')
        await s.wait_for_timeout(500)
        gid = ilk.split(':', 1)[1]
        assert gid in api('/api/durum')['gun']['yapilan'], 'görev işaretlenmedi'
        print('  su ve görev tamam')
        # yeni görev ekle (saatsiz, belirli günler)
        await s.click('[data-sekme=gorevler]')
        await s.click('[data-eylem="gorev-yeni"]')
        await s.fill('#f-ad', 'Kırmızı ışık terapisi')
        await s.fill('#f-sure', '12')
        await s.click('[data-eylem="f-saatsiz"]')
        await s.click('[data-eylem="f-tekrar:gunler"]')
        await s.click('[data-eylem="f-kaydet"]')
        await s.wait_for_timeout(600)
        g = [x for x in api('/api/durum')['gorevler'] if x['ad'] == 'Kırmızı ışık terapisi']
        assert g and g[0]['saat'] == '' and g[0]['sure'] == 12 and g[0]['gunler'] == [1, 2, 3, 4, 5], g
        print('  yeni görev tamam')
        # öğün ekle
        await s.click('[data-sekme=beslenme]')
        await s.click('[data-eylem="ogun-yeni"]')
        await s.fill('#o-ad', 'Mercimek çorbası')
        await s.fill('#o-saat', '19:15')
        await s.fill('#o-kcal', '310')
        await s.click('[data-eylem="o-kaydet"]')
        await s.wait_for_timeout(600)
        og = api('/api/durum')['gun']['ogunler']
        assert any(o['ad'] == 'Mercimek çorbası' and o['kcal'] == 310 for o in og), og
        print('  öğün tamam')
        # widget dokunuşları: ?su=1, ?gorev=ID, ?ogun=1
        su_once = len(api('/api/durum')['gun']['su'])
        s2 = await ctx.new_page()
        await s2.goto(f'{B}/?k={K}&su=1')
        await s2.wait_for_timeout(900)
        assert len(api('/api/durum')['gun']['su']) == su_once + 1, 'widget su dokunuşu çalışmadı'
        assert '?' not in s2.url
        await s2.reload(); await s2.wait_for_timeout(700)
        assert len(api('/api/durum')['gun']['su']) == su_once + 1, 'yenileyince su tekrar eklendi'
        await s2.goto(f'{B}/?k={K}&gorev={gid}')
        await s2.wait_for_selector('.sayfa.acik .ayrinti-ust')
        await s2.screenshot(path=str(CIKTI / 'canli-gorev.png'))
        await s2.goto(f'{B}/?k={K}&ogun=1')
        await s2.wait_for_selector('.sayfa.acik #o-ad')
        # yanlış anahtar
        print('3 widget dokunuşları tamam'); s3 = await (await b.new_context()).new_page()
        await s3.goto(f'{B}/?k=yanlis')
        await s3.wait_for_selector('#giris-form')
        await s3.fill('#giris-anahtar', K)
        await s3.click('#giris-form button')
        await s3.wait_for_selector('.kadran')
        print('pageerror:', hatalar or 'yok')
        print('canlı akış tamam')
        await b.close()
asyncio.run(main())
