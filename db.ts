// Banco local (SQLite via bun:sqlite). Em produção o arquivo fica num volume do Railway (DATA_DIR=/data).
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

const DIR = Bun.env.DATA_DIR || "./data";
mkdirSync(DIR, { recursive: true });
export const db = new Database(DIR + "/saldozero.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nick TEXT NOT NULL UNIQUE,            -- minúsculo, para unicidade
  nick_display TEXT NOT NULL,           -- como o jogador digitou
  pin_hash TEXT NOT NULL,
  progress TEXT NOT NULL DEFAULT '{}',  -- finais, conquistas, recorde (JSON)
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  payment_id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE TABLE IF NOT EXISTS entitlements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, payment_id)
);
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,                    -- AAAA-MM-DD do desafio diário
  days INTEGER NOT NULL,
  turns INTEGER NOT NULL,
  ending TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, day)
);
CREATE INDEX IF NOT EXISTS results_day ON results(day, days DESC);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nick TEXT,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',   -- aberto | respondido | fechado
  reply TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_status ON tickets(status, created_at DESC);
`);

// Migrações simples (colunas novas em bancos já existentes).
const cols = (table: string) => (db.query("PRAGMA table_info(" + table + ")").all() as { name: string }[]).map((c) => c.name);
if (!cols("users").includes("favores")) db.exec("ALTER TABLE users ADD COLUMN favores INTEGER NOT NULL DEFAULT 0");
if (!cols("users").includes("blocked")) db.exec("ALTER TABLE users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0");
if (!cols("users").includes("note")) db.exec("ALTER TABLE users ADD COLUMN note TEXT NOT NULL DEFAULT ''");
if (!cols("orders").includes("value")) db.exec("ALTER TABLE orders ADD COLUMN value REAL NOT NULL DEFAULT 0");
if (!cols("users").includes("email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
if (!cols("users").includes("email_verified")) db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
if (!cols("users").includes("code")) db.exec("ALTER TABLE users ADD COLUMN code TEXT; ALTER TABLE users ADD COLUMN code_kind TEXT; ALTER TABLE users ADD COLUMN code_expires INTEGER NOT NULL DEFAULT 0; ALTER TABLE users ADD COLUMN code_attempts INTEGER NOT NULL DEFAULT 0");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email) WHERE email IS NOT NULL");

export const now = () => Date.now();
