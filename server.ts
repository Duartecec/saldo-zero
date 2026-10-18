// Servidor mínimo em Bun (mesma stack do master-game atual).
// Monta a página a partir de game.html em memória, então o repositório não precisa versionar index.html.
const fragment = await Bun.file(new URL("./game.html", import.meta.url)).text();
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d1020">
<meta name="description" content="Master Escape: sátira ficcional em que você é um banqueiro tentando sobreviver ao poder. Arraste as cartas e descubra os 10 finais.">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>
${fragment}
</body>
</html>
`;
Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/health") return new Response("ok");
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  },
});
console.log("Master Escape v2 rodando na porta " + (Bun.env.PORT || 3000));
