// Snimak ekrana sajta (za karticu „ekran“ u Byte videima). Koristi Chrome koji Remotion već preuzima.
// Pokretanje: node video/snimak.mjs <url> <izlaz.png>   → ispisuje JSON {ok, visina} ili izlazi sa greškom.
import { writeFile } from 'node:fs/promises';
import { openBrowser } from '@remotion/renderer';

const [url, izlaz] = process.argv.slice(2);
const SIRINA = 1280;
const VISINA = 2000;
const PROZOR = 4200; // stranica se učitava visoka, pa se iseče od README-a (GitHub) ili od vrha
const browser = await openBrowser('chrome', { chromiumOptions: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' } });
const stop = setTimeout(() => {
  console.error('Isteklo vreme za snimak.');
  process.exit(1);
}, 45_000);
try {
  const page = await browser.newPage({ context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {} });
  page.on?.('console', () => {});
  const cdp = page._client();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: SIRINA, height: PROZOR, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await cdp.send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 7000));
  // Kolačići i iskačući prozori: pokušaj da se zatvore, pa skloni sve što je fiksirano preko stranice.
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      for (const b of document.querySelectorAll('button, a')) {
        const t = (b.innerText || '').trim().toLowerCase();
        if (/^(accept|accept all|i agree|agree|got it|ok|close|reject all|decline)$/.test(t)) { try { b.click(); } catch {} }
      }
      for (const e of document.querySelectorAll('body *')) {
        const s = getComputedStyle(e);
        if ((s.position === 'fixed' || s.position === 'sticky') && e.getBoundingClientRect().height > 120) e.remove();
      }
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));
  const vrh = await cdp.send('Runtime.evaluate', {
    expression: `(() => { const r = document.querySelector('article.markdown-body, #readme'); return r ? Math.max(0, r.getBoundingClientRect().top + scrollY - 40) : 0; })()`,
    returnByValue: true,
  });
  const y = Math.min(PROZOR - VISINA, Math.round((vrh.value ?? vrh).result?.value ?? 0));
  const snimak = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y, width: SIRINA, height: VISINA, scale: 1 } });
  const data = snimak.value?.data ?? snimak.data; // Remotion-ov CDP klijent vraća { value }
  await writeFile(izlaz, Buffer.from(data, 'base64'));
  console.log(JSON.stringify({ ok: true }));
} finally {
  clearTimeout(stop);
  await browser.close({ silent: true }).catch(() => {});
}
process.exit(0);
