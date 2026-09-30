// Single-owner login (runs on the host, before any file is served). A session
// is a signed cookie: "v1.<expiry>.<signature>", the signature an HMAC-SHA256
// keyed from the owner's credentials. No database: changing the password
// signs everyone out. Web Crypto only, so it runs on Node and edge runtimes.

export const COOKIE = "__Host-rf_session";
/** A session lasts this long, renewed while in use. */
export const SESSION_S = 30 * 24 * 3600;
/** Renew once less than this is left. */
const RENEW_BELOW_S = 15 * 24 * 3600;

export interface Owner {
  username: string;
  password: string;
}

/** The owner from the host's environment; undefined when either is missing (the gate then stays shut). */
export function ownerFromEnv(env: Record<string, string | undefined>): Owner | undefined {
  const username = env.AUTH_USERNAME?.trim();
  const password = env.AUTH_PASSWORD;
  return username && password ? { username, password } : undefined;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

/** Equal strings in time that doesn't depend on where they differ: compares their HMACs under a throwaway key. */
async function sameString(a: string, b: string): Promise<boolean> {
  const key = b64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const [x, y] = await Promise.all([hmac(key, a), hmac(key, b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function checkCredentials(owner: Owner, username: string, password: string): Promise<boolean> {
  const [u, p] = await Promise.all([sameString(username.trim(), owner.username), sameString(password, owner.password)]);
  return u && p;
}

const signingKey = (owner: Owner) => `rangefinder-session:${owner.username}:${owner.password}`;

export async function issueSession(owner: Owner, nowS: number): Promise<string> {
  const payload = `v1.${nowS + SESSION_S}`;
  return `${payload}.${await hmac(signingKey(owner), payload)}`;
}

/** "valid", "renew" (valid, but due a fresh cookie) or "invalid". */
export async function checkSession(owner: Owner, token: string | undefined, nowS: number): Promise<"valid" | "renew" | "invalid"> {
  const m = /^(v1\.(\d{1,12}))\.([\w-]{43})$/.exec(token ?? "");
  if (!m) return "invalid";
  const exp = Number(m[2]);
  if (exp <= nowS) return "invalid";
  if (!(await sameString(m[3], await hmac(signingKey(owner), m[1])))) return "invalid";
  return exp - nowS < RENEW_BELOW_S ? "renew" : "valid";
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_S}; HttpOnly; Secure; SameSite=Lax`;
}

export const CLEAR_COOKIE = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

/** Where to go after logging in: a same-site path only (never "//host" or a full URL), and never the login pages themselves. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/^\/(login|logout)(\/|\?|$)/.test(next)) return "/";
  return next;
}

/** The app's hash route ("#/museum/display") carried through the login, or "". */
export function safeHash(hash: string | null | undefined): string {
  // A tool may carry a query (#/shoot/walks?w=…, #/collect/health?item=…); still no quotes, spaces or line breaks.
  return hash && /^#\/[\w\-./%]*(\?[\w\-.%=&]*)?$/.test(hash) && hash.length <= 2000 ? hash : "";
}
