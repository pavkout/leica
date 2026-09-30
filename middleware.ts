// Vercel Routing Middleware: every request passes the sign-in gate first
// (src/auth/gate.ts). Credentials come from the project's environment
// variables AUTH_USERNAME and AUTH_PASSWORD; without them nothing is served.

import { next } from "@vercel/functions";
import { gate } from "./src/auth/gate";

export default async function middleware(request: Request): Promise<Response> {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  const result = await gate(request, env);
  if ("respond" in result) return result.respond;
  return next(result.setCookie ? { headers: { "set-cookie": result.setCookie } } : undefined);
}
