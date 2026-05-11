import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', (error: any) => {
    console.log('PAGE ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
