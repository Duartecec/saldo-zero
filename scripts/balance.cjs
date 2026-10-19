// Uso: INDEX=$PWD/index.html N=40 ONLY=maxImagem node scripts/balance.cjs (ONLY opcional: random,maxImagem,maxPoder,maxCaixa,minRadar,safe,balanced)
// Simula estratégias direto no motor do jogo (index.html via file://), sem animação.
const { chromium } = require('playwright');
const N = +process.env.N || 150;
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('file://' + process.env.INDEX); await p.waitForTimeout(500); await p.evaluate(o => { window.__only = o; }, process.env.ONLY || '');
  const t0=Date.now();
  const res = await p.evaluate((N) => {
    const strategies = {
      random: () => Math.random() < 0.5 ? 'l' : 'r',
      maxImagem: (k) => ((k.l[1].i || 0) >= (k.r[1].i || 0) ? 'l' : 'r'),
      maxPoder: (k) => ((k.l[1].p || 0) >= (k.r[1].p || 0) ? 'l' : 'r'),
      maxCaixa: (k) => ((k.l[1].c || 0) >= (k.r[1].c || 0) ? 'l' : 'r'),
      minRadar: (k) => ((k.l[1].r || 0) <= (k.r[1].r || 0) ? 'l' : 'r'),
      safe: (k) => { const sc = o => { const f = typeof o[1] === 'function' ? {} : o[1]; const n = { c: s.caixa + (f.c || 0), p: s.poder + (f.p || 0), i: s.imagem + (f.i || 0), r: s.radar + (f.r || 0) }; return Math.min(n.c, 100 - n.c, n.p, 100 - n.p, n.i, 100 - n.i, (100 - n.r) * 0.8) + (n.c + n.p + n.i - n.r) / 40; }; return sc(k.l) >= sc(k.r) ? 'l' : 'r'; },
      balanced: (k) => { const sc = o => { const f = o[1]; const n = { c: s.caixa + (f.c || 0), p: s.poder + (f.p || 0), i: s.imagem + (f.i || 0), r: s.radar + (f.r || 0) }; return -(Math.abs(n.c - 50) + Math.abs(n.p - 50) + Math.abs(n.i - 50) + n.r * 1.5); }; return sc(k.l) >= sc(k.r) ? 'l' : 'r'; },
    };
    const out = {};
    const only = (window.__only||'').split(',').filter(Boolean);
    for (const [name, pick] of Object.entries(strategies)) { if (only.length && !only.includes(name)) continue;
      const ends = {}; let turns = 0, days = 0;
      for (let g = 0; g < N; g++) {
        store.set('legalOk', true); store.set('tutDone', true);
        newGame('free'); s.favores = 0;
        let t = 0; while (!s.over && t < 300) { const k = BY_ID[s.card]; choose(pick(k, s)); t++; }
        ends[s.over] = (ends[s.over] || 0) + 1; turns += s.turn; days += s.day;
        document.getElementById('endScreen').hidden = true;
      }
      out[name] = { ends, avgTurns: +(turns / N).toFixed(1), avgDays: Math.round(days / N) };
    }
    return out;
  }, N);
  console.log('ms', Date.now()-t0);
  for (const [k, v] of Object.entries(res)) console.log(k.padEnd(10), 'turnos', String(v.avgTurns).padEnd(5), 'dias', String(v.avgDays).padEnd(4), JSON.stringify(v.ends));
  await b.close();
})();
