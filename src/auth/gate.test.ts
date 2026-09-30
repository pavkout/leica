import { describe, expect, it, vi } from "vitest";
import { gate, type GateResult } from "./gate";
import { COOKIE, SESSION_S, checkSession, issueSession, safeHash, safeNext } from "./session";

const env = { AUTH_USERNAME: "owner", AUTH_PASSWORD: "correct horse battery staple" };
const owner = { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD };
const NOW = 1_800_000_000;
const BASE = "https://rangefinder.example";

const page = (path: string, cookie?: string) =>
  new Request(BASE + path, { headers: { accept: "text/html", "sec-fetch-mode": "navigate", ...(cookie ? { cookie } : {}) } });
const asset = (path: string, cookie?: string) => new Request(BASE + path, { headers: { accept: "*/*", ...(cookie ? { cookie } : {}) } });
const login = (fields: Record<string, string>) => new Request(BASE + "/login", { method: "POST", body: new URLSearchParams(fields) });

const response = (r: GateResult) => {
  if (!("respond" in r)) throw new Error("expected a response, got pass");
  return r.respond;
};
const cookieOf = (res: Response) => /__Host-rf_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1];

describe("sign-in gate", () => {
  it("sends a visitor without a session to the login page, keeping where they were going", async () => {
    const res = response(await gate(page("/?museum=display"), env, NOW));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/login?next=%2F%3Fmuseum%3Ddisplay");
  });

  it("serves no app file without a session", async () => {
    const res = response(await gate(asset("/assets/index-abc123.js"), env, NOW));
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("<script");
  });

  it("shows the login form", async () => {
    const res = response(await gate(page("/login?next=%2Fx"), env, NOW));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('name="password"');
    expect(body).toContain('value="/x"');
    expect(body).not.toContain(env.AUTH_PASSWORD);
  });

  it("signs in with the right credentials and returns to the page, hash route included", async () => {
    const res = response(await gate(login({ username: " owner ", password: env.AUTH_PASSWORD, next: "/?museum=display", hash: "#/museum/display" }), env, NOW));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?museum=display#/museum/display");
    const set = res.headers.get("set-cookie")!;
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/Secure/);
    expect(set).toMatch(/SameSite=Lax/);
    const token = cookieOf(res)!;
    expect(await gate(page("/", `${COOKIE}=${token}`), env, NOW)).toEqual({ pass: true });
    expect(await gate(asset("/assets/app.js", `other=1; ${COOKIE}=${token}`), env, NOW)).toEqual({ pass: true });
  });

  it("refuses a wrong password, after a pause", async () => {
    vi.useFakeTimers();
    const pending = gate(login({ username: "owner", password: "wrong", next: "/" }), env, NOW);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    const res = response(await pending);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).toContain("don&#39;t match");
  });

  it("rejects forged, tampered and expired sessions", async () => {
    const token = await issueSession(owner, NOW);
    const [v, exp, sig] = token.split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(await checkSession(owner, `${v}.${exp}.${flipped}`, NOW)).toBe("invalid");
    expect(await checkSession(owner, `${v}.${Number(exp) + 999}.${sig}`, NOW)).toBe("invalid");
    expect(await checkSession(owner, token, NOW + SESSION_S)).toBe("invalid");
    expect(await checkSession({ ...owner, password: "changed" }, token, NOW)).toBe("invalid");
    expect(await checkSession(owner, "garbage", NOW)).toBe("invalid");
    expect(await checkSession(owner, undefined, NOW)).toBe("invalid");
  });

  it("renews a session in use once it's past halfway", async () => {
    const token = await issueSession(owner, NOW);
    const later = NOW + SESSION_S - 3600;
    const r = await gate(page("/", `${COOKIE}=${token}`), env, later);
    expect("pass" in r && r.setCookie).toMatch(/__Host-rf_session=v1\./);
  });

  it("signs out", async () => {
    const res = response(await gate(page("/logout"), env, NOW));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/login");
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("stays shut when the credentials aren't configured", async () => {
    expect(response(await gate(page("/"), {}, NOW)).status).toBe(303);
    expect(response(await gate(page("/login"), { AUTH_USERNAME: "owner" }, NOW)).status).toBe(503);
    const res = response(await gate(login({ username: "", password: "" }), {}, NOW));
    expect(res.status).toBe(503);
  });

  it("only redirects within the site after login", () => {
    expect(safeNext("/?museum=display")).toBe("/?museum=display");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/login")).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeHash("#/museum/display")).toBe("#/museum/display");
    expect(safeHash("#/x\"><script>")).toBe("");
    expect(safeHash("javascript:alert(1)")).toBe("");
  });
});
