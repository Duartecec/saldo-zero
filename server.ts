// Servidor do Saldo Zero (Bun, sem dependências).
// - Monta a página do jogo em memória a partir de game.html.
// - Serve o PWA: manifesto, service worker, ícones e fontes locais (public/).
// - Serve as páginas legais /privacidade e /suporte.
const root = new URL("./", import.meta.url);
const fragmentRaw = await Bun.file(new URL("./game.html", root)).text();

// Fontes locais no lugar do Google Fonts: o jogo funciona off-line e sem chamadas externas.
const fontsCSS = `<style>
@font-face{font-family:'Anton';font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/Anton.woff2) format('woff2')}
@font-face{font-family:'Rubik';font-style:normal;font-weight:300 900;font-display:swap;src:url(/fonts/Rubik.woff2) format('woff2')}
@font-face{font-family:'Rubik';font-style:italic;font-weight:300 900;font-display:swap;src:url(/fonts/Rubik-Italic.woff2) format('woff2')}
</style>`;
const fragment = fragmentRaw.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, fontsCSS);

// Versão do cache do service worker: muda sempre que o jogo muda.
const version = new Bun.CryptoHasher("sha1").update(fragmentRaw).digest("hex").slice(0, 10);
const swSource = (await Bun.file(new URL("./public/sw.js", root)).text()).replaceAll("__VERSION__", version);

const SITE = Bun.env.SITE_URL || "https://master-game-github-production.up.railway.app";
const description = "Sátira ficcional: você é o banqueiro. Arraste as cartas, sobreviva ao poder e descubra os 10 finais. Quantos dias você dura?";

const head = (title: string, desc: string) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d1020">
<meta name="description" content="${desc}">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Saldo Zero">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Saldo Zero">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${SITE}/og.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>
`;
const swRegister = `<script>if('serviceWorker' in navigator){addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}</script>`;
const html = head("Saldo Zero · Sobreviva ao poder", description) + fragment + swRegister + "\n</body>\n</html>\n";

const legalStyle = `<style>body{margin:0;background:#0d1020;color:#f4f1ea;font:16px/1.6 -apple-system,system-ui,sans-serif}main{max-width:680px;margin:0 auto;padding:32px 20px 60px}h1{font-size:28px;line-height:1.15}h2{font-size:18px;margin-top:28px}a{color:#f5c04a}p,li{color:#d6d8e6}small{color:#9ea4c4}</style>`;
const legal = (title: string, inner: string) => head(title, title + " · Saldo Zero") + `<title>${title}</title>` + legalStyle + "<main>" + inner + "</main>\n</body>\n</html>\n";

const privacy = legal("Política de privacidade · Saldo Zero", `
<h1>Política de privacidade</h1>
<small>Última atualização: outubro de 2026</small>
<p><b>Saldo Zero</b> é um jogo de ficção e sátira que roda no navegador. Ele não exige cadastro e não pede nome, e-mail, telefone, localização nem acesso a contatos, câmera ou microfone.</p>
<h2>Dados que o jogo guarda</h2>
<p>O progresso (finais descobertos, conquistas, recorde e resultado do desafio diário) fica salvo apenas no seu navegador, no armazenamento local. Esses dados não são enviados a nenhum servidor nosso.</p>
<h2>Compartilhamento</h2>
<p>Ao tocar em "Compartilhar" ou "Copiar resultado", o texto do resultado vai para o aplicativo que você escolher. Nada é publicado automaticamente.</p>
<h2>Análises e anúncios</h2>
<p>O jogo não contém anúncios nem ferramentas de rastreamento de terceiros. O servidor registra apenas logs técnicos de acesso, mantidos pela hospedagem por tempo limitado.</p>
<h2>Contato</h2>
<p>Dúvidas: <a href="mailto:contato@vorkaro.site">contato@vorkaro.site</a>.</p>
`);

const support = legal("Suporte · Saldo Zero", `
<h1>Suporte</h1>
<p><b>Saldo Zero</b> é uma obra de ficção e sátira. Personagens, bancos, veículos de imprensa e instituições são inventados; qualquer semelhança com a realidade é parte da brincadeira, não uma afirmação sobre pessoas reais.</p>
<h2>Perguntas frequentes</h2>
<p><b>Como instalo no celular?</b> No Safari (iPhone), toque em Compartilhar e depois em "Adicionar à Tela de Início". No Chrome (Android), toque no menu e em "Instalar app". O jogo passa a abrir em tela cheia e funciona sem internet.</p>
<p><b>O desafio diário muda de aparelho para aparelho?</b> Não. Todo mundo recebe a mesma sequência de cartas no mesmo dia.</p>
<p><b>Perdi meu progresso.</b> O progresso fica salvo no navegador. Limpar os dados do site apaga finais e conquistas.</p>
<h2>Fale com a gente</h2>
<p>E-mail: <a href="mailto:contato@vorkaro.site">contato@vorkaro.site</a>.</p>
<p><a href="/privacidade">Política de privacidade</a></p>
`);

const MIME: Record<string, string> = {
  png: "image/png", webmanifest: "application/manifest+json", woff2: "font/woff2", js: "text/javascript; charset=utf-8", json: "application/json", svg: "image/svg+xml",
};
const htmlHeaders = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/health") return new Response("ok");
    if (pathname === "/privacidade" || pathname === "/privacy") return new Response(privacy, { headers: htmlHeaders });
    if (pathname === "/suporte" || pathname === "/support") return new Response(support, { headers: htmlHeaders });
    if (pathname === "/sw.js") return new Response(swSource, { headers: { "content-type": MIME.js, "cache-control": "no-cache", "service-worker-allowed": "/" } });

    // Arquivos estáticos de public/ (manifesto, ícones, fontes, imagem de preview).
    const safe = pathname.replace(/\.\./g, "");
    const ext = safe.split(".").pop() || "";
    if (safe.length > 1 && MIME[ext]) {
      const file = Bun.file(new URL("./public" + safe, root));
      if (await file.exists()) {
        return new Response(file, { headers: { "content-type": MIME[ext], "cache-control": ext === "webmanifest" ? "no-cache" : "public, max-age=31536000, immutable" } });
      }
      return new Response("not found", { status: 404 });
    }
    return new Response(html, { headers: htmlHeaders });
  },
});
console.log("Saldo Zero rodando na porta " + (Bun.env.PORT || 3000) + " (cache " + version + ")");
