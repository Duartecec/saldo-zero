// Login de jogo: apelido único + PIN de 4 a 8 dígitos. Sem e-mail, sem senha longa.
// O servidor devolve um token guardado no navegador; o mesmo apelido entra em qualquer aparelho.
import { db, now } from "./db";
import { sendMail, verifyEmailTemplate, resetPinTemplate } from "./mail";
import { isVip } from "./store";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const RESERVED = new Set(["admin", "administrador", "vorkaro", "saldozero", "maxter", "suporte", "moderador", "sistema", "root"]);
const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;

export function normalizeNick(raw: unknown) {
  const nick = String(raw || "").trim();
  if (!NICK_RE.test(nick)) throw new AuthError("Apelido: 3 a 16 letras, números ou _ (sem espaços nem acentos).");
  if (RESERVED.has(nick.toLowerCase())) throw new AuthError("Esse apelido é reservado.");
  return { key: nick.toLowerCase(), display: nick };
}
function normalizePin(raw: unknown) {
  const pin = String(raw || "").trim();
  if (!/^\d{4,8}$/.test(pin)) throw new AuthError("PIN: de 4 a 8 números.");
  if (/^(\d)\1+$/.test(pin) || pin === "1234" || pin === "123456") throw new AuthError("Escolha um PIN menos óbvio.");
  return pin;
}

export type UserRow = { id: number; nick: string; nick_display: string; pin_hash: string; progress: string; created_at: number; last_seen: number; favores: number; blocked: number; note: string; email: string | null; email_verified: number; code: string | null; code_kind: string | null; code_expires: number; code_attempts: number };
const DEV_CODES = Bun.env.DEV_CODES === "1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function normalizeEmail(raw: unknown) {
  const email = String(raw || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) throw new AuthError("Informe um e-mail válido.");
  return email;
}
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));
async function issueCode(userId: number, kind: "verify" | "reset") {
  const code = newCode();
  db.run("UPDATE users SET code = ?, code_kind = ?, code_expires = ?, code_attempts = 0 WHERE id = ?", [code, kind, now() + 30 * 60_000, userId]);
  const u = db.query("SELECT nick_display, email FROM users WHERE id = ?").get(userId) as { nick_display: string; email: string | null };
  if (u?.email) {
    const tpl = kind === "verify" ? verifyEmailTemplate(u.nick_display, code) : resetPinTemplate(u.nick_display, code);
    await sendMail(u.email, tpl.subject, tpl.html, tpl.text);
  }
  return code;
}
function consumeCode(user: UserRow, kind: string, given: unknown) {
  const code = String(given || "").trim();
  if (!/^\d{6}$/.test(code)) throw new AuthError("Código: 6 números.");
  const fresh = db.query("SELECT code, code_kind, code_expires, code_attempts FROM users WHERE id = ?").get(user.id) as any;
  if (!fresh?.code || fresh.code_kind !== kind || fresh.code_expires < now()) throw new AuthError("Código expirado. Peça um novo.", 410);
  if (fresh.code_attempts >= 5) throw new AuthError("Muitas tentativas. Peça um novo código.", 429);
  if (fresh.code !== code) { db.run("UPDATE users SET code_attempts = code_attempts + 1 WHERE id = ?", [user.id]); throw new AuthError("Código incorreto.", 401); }
  db.run("UPDATE users SET code = NULL, code_kind = NULL, code_expires = 0, code_attempts = 0 WHERE id = ?", [user.id]);
}

export function nickAvailable(raw: unknown) {
  const { key, display } = normalizeNick(raw);
  const row = db.query("SELECT id FROM users WHERE nick = ?").get(key) as { id: number } | null;
  return { nick: display, available: !row };
}

// Tentativas falhas por apelido (anti força bruta no PIN).
const failures = new Map<string, { n: number; until: number }>();
function checkLock(key: string) {
  const f = failures.get(key);
  if (f && f.until > now()) throw new AuthError("Muitas tentativas. Tente de novo em alguns minutos.", 429);
}
function noteFailure(key: string) {
  const f = failures.get(key) || { n: 0, until: 0 };
  f.n++;
  if (f.n >= 6) { f.until = now() + 15 * 60_000; f.n = 0; }
  failures.set(key, f);
}

async function newSession(userId: number) {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  db.run("INSERT INTO sessions (token, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)", [token, userId, now(), now()]);
  return token;
}

/// Entra se o apelido existe (PIN precisa bater); cria a conta se não existe.
export async function enter(input: any) {
  const { key, display } = normalizeNick(input?.nick);
  const pin = normalizePin(input?.pin);
  checkLock(key);
  const row = db.query("SELECT * FROM users WHERE nick = ?").get(key) as UserRow | null;
  if (row) {
    if (row.blocked) throw new AuthError("Esta conta foi bloqueada. Fale com o suporte pelo menu Ajuda.", 403);
    const ok = await Bun.password.verify(pin, row.pin_hash);
    if (!ok) { noteFailure(key); throw new AuthError("PIN incorreto para este apelido.", 401); }
    failures.delete(key);
    db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now(), row.id]);
    return { token: await newSession(row.id), user: publicUser(row), created: false };
  }
  if (input?.create !== true) throw new AuthError("Apelido livre. Confirme para criar sua conta.", 404);
  const email = normalizeEmail(input?.email);
  if (db.query("SELECT id FROM users WHERE email = ?").get(email)) throw new AuthError("Este e-mail já tem uma conta. Entre com o apelido dela ou use \"Esqueci o PIN\".", 409);
  const hash = await Bun.password.hash(pin, { algorithm: "argon2id", memoryCost: 19456, timeCost: 2 });
  try {
    db.run("INSERT INTO users (nick, nick_display, pin_hash, created_at, last_seen, email) VALUES (?, ?, ?, ?, ?, ?)", [key, display, hash, now(), now(), email]);
  } catch {
    throw new AuthError("Esse apelido acabou de ser escolhido por outra pessoa.", 409);
  }
  const created = db.query("SELECT * FROM users WHERE nick = ?").get(key) as UserRow;
  const code = await issueCode(created.id, "verify");
  return { token: await newSession(created.id), user: publicUser(created), created: true, ...(DEV_CODES ? { devCode: code } : {}) };
}

export function userFromRequest(req: Request): UserRow | null {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!/^[\w-]{40,120}$/.test(token)) return null;
  const row = db.query("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?").get(token) as UserRow | null;
  if (row && row.blocked) return null;
  if (row) db.run("UPDATE sessions SET last_seen = ? WHERE token = ?", [now(), token]);
  return row;
}
export function requireUser(req: Request) {
  const u = userFromRequest(req);
  if (!u) throw new AuthError("Entre com seu apelido para continuar.", 401);
  return u;
}
export function logout(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) db.run("DELETE FROM sessions WHERE token = ?", [token]);
}

export function publicUser(row: UserRow) {
  const fresh = db.query("SELECT favores, email, email_verified FROM users WHERE id = ?").get(row.id) as { favores: number; email: string | null; email_verified: number } | null;
  return { id: row.id, nick: row.nick_display, createdAt: row.created_at, progress: safeJSON(row.progress), favores: fresh?.favores ?? 0, email: fresh?.email ? maskEmail(fresh.email) : null, emailVerified: !!fresh?.email_verified, vip: isVip(row.id) };
}
const maskEmail = (e: string) => { const [u, d] = e.split("@"); return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + d; };
export function requireVerified(user: UserRow) {
  const fresh = db.query("SELECT email_verified FROM users WHERE id = ?").get(user.id) as { email_verified: number };
  if (!fresh?.email_verified) throw new AuthError("Confirme seu e-mail para continuar (menu da conta).", 403);
}

// ---- e-mail: confirmação, reenvio, troca e recuperação de PIN ----
export async function verifyEmail(user: UserRow, input: any) {
  consumeCode(user, "verify", input?.code);
  db.run("UPDATE users SET email_verified = 1 WHERE id = ?", [user.id]);
  return { ok: true };
}
export async function resendVerification(user: UserRow) {
  const fresh = db.query("SELECT email, email_verified, code_expires FROM users WHERE id = ?").get(user.id) as any;
  if (!fresh?.email) throw new AuthError("Cadastre um e-mail primeiro.");
  if (fresh.email_verified) return { ok: true, already: true };
  const code = await issueCode(user.id, "verify");
  return { ok: true, ...(DEV_CODES ? { devCode: code } : {}) };
}
export async function setEmail(user: UserRow, input: any) {
  const email = normalizeEmail(input?.email);
  const other = db.query("SELECT id FROM users WHERE email = ? AND id != ?").get(email, user.id);
  if (other) throw new AuthError("Este e-mail já está em outra conta.", 409);
  db.run("UPDATE users SET email = ?, email_verified = 0 WHERE id = ?", [email, user.id]);
  const code = await issueCode(user.id, "verify");
  return { ok: true, ...(DEV_CODES ? { devCode: code } : {}) };
}
export async function forgotPin(input: any) {
  const { key } = normalizeNick(input?.nick);
  const row = db.query("SELECT * FROM users WHERE nick = ?").get(key) as UserRow | null;
  // Resposta igual com ou sem conta, para não revelar apelidos.
  let devCode: string | undefined;
  if (row && row.email && !row.blocked) devCode = await issueCode(row.id, "reset");
  return { ok: true, ...(DEV_CODES && devCode ? { devCode } : {}) };
}
export async function resetPin(input: any) {
  const { key } = normalizeNick(input?.nick);
  const row = db.query("SELECT * FROM users WHERE nick = ?").get(key) as UserRow | null;
  if (!row) throw new AuthError("Código incorreto.", 401);
  consumeCode(row, "reset", input?.code);
  const pin = normalizePin(input?.pin);
  const hash = await Bun.password.hash(pin, { algorithm: "argon2id", memoryCost: 19456, timeCost: 2 });
  db.run("UPDATE users SET pin_hash = ?, email_verified = 1 WHERE id = ?", [hash, row.id]);
  db.run("DELETE FROM sessions WHERE user_id = ?", [row.id]);
  failures.delete(key);
  return { ok: true };
}
function safeJSON(s: string) { try { return JSON.parse(s || "{}"); } catch { return {}; } }

/// Gasta favores da conta de forma atômica; devolve o saldo novo ou lança se não houver saldo.
export function spendFavores(user: UserRow, n: unknown) {
  const qty = Math.floor(Number(n));
  if (!(qty >= 1 && qty <= 10)) throw new AuthError("Quantidade inválida.");
  const r = db.run("UPDATE users SET favores = favores - ? WHERE id = ? AND favores >= ?", [qty, user.id, qty]);
  if (r.changes === 0) throw new AuthError("Você não tem favores suficientes.", 402);
  return (db.query("SELECT favores FROM users WHERE id = ?").get(user.id) as { favores: number }).favores;
}

export function entitlementsOf(userId: number) {
  const rows = db.query("SELECT product_id FROM entitlements WHERE user_id = ?").all(userId) as { product_id: string }[];
  return rows.map((r) => r.product_id);
}

// Progresso (finais, conquistas, recorde): o servidor guarda a união com o que já tinha.
export function mergeProgress(user: UserRow, incoming: any) {
  const cur = safeJSON(user.progress);
  const next: any = { ends: { ...(cur.ends || {}) }, ach: [...new Set([...(cur.ach || []), ...((incoming?.ach as string[]) || []).filter((a) => typeof a === "string").slice(0, 50)])], best: Math.max(cur.best || 0, Number(incoming?.best) || 0) };
  for (const [k, v] of Object.entries(incoming?.ends || {})) if (/^[a-z]{3,16}$/.test(k)) next.ends[k] = Math.max(next.ends[k] || 0, Math.min(10_000, Number(v) || 0));
  db.run("UPDATE users SET progress = ? WHERE id = ?", [JSON.stringify(next), user.id]);
  return next;
}

// Resultado do desafio diário: só o primeiro do dia conta.
export function submitDaily(user: UserRow, input: any) {
  const day = String(input?.day || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AuthError("Dia inválido.");
  const days = Math.max(1, Math.min(5000, Number(input?.days) || 0));
  const turns = Math.max(0, Math.min(500, Number(input?.turns) || 0));
  const ending = String(input?.ending || "");
  if (!/^[a-z]{3,16}$/.test(ending)) throw new AuthError("Final inválido.");
  db.run("INSERT OR IGNORE INTO results (user_id, day, days, turns, ending, created_at) VALUES (?, ?, ?, ?, ?, ?)", [user.id, day, days, turns, ending, now()]);
  return leaderboard(day, user.id);
}

export function leaderboard(day: string, userId?: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AuthError("Dia inválido.");
  const top = db.query("SELECT u.nick_display AS nick, r.days, r.ending, r.turns, EXISTS(SELECT 1 FROM entitlements e WHERE e.user_id = u.id AND e.product_id = 'com.saldozero.vip') AS vip FROM results r JOIN users u ON u.id = r.user_id WHERE r.day = ? ORDER BY r.days DESC, r.turns ASC, r.created_at ASC LIMIT 50").all(day) as any[];
  const total = (db.query("SELECT COUNT(*) AS n FROM results WHERE day = ?").get(day) as { n: number }).n;
  let me: any = null;
  if (userId) {
    const mine = db.query("SELECT days, turns, ending, created_at FROM results WHERE day = ? AND user_id = ?").get(day, userId) as any;
    if (mine) {
      const better = (db.query("SELECT COUNT(*) AS n FROM results WHERE day = ? AND (days > ? OR (days = ? AND turns < ?) OR (days = ? AND turns = ? AND created_at < ?))").get(day, mine.days, mine.days, mine.turns, mine.days, mine.turns, mine.created_at) as { n: number }).n;
      me = { rank: better + 1, days: mine.days, ending: mine.ending, percentile: total > 1 ? Math.round((1 - better / (total - 1)) * 100) : 100 };
    }
  }
  return { day, total, top, me };
}

// ---- Suporte: chamados abertos pelo jogo ----
const SUBJECTS = new Set(["pagamento", "bug", "conta", "conteudo", "sugestao", "outro"]);
export function createTicket(user: UserRow | null, input: any) {
  const subject = String(input?.subject || "outro");
  if (!SUBJECTS.has(subject)) throw new AuthError("Assunto inválido.");
  const message = String(input?.message || "").trim();
  if (message.length < 10 || message.length > 2000) throw new AuthError("Escreva pelo menos 10 caracteres (máximo 2000).");
  const email = String(input?.email || "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AuthError("E-mail inválido.");
  if (!user && !email) throw new AuthError("Sem conta, informe um e-mail para receber a resposta.");
  const nick = user ? user.nick_display : String(input?.nick || "").trim().slice(0, 16);
  const r = db.run("INSERT INTO tickets (user_id, nick, email, subject, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [user?.id ?? null, nick || null, email || null, subject, message, now(), now()]);
  return { id: Number(r.lastInsertRowid) };
}
export function myTickets(user: UserRow) {
  return db.query("SELECT id, subject, message, status, reply, created_at, updated_at FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(user.id);
}
