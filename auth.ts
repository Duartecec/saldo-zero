// Login de jogo: apelido único + PIN de 4 a 8 dígitos. Sem e-mail, sem senha longa.
// O servidor devolve um token guardado no navegador; o mesmo apelido entra em qualquer aparelho.
import { db, now } from "./db";

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

export type UserRow = { id: number; nick: string; nick_display: string; pin_hash: string; progress: string; created_at: number; last_seen: number; favores: number; blocked: number; note: string };

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
  const hash = await Bun.password.hash(pin, { algorithm: "argon2id", memoryCost: 19456, timeCost: 2 });
  try {
    db.run("INSERT INTO users (nick, nick_display, pin_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?)", [key, display, hash, now(), now()]);
  } catch {
    throw new AuthError("Esse apelido acabou de ser escolhido por outra pessoa.", 409);
  }
  const created = db.query("SELECT * FROM users WHERE nick = ?").get(key) as UserRow;
  return { token: await newSession(created.id), user: publicUser(created), created: true };
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
  const fav = (db.query("SELECT favores FROM users WHERE id = ?").get(row.id) as { favores: number } | null)?.favores ?? 0;
  return { id: row.id, nick: row.nick_display, createdAt: row.created_at, progress: safeJSON(row.progress), favores: fav };
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
  const top = db.query("SELECT u.nick_display AS nick, r.days, r.ending, r.turns FROM results r JOIN users u ON u.id = r.user_id WHERE r.day = ? ORDER BY r.days DESC, r.turns ASC, r.created_at ASC LIMIT 50").all(day) as any[];
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
