import { corsHeaders } from "./cors.ts";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

export const ok = <T>(data: T) => json({ ok: true, data }, 200);

export const badRequest = (message: string, details?: unknown) =>
  json({ ok: false, error: { code: "bad_request", message, details } }, 400);

export const unauthorized = (message = "Unauthorized") =>
  json({ ok: false, error: { code: "unauthorized", message } }, 401);

export const forbidden = (message = "Forbidden") =>
  json({ ok: false, error: { code: "forbidden", message } }, 403);

export const notFound = (message = "Not found") =>
  json({ ok: false, error: { code: "not_found", message } }, 404);

export const conflict = (message: string) =>
  json({ ok: false, error: { code: "conflict", message } }, 409);

export const serverError = (message: string, details?: unknown) =>
  json({ ok: false, error: { code: "server_error", message, details } }, 500);
