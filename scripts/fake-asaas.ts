// Asaas de mentira para testes locais: implementa só o que store.ts usa, mais webhook e estorno.
// Uso: FAKE_PORT=3131 FAKE_WEBHOOK_URL=http://127.0.0.1:3125/api/webhook/asaas FAKE_WEBHOOK_TOKEN=tok-de-teste bun scripts/fake-asaas.ts
//      ASAAS_BASE_URL=http://127.0.0.1:3131/v3 ASAAS_API_KEY=test ASAAS_WEBHOOK_TOKEN=tok-de-teste bun server.ts
// Rotas de controle (sem token, só para testes):
//   GET  /pay/:id?do=pay        marca como pago, dispara PAYMENT_RECEIVED e redireciona para a successUrl
//   POST /_test/pay/:id         marca como pago e dispara o webhook (sem redirecionar)
//   POST /v3/payments/:id/refund  estorno (como no Asaas real; exige access_token) e dispara PAYMENT_REFUNDED
const customers: any[] = [];
const payments: any[] = [];
const PORT = Number(Bun.env.FAKE_PORT || 3131);
const HOOK = Bun.env.FAKE_WEBHOOK_URL || "";
const HOOK_TOKEN = Bun.env.FAKE_WEBHOOK_TOKEN || "";
let n = 0;

async function fire(event: string, pay: any) {
  if (!HOOK) return;
  try {
    const r = await fetch(HOOK, { method: "POST", headers: { "content-type": "application/json", "asaas-access-token": HOOK_TOKEN }, body: JSON.stringify({ event, payment: pay }) });
    console.log("[fake] webhook " + event + " " + pay.id + " -> " + r.status);
  } catch (e) { console.log("[fake] webhook falhou: " + (e as Error).message); }
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;
    // Página de cobrança "hospedada": um botão que marca como pago e redireciona.
    if (p.startsWith("/pay/")) {
      const id = p.slice(5);
      const pay = payments.find((x) => x.id === id);
      if (!pay) return new Response("not found", { status: 404 });
      if (url.searchParams.get("do") === "pay") {
        pay.status = "RECEIVED";
        await fire("PAYMENT_RECEIVED", pay);
        return Response.redirect(pay.callback?.successUrl || "/", 302);
      }
      return new Response(`<!doctype html><meta charset="utf-8"><title>Fake Asaas</title><h1>Cobrança ${pay.description}</h1><p>R$ ${pay.value}</p><a id="pix" href="/pay/${id}?do=pay">Pagar com Pix (fake)</a>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (p.startsWith("/_test/pay/") && req.method === "POST") {
      const pay = payments.find((x) => x.id === p.slice("/_test/pay/".length));
      if (!pay) return Response.json({ error: "not found" }, { status: 404 });
      pay.status = "RECEIVED";
      if (url.searchParams.get("silent") !== "1") await fire("PAYMENT_RECEIVED", pay);
      return Response.json(pay);
    }
    if (req.headers.get("access_token") !== "test") return Response.json({ errors: [{ description: "invalid access_token" }] }, { status: 401 });
    if (p === "/v3/customers" && req.method === "GET") {
      const doc = url.searchParams.get("cpfCnpj");
      return Response.json({ data: customers.filter((c) => !doc || c.cpfCnpj === doc) });
    }
    if (p === "/v3/customers" && req.method === "POST") {
      const b = await req.json();
      const c = { id: "cus_" + (++n), ...b };
      customers.push(c);
      return Response.json(c);
    }
    if (p === "/v3/payments" && req.method === "POST") {
      const b = await req.json();
      if (!customers.find((c) => c.id === b.customer)) return Response.json({ errors: [{ description: "cliente inválido" }] }, { status: 400 });
      const id = "pay_" + (++n);
      const pay = { id, status: "PENDING", invoiceUrl: "http://127.0.0.1:" + PORT + "/pay/" + id, ...b };
      payments.push(pay);
      return Response.json(pay);
    }
    if (p === "/v3/payments" && req.method === "GET") {
      const ref = url.searchParams.get("externalReference");
      const cus = url.searchParams.get("customer");
      return Response.json({ data: payments.filter((x) => (!ref || x.externalReference === ref) && (!cus || x.customer === cus)) });
    }
    const refund = p.match(/^\/v3\/payments\/([\w-]+)\/refund$/);
    if (refund && req.method === "POST") {
      const pay = payments.find((x) => x.id === refund[1]);
      if (!pay) return Response.json({ errors: [{ description: "not found" }] }, { status: 404 });
      pay.status = "REFUNDED";
      await fire("PAYMENT_REFUNDED", pay);
      return Response.json(pay);
    }
    if (p.startsWith("/v3/payments/") && req.method === "GET") {
      const pay = payments.find((x) => x.id === p.slice("/v3/payments/".length));
      return pay ? Response.json(pay) : Response.json({ errors: [{ description: "not found" }] }, { status: 404 });
    }
    return Response.json({ errors: [{ description: "rota não implementada no fake: " + req.method + " " + p }] }, { status: 404 });
  },
});
console.log("fake asaas na porta " + PORT + (HOOK ? " (webhook -> " + HOOK + ")" : ""));
