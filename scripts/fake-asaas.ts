// Asaas de mentira para testes locais: implementa só o que store.ts usa.
// Uso: ASAAS_BASE_URL=http://127.0.0.1:3131/v3 ASAAS_API_KEY=test bun run server.ts
//      bun run scripts/fake-asaas.ts
const customers: any[] = [];
const payments: any[] = [];
const PORT = Number(Bun.env.FAKE_PORT || 3131);
let n = 0;

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
        return Response.redirect(pay.callback?.successUrl || "/", 302);
      }
      return new Response(`<!doctype html><meta charset="utf-8"><title>Fake Asaas</title><h1>Cobrança ${pay.description}</h1><p>R$ ${pay.value}</p><a id="pix" href="/pay/${id}?do=pay">Pagar com Pix (fake)</a>`, { headers: { "content-type": "text/html; charset=utf-8" } });
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
    if (p.startsWith("/v3/payments/") && req.method === "GET") {
      const pay = payments.find((x) => x.id === p.slice("/v3/payments/".length));
      return pay ? Response.json(pay) : Response.json({ errors: [{ description: "not found" }] }, { status: 404 });
    }
    return Response.json({ errors: [{ description: "rota não implementada no fake: " + req.method + " " + p }] }, { status: 404 });
  },
});
console.log("fake asaas na porta " + PORT);
