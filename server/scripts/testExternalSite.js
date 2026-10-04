import { chromium } from 'playwright';

async function testExternalHtml() {
  console.log('Fetching HTML via fetch...');
  const res = await fetch('https://abhishekkumar7.vercel.app/');
  const html = await res.text();
  console.log(`Fetched HTML length: ${html.length} bytes`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const audit = await page.evaluate(() => {
      const title = document.title;
      const canvases = document.querySelectorAll('canvas');
      const iframes = document.querySelectorAll('iframe');
      const buttons = document.querySelectorAll('button');
      const links = document.querySelectorAll('a');
      const headings = document.querySelectorAll('h1, h2, h3');
      const textSample = document.body ? document.body.innerText.slice(0, 300) : '';

      return {
        title,
        canvasCount: canvases.length,
        iframeCount: iframes.length,
        buttonCount: buttons.length,
        linkCount: links.length,
        headingCount: headings.length,
        textSample,
        headings: [...headings].slice(0, 5).map(h => ({ tag: h.tagName, text: h.textContent.trim() })),
      };
    });

    console.log('DOM AUDIT of https://abhishekkumar7.vercel.app/:');
    console.log(JSON.stringify(audit, null, 2));

    // Test a simulated patch on this page
    await page.evaluate(() => {
      const h1 = document.querySelector('h1') || document.querySelector('h2');
      if (h1) {
        h1.style.color = '#6C63FF';
        h1.setAttribute('data-simulated-fix', 'true');
      }
    });

    const isPatched = await page.$eval('[data-simulated-fix="true"]', el => el.style.color).catch(() => null);
    console.log(`Simulated patch applied: target element color = "${isPatched}"`);

  } finally {
    await browser.close();
  }
}

testExternalHtml().catch(console.error);
