// Envio de e-mail pelo Resend (https://resend.com). Sem RESEND_API_KEY, o e-mail é apenas registrado no log.
//   RESEND_API_KEY  chave da API
//   RESEND_FROM     remetente, em domínio verificado no Resend (padrão: Saldo Zero <nao-responda@vorkaro.site>)
const KEY = Bun.env.RESEND_API_KEY || "";
const FROM = Bun.env.RESEND_FROM || "Saldo Zero <contato@vorkaro.site>";
const REPLY_TO = Bun.env.RESEND_REPLY_TO || "contato@vorkaro.site";
const SITE = (Bun.env.SITE_URL || "https://vorkaro.site").replace(/\/$/, "");
export const mailEnabled = KEY.length > 0;

export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!mailEnabled) {
    console.log("[mail desligado] para " + to + " · " + subject + " · " + text.replace(/\s+/g, " ").slice(0, 160));
    return { sent: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + KEY, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html, text, headers: { "X-Entity-Ref-ID": crypto.randomUUID() } }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error("[mail] Resend respondeu " + res.status + " para " + to + ": " + body.slice(0, 300));
    return { sent: false, error: body.slice(0, 200) };
  }
  let id = "";
  try { id = JSON.parse(body)?.id || ""; } catch {}
  console.log("[mail] enviado para " + to + " · " + subject + " · id " + id);
  return { sent: true, id };
}

const shell = (title: string, body: string) => `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0d1020;padding:28px 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#f4f1ea">
<div style="max-width:520px;margin:0 auto;background:#171b33;border:1px solid #2c3152;border-radius:16px;padding:26px">
<div style="font-size:22px;font-weight:900;letter-spacing:1px;margin-bottom:6px">SALDO <span style="color:#f5c04a">ZERO</span></div>
<h1 style="font-size:20px;margin:14px 0 10px">${title}</h1>${body}
<p style="color:#9ea4c4;font-size:12px;margin-top:22px">Você recebeu esta mensagem porque este endereço foi informado no jogo <a href="${SITE}" style="color:#f5c04a">Saldo Zero</a> (${SITE.replace(/^https?:\/\//, "")}). Se não foi você, ignore: nada acontece sem o código. Dúvidas: responda a este e-mail.</p></div></body></html>`;

export function verifyEmailTemplate(nick: string, code: string) {
  return {
    subject: "Confirme sua conta no Saldo Zero (código " + code + ")",
    html: shell("Olá, @" + nick + "! Confirme seu e-mail", `<p style="color:#c9cde6">Obrigado por criar sua conta no Saldo Zero. Digite o código abaixo na tela da conta, dentro do jogo, para confirmar o e-mail. Ele vale por 30 minutos.</p><div style="font-size:36px;letter-spacing:8px;font-weight:900;background:#0a0c18;border-radius:12px;padding:14px;text-align:center;color:#f5c04a">${code}</div><p style="color:#c9cde6">Com o e-mail confirmado você entra no ranking diário, guarda suas compras e consegue recuperar o PIN quando precisar.</p>`),
    text: "Olá, @" + nick + "! Obrigado por criar sua conta no Saldo Zero. Seu código de confirmação é " + code + " (vale por 30 minutos). Digite-o na tela da conta, dentro do jogo, em " + SITE + ". Se não foi você, ignore esta mensagem.",
  };
}
export function resetPinTemplate(nick: string, code: string) {
  return {
    subject: "Recuperação de PIN · Saldo Zero",
    html: shell("Trocar o PIN de @" + nick, `<p style="color:#c9cde6">Alguém pediu um novo PIN para esta conta. Use o código abaixo no jogo em até 30 minutos. Se não foi você, ignore: nada muda.</p><div style="font-size:36px;letter-spacing:8px;font-weight:900;background:#0a0c18;border-radius:12px;padding:14px;text-align:center;color:#f5c04a">${code}</div>`),
    text: "Alguém pediu um novo PIN para a conta @" + nick + " no Saldo Zero (" + SITE + "). Código: " + code + " (vale por 30 minutos). Se não foi você, ignore: nada muda.",
  };
}
