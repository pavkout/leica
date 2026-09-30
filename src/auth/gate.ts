// The gate in front of every request (Vercel Routing Middleware, see
// /middleware.ts). Signed in: the request goes through. Not signed in: pages
// redirect to /login, everything else is 401, so none of the app is served.

import { loginPage } from "./loginPage.js";
import { CLEAR_COOKIE, COOKIE, checkCredentials, checkSession, issueSession, ownerFromEnv, readCookie, safeHash, safeNext, sessionCookie } from "./session.js";

/** What the gate decided: answer with this response, or let the request through (optionally setting a renewed cookie). */
export type GateResult = { respond: Response } | { pass: true; setCookie?: string };

/** Public without a session: the login page's own icon. */
const OPEN = new Set(["/favicon.svg"]);

const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", ...headers },
  });

const redirect = (location: string, cookie?: string) =>
  new Response(null, { status: 303, headers: { location, "cache-control": "no-store", ...(cookie ? { "set-cookie": cookie } : {}) } });

/** Pause after a wrong password, to slow guessing. */
const FAIL_DELAY_MS = 600;

export async function gate(request: Request, env: Record<string, string | undefined>, nowS = Math.floor(Date.now() / 1000)): Promise<GateResult> {
  const url = new URL(request.url);
  const path = url.pathname;
  const owner = ownerFromEnv(env);

  if (path === "/logout") return { respond: redirect("/login", CLEAR_COOKIE) };

  if (path === "/login") {
    if (!owner) return { respond: html(loginPage({ next: "/", configured: false }), 503) };
    if (request.method === "POST") {
      const form = await request.formData().catch(() => undefined);
      const field = (k: string) => (typeof form?.get(k) === "string" ? (form.get(k) as string) : "");
      const next = safeNext(field("next"));
      if (await checkCredentials(owner, field("username"), field("password"))) {
        return { respond: redirect(next + safeHash(field("hash")), sessionCookie(await issueSession(owner, nowS))) };
      }
      await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
      return { respond: html(loginPage({ next, error: "That username and password don't match.", configured: true }), 401) };
    }
    return { respond: html(loginPage({ next: safeNext(url.searchParams.get("next")), configured: true })) };
  }

  if (OPEN.has(path)) return { pass: true };

  const state = owner ? await checkSession(owner, readCookie(request.headers.get("cookie"), COOKIE), nowS) : "invalid";
  if (state === "valid") return { pass: true };
  if (state === "renew" && owner) return { pass: true, setCookie: sessionCookie(await issueSession(owner, nowS)) };

  const wantsPage = request.method === "GET" && (request.headers.get("sec-fetch-mode") === "navigate" || (request.headers.get("accept") ?? "").includes("text/html"));
  if (wantsPage) return { respond: redirect(`/login?next=${encodeURIComponent(path + url.search)}`) };
  return { respond: new Response("Sign in required.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }) };
}
