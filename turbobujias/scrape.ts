import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', async msg => {
    const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
    const text = args[0] || '';
    
    if (typeof text === 'string' && text.includes('Encountered two children with the same key')) {
      console.error(`[COLLISION_START]`);
      args.forEach((a, i) => console.error(`  Arg ${i}: ${JSON.stringify(a)}`));
      console.error(`[COLLISION_END]`);
    }
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 10000));
  } catch(e) {
    console.error('Scraper failed:', e);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
