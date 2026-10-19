// Teste ponta a ponta no navegador (Playwright): conta, loja com Asaas falso + webhook, itens vindos do servidor,
// ranking diário, retomada de partida com a mesma sequência de cartas e ausência de violações de CSP.
// Pré-requisitos (rodando):
//   FAKE_PORT=3131 FAKE_WEBHOOK_URL=http://127.0.0.1:3125/api/webhook/asaas FAKE_WEBHOOK_TOKEN=tok-de-teste-1234 bun scripts/fake-asaas.ts
//   DATA_DIR=/tmp/sz-e2e DEV_CODES=1 ASAAS_API_KEY=test ASAAS_BASE_URL=http://127.0.0.1:3131/v3 ASAAS_WEBHOOK_TOKEN=tok-de-teste-1234 SITE_URL=http://127.0.0.1:3125 PORT=3125 bun server.ts
// Playwright: PW_PATH=/caminho/node_modules/playwright node scripts/e2e.cjs (padrão: require('playwright')).
const { chromium } = require(process.env.PW_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3125';
const out = {};
let failures = 0;
const check = (name, cond, extra) => { if (cond) console.log('  ✓ ' + name); else { failures++; console.log('  ✗ ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } };
const acceptLegal = async (page) => { await page.waitForTimeout(150); if (await page.isVisible('#legalScreen')) { await page.click('#legalOk'); await page.waitForTimeout(200); } };
const PIN = '271958', PIN_B = '482617', PIN_NEW = '951730';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  const watch = (p) => { p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/status of (400|401|403|404|409|422|429)/.test(m.text())) errors.push('console: ' + m.text()); }); };
  watch(page);

  await page.goto(BASE + '/'); await page.waitForTimeout(800);
  check('loja visível', await page.isVisible('#openShop'));
  check('rodapé sem "Nenhuma cobrança real"', !(await page.textContent('#legalNote')).includes('Nenhuma cobrança real'));
  check('data do jogo em 2026', (await page.textContent('#date')).includes('2026'));

  // 1. cria conta (PIN de 6)
  const nick = 'tester_' + Math.random().toString(36).slice(2, 7);
  await page.fill('#nickInput', nick); await page.waitForTimeout(600);
  check('dica pede PIN de 6', (await page.textContent('#nickHint')).includes('6 números'));
  await page.fill('#emailInput', nick + '@exemplo.com'); await page.fill('#pinInput', '2719'); await page.click('#loginBtn'); await page.waitForTimeout(700);
  check('PIN de 4 recusado no cadastro', (await page.textContent('#loginError')).includes('6 números'));
  await page.fill('#pinInput', PIN); await page.click('#loginBtn'); await page.waitForTimeout(800);
  check('conta criada e logada', (await page.textContent('#accountInfo')).includes('@' + nick));
  check('botões de sair de todos e excluir conta', await page.isVisible('#logoutAllBtn') && await page.isVisible('#deleteAcctBtn'));
  // compra antes de confirmar deve ser recusada
  await page.click('#openShop'); await page.waitForTimeout(300); await page.click('#shopList .buy[data-id="com.saldozero.favores10"]'); await page.waitForTimeout(200);
  await page.fill('#payName', 'Danilo Testador'); await page.fill('#payEmail', 'danilo@example.com'); await page.fill('#payCpf', '529.982.247-25'); await page.click('#payForm button[type=submit]'); await page.waitForTimeout(500);
  check('compra exige e-mail confirmado', (await page.textContent('#payError')).includes('Confirme')); await page.click('#btnShopClose');
  check('CPF não fica no localStorage', !(await page.evaluate(() => JSON.stringify(localStorage))).includes('52998224725') && !(await page.evaluate(() => JSON.stringify(localStorage))).includes('529.982'));
  const code = await page.evaluate(() => window.__devCode);
  await page.fill('#verifyCode', code); await page.click('#verifyBtn'); await page.waitForTimeout(800);
  check('e-mail confirmado', (await page.textContent('#accountInfo')).includes('confirmado'));

  // 2. apelido existente com PIN errado
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage(); watch(p2); await p2.goto(BASE + '/'); await p2.waitForTimeout(600);
  await p2.fill('#nickInput', nick); await p2.waitForTimeout(600);
  await p2.fill('#pinInput', '8643'); await p2.click('#loginBtn'); await p2.waitForTimeout(600);
  check('PIN errado recusado', (await p2.textContent('#loginError')).includes('PIN incorreto'));

  // 3. compra pelo Asaas falso (webhook libera)
  await page.click('#openShop'); await page.waitForTimeout(300);
  await page.click('#shopList .buy[data-id="com.saldozero.favores10"]'); await page.waitForTimeout(200);
  check('CPF não é preenchido de memória', (await page.inputValue('#payCpf')) === '');
  await page.fill('#payName', 'Danilo Testador'); await page.fill('#payEmail', 'danilo@example.com'); await page.fill('#payCpf', '529.982.247-25');
  await page.click('#payForm button[type=submit]');
  await page.waitForURL(/\/pay\//, { timeout: 8000 }); await page.click('#pix');
  await page.waitForURL(u => !/\/pay\//.test(String(u)), { timeout: 8000 }); await page.waitForTimeout(2000);
  check('favores creditados após confirmação do servidor', (await page.evaluate(() => favores)) === 10, await page.evaluate(() => favores));
  check('pendente limpo após confirmação', (await page.evaluate(() => localStorage.getItem('me2:pending'))) === 'null');
  for (const id of ['com.saldozero.deck.eleicao', 'com.saldozero.vip']) {
    await page.click('#shopList .buy[data-id="' + id + '"]'); await page.waitForTimeout(200);
    await page.fill('#payCpf', '529.982.247-25');
    await page.click('#payForm button[type=submit]'); await page.waitForURL(/\/pay\//, { timeout: 8000 }); await page.click('#pix');
    await page.waitForURL(u => !/\/pay\//.test(String(u)), { timeout: 8000 }); await page.waitForTimeout(2000);
  }
  check('baralho e VIP liberados', await page.evaluate(() => owns('com.saldozero.deck.eleicao') && isVip()));
  await page.click('#btnShopClose');

  // 4. localStorage editado não libera nada: sem login o cache é descartado
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p3 = await ctx3.newPage(); watch(p3); await p3.goto(BASE + '/'); await p3.waitForTimeout(400);
  await p3.evaluate(() => localStorage.setItem('me2:ent', JSON.stringify(['com.saldozero.vip', 'com.saldozero.capas'])));
  await p3.reload(); await p3.waitForTimeout(800);
  check('VIP forjado no localStorage não vale', !(await p3.evaluate(() => isVip())));
  // conta nova com o CPF da outra pessoa não restaura nada
  await p3.fill('#nickInput', nick + 'b'); await p3.waitForTimeout(600); await p3.fill('#pinInput', PIN_B); await p3.click('#loginBtn'); await p3.waitForTimeout(800);
  await p3.click('#openShop'); await p3.waitForTimeout(300); await p3.click('#btnRestore'); await p3.fill('#restoreCpf', '529.982.247-25'); await p3.click('#restoreForm button[type=submit]'); await p3.waitForTimeout(1000);
  check('restaurar com CPF de terceiro não libera', !(await p3.evaluate(() => isVip())) && (await p3.evaluate(() => favores)) === 0);
  await ctx3.close();

  // 5. outro navegador, PIN certo: compras vêm do servidor
  await p2.fill('#nickInput', nick); await p2.fill('#pinInput', PIN); await p2.waitForTimeout(500); await p2.click('#loginBtn'); await p2.waitForTimeout(1000);
  check('itens vêm do servidor no login', (await p2.evaluate(() => [...ent].sort().join(','))) === 'com.saldozero.deck.eleicao,com.saldozero.vip');

  // 6. diário: mesmo VIP tem só 2 favores; termina e aparece no ranking; compartilhamento
  await page.click('#playDaily'); await acceptLegal(page);
  if (await page.isVisible('#tut')) await page.click('#tutOk');
  check('diário: VIP também começa com 2 favores', (await page.evaluate(() => s.favores)) === 2);
  let t = 0; while (!(await page.isVisible('#endScreen')) && t < 150) { await page.click('#btnR'); await page.waitForTimeout(260); t++; }
  await page.waitForTimeout(1500);
  check('ranking de hoje no fim', (await page.textContent('#endAch')).includes('Ranking de hoje'));
  const share = await page.textContent('#shareText');
  check('texto de compartilhamento', /Durei \d+ dias\. Quantos você dura\?/.test(share) && share.includes('% dos jogadores') && share.includes(BASE + '/'), share);
  await page.click('#btnHome'); await page.waitForTimeout(1200);
  check('ranking lista o apelido', (await page.textContent('#rankList')).includes('@' + nick));

  // 7. retomar partida mantém a mesma sequência de cartas (diário)
  const seq = async (p, n) => { const ids = []; for (let i = 0; i < n; i++) { const prev = await p.evaluate(() => s.card + ":" + s.turn); ids.push(prev.split(":")[0]); await p.click("#btnR"); await p.waitForFunction((pv) => s.over || (s.card + ":" + s.turn) !== pv, prev); await p.waitForTimeout(450); if (await p.isVisible('#endScreen')) break; } return ids; };
  const c4 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pa = await c4.newPage(); watch(pa);
  await pa.goto(BASE + '/'); await pa.waitForTimeout(500); await pa.click('#playDaily'); await acceptLegal(pa); if (await pa.isVisible('#tut')) await pa.click('#tutOk');
  const full = await seq(pa, 10);
  const c5 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pb = await c5.newPage(); watch(pb);
  await pb.goto(BASE + '/'); await pb.waitForTimeout(500); await pb.click('#playDaily'); await acceptLegal(pb); if (await pb.isVisible('#tut')) await pb.click('#tutOk');
  const first = await seq(pb, 5);
  await pb.reload(); await pb.waitForTimeout(800); await pb.click('#btnResume'); await pb.waitForTimeout(400);
  const rest = await seq(pb, 5);
  check('retomada mantém as mesmas cartas', JSON.stringify(full) === JSON.stringify(first.concat(rest)), { full, resumed: first.concat(rest) });
  await c4.close(); await c5.close();

  // 8. esqueci o PIN (última: troca encerra as sessões)
  await p2.evaluate(() => { try { localStorage.removeItem('me2:auth'); } catch {} }); await p2.reload(); await p2.waitForTimeout(600);
  await p2.fill('#nickInput', nick); await p2.waitForTimeout(500); await p2.click('#forgotLink'); await p2.waitForTimeout(500);
  const rcode = await p2.evaluate(() => window.__devCode); await p2.fill('#resetCode', rcode || '000000'); await p2.fill('#resetPin', PIN_NEW); await p2.click('#resetForm button[type=submit]'); await p2.waitForTimeout(600);
  await p2.fill('#nickInput', nick); await p2.fill('#pinInput', PIN_NEW); await p2.waitForTimeout(400); await p2.click('#loginBtn'); await p2.waitForTimeout(800);
  check('entra com o PIN novo', (await p2.textContent('#accountInfo')).includes('@' + nick));

  // 9. excluir conta
  p2.on('dialog', d => d.type() === 'prompt' ? d.accept(PIN_NEW) : d.accept());
  await p2.click('#deleteAcctBtn'); await p2.waitForTimeout(1000);
  check('conta excluída e deslogada', await p2.isVisible('#loginForm'));

  check('sem erros de página nem violações de CSP', errors.length === 0, errors);
  await browser.close();
  console.log(failures ? failures + ' falha(s)' : 'e2e ok');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('E2E FAILED', e); process.exit(1); });
