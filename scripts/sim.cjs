const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '../index.html'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shot-start.png' });
  const results = [];
  for (let g = 0; g < 60; g++) {
    if (g === 0) await page.click('#playDaily'); else await page.click('#playFree');
    await page.waitForTimeout(100);
    if (await page.isVisible('#tut')) await page.click('#tutOk');
    let turns = 0;
    while (!(await page.isVisible('#endScreen')) && turns < 200) {
      if (g === 0 && turns === 2) await page.screenshot({ path: 'shot-card.png' });
      await page.click(Math.random() < 0.5 ? '#btnL' : '#btnR');
      await page.waitForTimeout(300);
      turns++;
    }
    const r = await page.evaluate(() => ({ end: s.over, day: s.day, turn: s.turn, ach: s.ach, seen: s.seen.length, c: s.caixa, p: s.poder, i: s.imagem, r: s.radar }));
    results.push(r);
    if (g === 0) { await page.screenshot({ path: 'shot-end.png', fullPage: true }); }
    await page.click('#btnHome');
    await page.waitForTimeout(100);
  }
  const ends = {}; let days = 0, turns = 0;
  results.forEach(r => { ends[r.end] = (ends[r.end] || 0) + 1; days += r.day; turns += r.turn; });
  console.log('games', results.length, 'avg days', (days / results.length).toFixed(0), 'avg turns', (turns / results.length).toFixed(1));
  console.log('endings', JSON.stringify(ends));
  console.log('turn range', Math.min(...results.map(r => r.turn)), Math.max(...results.map(r => r.turn)));
  console.log('ach', JSON.stringify(results.flatMap(r => r.ach).reduce((a, b) => (a[b] = (a[b] || 0) + 1, a), {})));
  console.log('errors', errors.slice(0, 10));
  await page.screenshot({ path: 'shot-home-after.png' });
  await browser.close();
})();
