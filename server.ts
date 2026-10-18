// Servidor mínimo em Bun. Monta a página do jogo em memória a partir de game.html e serve
// as páginas legais exigidas pela App Store (/privacidade e /suporte).
const fragment = await Bun.file(new URL("./game.html", import.meta.url)).text();
const page = (title: string, body: string, description: string) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d1020">
<meta name="description" content="${description}">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>
${body}
</body>
</html>
`;
const html = page("Saldo Zero", fragment, "Saldo Zero: sátira ficcional em que você é um banqueiro tentando sobreviver ao poder. Arraste as cartas e descubra os 10 finais.");

const legalStyle = `<title>__T__</title><style>body{margin:0;background:#0d1020;color:#f4f1ea;font:16px/1.6 -apple-system,system-ui,sans-serif}main{max-width:680px;margin:0 auto;padding:32px 20px 60px}h1{font-size:28px;line-height:1.15}h2{font-size:18px;margin-top:28px}a{color:#f5c04a}p,li{color:#d6d8e6}small{color:#9ea4c4}</style>`;
const legal = (title: string, inner: string) => page(title, legalStyle.replace("__T__", title) + "<main>" + inner + "</main>", title + " · Saldo Zero");

const privacy = legal("Política de privacidade · Saldo Zero", `
<h1>Política de privacidade</h1>
<small>Última atualização: outubro de 2026</small>
<p><b>Saldo Zero</b> é um jogo de ficção e sátira. Ele não exige cadastro, não pede nome, e-mail, telefone, localização nem acesso a contatos, câmera ou microfone.</p>
<h2>Dados que o jogo guarda</h2>
<p>O progresso (finais descobertos, conquistas, recorde e resultado do desafio diário) fica salvo apenas no seu aparelho, no armazenamento local do app ou do navegador. Esses dados não são enviados a nenhum servidor nosso.</p>
<h2>Compras no app</h2>
<p>As compras opcionais são processadas pela Apple por meio da App Store. Não recebemos dados de pagamento. O estado das compras é verificado com a Apple (StoreKit) e armazenado no aparelho para liberar o conteúdo.</p>
<h2>Compartilhamento</h2>
<p>Ao tocar em "Compartilhar", o texto do resultado é enviado ao aplicativo que você escolher. Nada é publicado automaticamente.</p>
<h2>Análises e anúncios</h2>
<p>O app não contém anúncios nem ferramentas de rastreamento de terceiros.</p>
<h2>Crianças</h2>
<p>O conteúdo é sátira política e tem classificação indicativa para maiores de 12 anos. Não coletamos dados de nenhum usuário, de qualquer idade.</p>
<h2>Contato</h2>
<p>Dúvidas: <a href="mailto:contato@vorkaro.site">contato@vorkaro.site</a>.</p>
`);

const support = legal("Suporte · Saldo Zero", `
<h1>Suporte</h1>
<p><b>Saldo Zero</b> é uma obra de ficção e sátira. Personagens, bancos, veículos de imprensa e instituições são inventados; qualquer semelhança com a realidade é parte da brincadeira, não uma afirmação sobre pessoas reais.</p>
<h2>Perguntas frequentes</h2>
<p><b>Comprei um baralho e ele não aparece.</b> Abra a Loja e toque em "Restaurar compras". A liberação depende da mesma conta da App Store usada na compra.</p>
<p><b>O desafio diário muda de aparelho para aparelho?</b> Não. Todo mundo recebe a mesma sequência de cartas no mesmo dia. Os baralhos extras valem só no modo livre, para manter o diário justo.</p>
<p><b>Perdi meu progresso.</b> O progresso fica salvo no aparelho. Reinstalar o app ou limpar os dados do navegador apaga finais e conquistas.</p>
<h2>Fale com a gente</h2>
<p>E-mail: <a href="mailto:contato@vorkaro.site">contato@vorkaro.site</a>. Respondemos em até 2 dias úteis.</p>
<p><a href="/privacidade">Política de privacidade</a></p>
`);

const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/health") return new Response("ok");
    if (pathname === "/privacidade" || pathname === "/privacy") return new Response(privacy, { headers });
    if (pathname === "/suporte" || pathname === "/support") return new Response(support, { headers });
    return new Response(html, { headers });
  },
});
console.log("Saldo Zero rodando na porta " + (Bun.env.PORT || 3000));
