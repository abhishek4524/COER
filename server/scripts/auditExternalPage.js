import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function auditLocalHtml() {
  const html = fs.readFileSync('external_page.html', 'utf-8');
  console.log(`Loaded external_page.html: ${html.length} chars`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const audit = await page.evaluate(() => {
      const title = document.title;
      const canvases = document.querySelectorAll('canvas');
      const iframes = document.querySelectorAll('iframe');
      const buttons = document.querySelectorAll('button');
      const links = document.querySelectorAll('a');
      const headings = document.querySelectorAll('h1, h2, h3, h4');
      const images = document.querySelectorAll('img');

      const headingsList = [...headings].map(h => ({
        tag: h.tagName,
        text: h.textContent.trim().slice(0, 50),
      }));

      const buttonsList = [...buttons].map(b => ({
        text: b.textContent.trim().slice(0, 50),
        className: b.className,
      }));

      return {
        title,
        canvasCount: canvases.length,
        iframeCount: iframes.length,
        buttonCount: buttons.length,
        linkCount: links.length,
        headingCount: headings.length,
        imageCount: images.length,
        headingsList,
        buttonsList,
      };
    });

    console.log('=== AUDIT RESULTS FOR https://abhishekkumar7.vercel.app/ ===');
    console.log(`Title: "${audit.title}"`);
    console.log(`Canvas elements: ${audit.canvasCount}`);
    console.log(`iFrames: ${audit.iframeCount}`);
    console.log(`Buttons: ${audit.buttonCount}`);
    console.log(`Links: ${audit.linkCount}`);
    console.log(`Headings: ${audit.headingCount}`);
    console.log(`Images: ${audit.imageCount}`);
    console.log('\nHeadings sample:');
    audit.headingsList.slice(0, 6).forEach(h => console.log(`  <${h.tag}>: "${h.text}"`));
    console.log('\nButtons sample:');
    audit.buttonsList.slice(0, 6).forEach(b => console.log(`  <button>: "${b.text}"`));

    // Test a simulated patch on this site
    console.log('\nTesting simulated patch: setting button font-size to 16px and accent background...');
    const patchResult = await page.evaluate(() => {
      const btn = document.querySelector('button, a[role="button"], nav a');
      if (!btn) return { patched: false };
      btn.style.backgroundColor = '#6C63FF';
      btn.style.color = '#FFFFFF';
      btn.style.fontSize = '16px';
      btn.setAttribute('data-simulated-preview', 'true');
      return {
        patched: true,
        selector: btn.tagName.toLowerCase() + (btn.className ? `.${btn.className.split(' ')[0]}` : ''),
        newBg: window.getComputedStyle(btn).backgroundColor,
        newFontSize: window.getComputedStyle(btn).fontSize,
      };
    });

    console.log('Simulated patch result:', JSON.stringify(patchResult));

  } finally {
    await browser.close();
  }
}

auditLocalHtml().catch(console.error);
