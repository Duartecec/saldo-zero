// Teste ponta a ponta: conta de jogo, loja com Asaas falso, restauração por login e ranking diário.
// Pré-requisitos (rodando):
//   FAKE_PORT=3131 bun run scripts/fake-asaas.ts
//   DATA_DIR=/tmp/sz-e2e ASAAS_API_KEY=test ASAAS_BASE_URL=http://127.0.0.1:3131/v3 SITE_URL=http://127.0.0.1:3125 PORT=3125 bun run server.ts
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3125';
const out = {};
const acceptLegal = async (page) => { await page.waitForTimeout(150); if (await page.isVisible('#legalScreen')) { await page.click('#legalOk'); await page.waitForTimeout(200); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(BASE + '/'); await page.waitForTimeout(800);
  out.shopButton = await page.isVisible('#openShop');
  out.accountPanel = await page.isVisible('#accountPanel');

  // 1. cria conta
  const nick = 'tester_' + Math.random().toString(36).slice(2, 7);
  await page.fill('#nickInput', nick); await page.waitForTimeout(600);
  out.hintFree = await page.textContent('#nickHint');
  out.emailShown = await page.isVisible('#emailLabel');
  await page.fill('#emailInput', nick + '@exemplo.com'); await page.fill('#pinInput', '2719'); await page.click('#loginBtn'); await page.waitForTimeout(800);
  out.loggedIn = (await page.textContent('#accountInfo')).includes('@' + nick);
  out.verifyBoxShown = await page.isVisible('#verifyCode');
  // compra antes de confirmar deve ser recusada
  await page.click('#openShop'); await page.waitForTimeout(300); await page.click('#shopList .buy[data-id="com.saldozero.favores10"]'); await page.waitForTimeout(200);
  await page.fill('#payName', 'Danilo Testador'); await page.fill('#payEmail', 'danilo@example.com'); await page.fill('#payCpf', '529.982.247-25'); await page.click('#payForm button[type=submit]'); await page.waitForTimeout(500);
  out.buyBeforeVerify = await page.textContent('#payError'); await page.click('#btnShopClose');
  // confirma com o código de desenvolvimento
  const code = await page.evaluate(() => window.__devCode); out.devCodeLen = (code || '').length;
  await page.fill('#verifyCode', code); await page.click('#verifyBtn'); await page.waitForTimeout(800);
  out.verified = (await page.textContent('#accountInfo')).includes('confirmado');

  // 2. apelido duplicado com PIN errado não entra
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage(); await p2.goto(BASE + '/'); await p2.waitForTimeout(600);
  await p2.fill('#nickInput', nick); await p2.waitForTimeout(600);
  out.hintTaken = await p2.textContent('#nickHint');
  await p2.fill('#pinInput', '8643'); await p2.click('#loginBtn'); await p2.waitForTimeout(600);
  out.wrongPinError = await p2.textContent('#loginError');
  // apelido igual em maiúsculas também é "existente"
  await p2.fill('#nickInput', nick.toUpperCase()); await p2.waitForTimeout(600);
  out.hintTakenUpper = await p2.textContent('#nickHint');

  // 3. compra pelo Asaas falso, logado
  await page.click('#openShop'); await page.waitForTimeout(300);
  out.vipCard = await page.textContent('#shopList .item.vip'); out.vipTimer = await page.textContent('#vipTimer');
  await page.click('#shopList .buy[data-id="com.saldozero.favores10"]'); await page.waitForTimeout(200);
  await page.fill('#payName', 'Danilo Testador'); await page.fill('#payEmail', 'danilo@example.com'); await page.fill('#payCpf', '529.982.247-25');
  await page.click('#payForm button[type=submit]');
  await page.waitForURL(/\/pay\//, { timeout: 8000 });
  out.invoicePage = page.url();
  await page.click('#pix');
  await page.waitForURL(/pedido=/, { timeout: 8000 });
  await page.waitForTimeout(1500);
  out.favoresAfterPay = await page.evaluate(() => favores);
  // compra um não consumível também (fica na conta)
  await page.click('#shopList .buy[data-id="com.saldozero.deck.eleicao"]'); await page.waitForTimeout(200);
  await page.click('#payForm button[type=submit]'); await page.waitForURL(/\/pay\//, { timeout: 8000 }); await page.click('#pix'); await page.waitForURL(/pedido=/, { timeout: 8000 }); await page.waitForTimeout(1500);
  out.ownedAfterPay = await page.$$eval('#shopList .owned', b => b.length);
  out.entLocal = await page.evaluate(() => [...ent]);
  await page.click('#shopList .buy[data-id="com.saldozero.vip"]'); await page.waitForTimeout(200);
  await page.click('#payForm button[type=submit]'); await page.waitForURL(/\/pay\//, { timeout: 8000 }); await page.click('#pix'); await page.waitForURL(/pedido=/, { timeout: 8000 }); await page.waitForTimeout(1500);
  out.vipOwned = await page.evaluate(() => isVip());
  // jogada do Vorkaro no modo livre: gasta os 2 da partida e depois 1 da conta
  await page.click('#btnShopClose'); await page.click('#playFree'); await acceptLegal(page); if (await page.isVisible('#tut')) await page.click('#tutOk');
  for (let i = 0; i < 3; i++) { await page.click('#btnMove'); await page.waitForTimeout(150); await page.click('#moveList button[data-id="marketing"]'); await page.waitForTimeout(400); }
  out.favoresAfterMoves = await page.evaluate(() => ({ run: s.favores, account: favores, badge: document.getElementById('favBadge').textContent, day: s.day, startedWith: freeFavores() }));
  // força um final por radar e usa o recurso
  await page.evaluate(() => { s.radar = 99; });
  let g = 0; while (!(await page.isVisible('#endScreen')) && g < 40) { await page.click('#btnR'); await page.waitForTimeout(260); g++; }
  out.appealVisible = await page.isVisible('#btnAppeal');
  await page.click('#btnAppeal'); await page.waitForTimeout(600);
  out.afterAppeal = await page.evaluate(() => ({ over: s.over, radar: s.radar, appeals: s.appeals, account: favores, endHidden: document.getElementById('endScreen').hidden }));
  await page.click('#btnMenu'); await page.waitForTimeout(300);

  // conta sem e-mail: cadastra só com apelido e PIN; lembrete aparece após a primeira carta
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p3 = await ctx3.newPage(); await p3.goto(BASE + '/'); await p3.waitForTimeout(600);
  await p3.fill('#nickInput', nick + 'b'); await p3.waitForTimeout(600); await p3.fill('#pinInput', '4826'); await p3.click('#loginBtn'); await p3.waitForTimeout(800);
  out.noEmailSignup = (await p3.textContent('#accountInfo')).includes('@' + nick + 'b');
  out.nudgeBeforePlay = await p3.isVisible('#emailNudge');
  await p3.click('#playFree'); await acceptLegal(p3); if (await p3.isVisible('#tut')) await p3.click('#tutOk'); await p3.click('#btnR'); await p3.waitForTimeout(400);
  out.nudgeAfterPlay = await p3.isVisible('#emailNudge');
  await p3.click('#nudgeBtn'); await p3.waitForTimeout(500); out.nudgeOpensAccount = await p3.isVisible('#addEmail');
  await ctx3.close();
  // 4. outro navegador, mesmo apelido + PIN certo: compra vem junto
  await p2.fill('#nickInput', nick); await p2.fill('#pinInput', '2719'); await p2.waitForTimeout(500); await p2.click('#loginBtn'); await p2.waitForTimeout(800);
  out.entRestoredByLogin = await p2.evaluate(() => [...ent]);

  // 5. diário: termina uma partida e aparece no ranking
  await page.click('#playDaily'); await acceptLegal(page);
  await page.click('#btnMove'); await page.waitForTimeout(150); out.dailyMoveBalance = await page.textContent('#moveBalance'); await page.click('#btnMoveClose');
  if (await page.isVisible('#tut')) await page.click('#tutOk');
  let t = 0; while (!(await page.isVisible('#endScreen')) && t < 150) { await page.click('#btnR'); await page.waitForTimeout(260); t++; }
  await page.waitForTimeout(1500);
  out.endRank = (await page.textContent('#endAch')).includes('Ranking de hoje');
  await page.click('#btnHome'); await page.waitForTimeout(1500);
  out.rankList = await page.textContent('#rankList'); out.rankVip = (await page.innerHTML('#rankList')).includes('⭐');
  out.rankApi = await page.evaluate(() => api('/api/daily?day=' + todayKey()));
  out.authNow = await page.evaluate(() => auth && auth.nick);
  await page.waitForTimeout(1500); out.rankListLater = await page.textContent('#rankList');
  const me = await page.evaluate(() => api('/api/me'));
  out.serverProgress = me.user.progress; out.serverEnt = me.entitlements; out.serverFavores = me.user.favores;
  out.appealInDaily = await page.evaluate(() => canAppeal());
  // esqueci o PIN (por último: a troca encerra todas as sessões da conta)
  await p2.evaluate(() => { try { localStorage.removeItem('me2:auth'); } catch {} }); await p2.reload(); await p2.waitForTimeout(600);
  await p2.fill('#nickInput', nick); await p2.waitForTimeout(500); await p2.click('#forgotLink'); await p2.waitForTimeout(500);
  const rcode = await p2.evaluate(() => window.__devCode); await p2.fill('#resetCode', rcode || '000000'); await p2.fill('#resetPin', '9517'); await p2.click('#resetForm button[type=submit]'); await p2.waitForTimeout(600);
  out.resetDone = await p2.isVisible('#loginForm');
  await p2.fill('#nickInput', nick); await p2.fill('#pinInput', '9517'); await p2.waitForTimeout(400); await p2.click('#loginBtn'); await p2.waitForTimeout(800);
  out.loginWithNewPin = (await p2.textContent('#accountInfo')).includes('@' + nick);
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('E2E FAILED', e); console.log(JSON.stringify(out, null, 1)); process.exit(1); });
