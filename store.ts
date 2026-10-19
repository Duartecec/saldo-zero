// Loja web do Saldo Zero com Asaas (Pix, cartão e boleto no checkout hospedado do Asaas).
//
// Fluxo:
//   1. POST /api/checkout  { productId, name, email, cpfCnpj }
//        -> encontra/cria o cliente no Asaas, cria uma cobrança com billingType UNDEFINED
//           (o pagador escolhe Pix, cartão ou boleto na página do Asaas) e devolve invoiceUrl.
//   2. O jogo redireciona para invoiceUrl. Ao pagar, o Asaas devolve o jogador a SITE_URL/?pedido=<id>.
//   3. GET /api/order/:id -> consulta a cobrança; paga quando RECEIVED, CONFIRMED ou RECEIVED_IN_CASH.
//   4. POST /api/restore { cpfCnpj } -> lista cobranças pagas do cliente e devolve os produtos.
//   5. POST /api/webhook/asaas -> confirma o token e registra o evento (a confirmação de fato vem da consulta).
//
// Não há banco de dados: o Asaas é a fonte de verdade das compras; o navegador guarda o que foi liberado.
//
// Variáveis de ambiente:
//   ASAAS_API_KEY        chave da API (sandbox ou produção). Sem ela a loja fica desligada.
//   ASAAS_ENV            "sandbox" (padrão) ou "production".
//   ASAAS_BASE_URL       opcional, sobrescreve a URL base (usado nos testes).
//   ASAAS_WEBHOOK_TOKEN  token configurado no webhook do Asaas (header asaas-access-token).
//   SITE_URL             domínio público, usado no redirecionamento de volta.

import { db, now } from "./db";

export const PRODUCTS: Record<string, { name: string; value: number; favores?: number }> = {
  "com.saldozero.favores10": { name: "Saldo Zero · 10 favores", value: 9.9, favores: 10 },
  "com.saldozero.favores30": { name: "Saldo Zero · 30 favores", value: 19.9, favores: 30 },
  "com.saldozero.deck.eleicao": { name: "Saldo Zero · Baralho Ano Eleitoral", value: 9.9 },
  "com.saldozero.capas": { name: "Saldo Zero · Pacote de capas", value: 5.9 },
};
const PAID = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const REF_PREFIX = "sz:";

const KEY = Bun.env.ASAAS_API_KEY || "";
const ENV = Bun.env.ASAAS_ENV || "sandbox";
const BASE = Bun.env.ASAAS_BASE_URL || (ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");

export const storeEnabled = KEY.length > 0;

export class StoreError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const brl = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");

export function storeConfig() {
  return {
    enabled: storeEnabled,
    provider: "asaas",
    env: ENV,
    products: Object.entries(PRODUCTS).map(([id, p]) => ({ id, price: brl(p.value), value: p.value, favores: p.favores || 0 })),
  };
}

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { access_token: KEY, "content-type": "application/json", accept: "application/json", "user-agent": "SaldoZero/1.0", ...(init.headers || {}) },
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  if (!res.ok) {
    const msg = json?.errors?.[0]?.description || ("Asaas respondeu " + res.status);
    throw new StoreError(msg, res.status >= 500 ? 502 : 400);
  }
  return json;
}

// ---- validação ----
const digits = (s: string) => (s || "").replace(/\D/g, "");
function validCPF(c: string) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === +c[9] && calc(10) === +c[10];
}
function validCNPJ(c: string) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => { const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < len; i++) s += +c[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === +c[12] && calc(13) === +c[13];
}
export function validateBuyer(input: any) {
  const name = String(input?.name || "").trim().replace(/\s+/g, " ");
  const email = String(input?.email || "").trim().toLowerCase();
  const doc = digits(String(input?.cpfCnpj || ""));
  if (name.length < 3 || name.length > 80) throw new StoreError("Informe seu nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) throw new StoreError("Informe um e-mail válido.");
  if (!(validCPF(doc) || validCNPJ(doc))) throw new StoreError("CPF ou CNPJ inválido.");
  return { name, email, cpfCnpj: doc };
}

// ---- cliente ----
async function findOrCreateCustomer(b: { name: string; email: string; cpfCnpj: string }) {
  const found = await asaas("/customers?cpfCnpj=" + b.cpfCnpj + "&limit=1");
  if (found?.data?.length) return found.data[0].id as string;
  const created = await asaas("/customers", { method: "POST", body: JSON.stringify({ name: b.name, email: b.email, cpfCnpj: b.cpfCnpj, notificationDisabled: true, externalReference: "saldozero" }) });
  return created.id as string;
}

// ---- checkout ----
export async function createCheckout(input: any, siteURL: string, userId: number | null = null) {
  if (!storeEnabled) throw new StoreError("Loja desligada.", 503);
  const productId = String(input?.productId || "");
  const product = PRODUCTS[productId];
  if (!product) throw new StoreError("Produto desconhecido.");
  const buyer = validateBuyer(input);
  const customer = await findOrCreateCustomer(buyer);
  const ref = REF_PREFIX + productId + ":" + crypto.randomUUID().slice(0, 8);
  const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const payment = await asaas("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer,
      billingType: "UNDEFINED",
      value: product.value,
      dueDate: due,
      description: product.name,
      externalReference: ref,
      callback: { successUrl: siteURL + "/?pedido=" + encodeURIComponent(ref), autoRedirect: true },
    }),
  });
  db.run("INSERT OR IGNORE INTO orders (payment_id, ref, user_id, product_id, status, created_at, value) VALUES (?, ?, ?, ?, ?, ?, ?)", [payment.id, ref, userId, productId, payment.status || "PENDING", now(), product.value]);
  return { paymentId: payment.id as string, ref, invoiceUrl: payment.invoiceUrl as string, productId };
}

/// Registra o estado de uma cobrança e, se paga e ligada a um usuário, libera o produto na conta.
export function recordPayment(p: { id: string; status: string; externalReference?: string | null }) {
  const productId = productFromRef(p.externalReference);
  if (!productId) return null;
  const paid = PAID.has(p.status);
  db.run("INSERT INTO orders (payment_id, ref, user_id, product_id, status, created_at, paid_at, value) VALUES (?, ?, NULL, ?, ?, ?, ?, ?) ON CONFLICT(payment_id) DO UPDATE SET status = excluded.status, paid_at = COALESCE(orders.paid_at, excluded.paid_at)",
    [p.id, p.externalReference, productId, p.status, now(), paid ? now() : null, PRODUCTS[productId].value]);
  if (paid) {
    const order = db.query("SELECT user_id FROM orders WHERE payment_id = ?").get(p.id) as { user_id: number | null } | null;
    if (order?.user_id) grantEntitlement(order.user_id, productId, p.id);
  }
  return { productId, paid };
}
/// Idempotente: a chave (usuário, pagamento) garante que um pacote de favores só é creditado uma vez.
export function grantEntitlement(userId: number, productId: string, paymentId: string) {
  const r = db.run("INSERT OR IGNORE INTO entitlements (user_id, product_id, payment_id, created_at) VALUES (?, ?, ?, ?)", [userId, productId, paymentId, now()]);
  const favores = PRODUCTS[productId]?.favores || 0;
  if (favores && r.changes > 0) db.run("UPDATE users SET favores = favores + ? WHERE id = ?", [favores, userId]);
  return r.changes > 0;
}
/// Liga um pedido ainda sem dono ao usuário que acabou de entrar (ex.: comprou deslogado e depois criou a conta).
export function claimOrder(ref: string, userId: number) {
  db.run("UPDATE orders SET user_id = ? WHERE ref = ? AND user_id IS NULL", [userId, ref]);
  const o = db.query("SELECT payment_id, product_id, status FROM orders WHERE ref = ? AND user_id = ?").get(ref, userId) as any;
  if (o && PAID.has(o.status)) grantEntitlement(userId, o.product_id, o.payment_id);
}

// ---- consulta ----
function productFromRef(ref: string | null | undefined) {
  if (!ref || !ref.startsWith(REF_PREFIX)) return null;
  const id = ref.slice(REF_PREFIX.length).split(":")[0];
  return PRODUCTS[id] ? id : null;
}
function summarize(p: any) {
  recordPayment(p);
  return { paymentId: p.id, status: p.status, paid: PAID.has(p.status), productId: productFromRef(p.externalReference), invoiceUrl: p.invoiceUrl };
}
export async function getOrder(idOrRef: string) {
  if (!storeEnabled) throw new StoreError("Loja desligada.", 503);
  if (idOrRef.startsWith(REF_PREFIX)) {
    const list = await asaas("/payments?externalReference=" + encodeURIComponent(idOrRef) + "&limit=1");
    if (!list?.data?.length) throw new StoreError("Pedido não encontrado.", 404);
    return summarize(list.data[0]);
  }
  if (!/^[\w-]{3,64}$/.test(idOrRef)) throw new StoreError("Pedido inválido.");
  return summarize(await asaas("/payments/" + idOrRef));
}

// ---- restauração ----
export async function restorePurchases(input: any, userId: number | null = null) {
  if (!storeEnabled) throw new StoreError("Loja desligada.", 503);
  const doc = digits(String(input?.cpfCnpj || ""));
  if (!(validCPF(doc) || validCNPJ(doc))) throw new StoreError("CPF ou CNPJ inválido.");
  const customers = await asaas("/customers?cpfCnpj=" + doc + "&limit=5");
  const products = new Set<string>();
  let count = 0;
  for (const c of customers?.data || []) {
    const payments = await asaas("/payments?customer=" + c.id + "&limit=100");
    for (const p of payments?.data || []) {
      const id = productFromRef(p.externalReference);
      if (id && PAID.has(p.status)) { count++; if (!PRODUCTS[id].favores) products.add(id); if (userId) grantEntitlement(userId, id, p.id); }
    }
  }
  return { products: [...products], count };
}

// ---- webhook ----
export function webhookAuthorized(req: Request) {
  const expected = Bun.env.ASAAS_WEBHOOK_TOKEN || "";
  if (!expected) return false;
  return req.headers.get("asaas-access-token") === expected;
}
