// POST /send-email
// Body: { to: string, template: 'welcome'|'credit_purchase'|'low_credits'|'custom',
//         params?: object, subject?: string, html?: string }
// Auth: Bearer token. Accepts either:
//   - admin user JWT (role='admin') — for admin-initiated sends
//   - service-role key — for system-triggered sends from other functions
//
// Uses Resend's REST API. RESEND_API_KEY must be set; EMAIL_FROM is the
// from-address (e.g. "ContentForge <hello@contentforge.app>").

import { handlePreflight } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, forbidden, serverError, methodNotAllowed } from "../_shared/responses.ts";
import { getAuthedUser, AuthError } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "ContentForge <noreply@contentforge.app>";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

type Template = "welcome" | "credit_purchase" | "low_credits" | "custom";

type Body = {
  to?: string;
  template?: Template;
  params?: Record<string, string | number>;
  subject?: string;
  html?: string;
};

const isServiceRoleCaller = (req: Request): boolean => {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7) === SERVICE_ROLE_KEY;
};

const renderTemplate = (template: Template, params: Record<string, string | number> = {}): {
  subject: string;
  html: string;
} => {
  switch (template) {
    case "welcome":
      return {
        subject: "Welcome to ContentForge",
        html: `<p>Hi ${params.full_name ?? "there"},</p>
<p>Welcome to ContentForge. Your account is ready — head over to <a href="${params.app_url ?? "https://contentforge.app"}/forge">the forge</a> to publish your first course.</p>
<p>— Team ContentForge</p>`,
      };
    case "credit_purchase":
      return {
        subject: `Receipt — ${params.credits ?? 0} credits added`,
        html: `<p>Hi ${params.full_name ?? "there"},</p>
<p>We've credited <strong>${params.credits ?? 0}</strong> credits to your account.</p>
<p>Order: <code>${params.order_id ?? "—"}</code><br/>
Amount: ₹${params.amount_inr ? Number(params.amount_inr).toLocaleString("en-IN") : "—"}</p>
<p>A GST invoice will be emailed within 24 hours.</p>`,
      };
    case "low_credits":
      return {
        subject: "You're running low on credits",
        html: `<p>Hi ${params.full_name ?? "there"},</p>
<p>Your ContentForge balance is down to <strong>${params.balance ?? 0}</strong> credits. Top up to keep your courses generating.</p>
<p><a href="${params.app_url ?? "https://contentforge.app"}/#pricing">Buy credits →</a></p>`,
      };
    case "custom":
      return { subject: "", html: "" };
  }
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return methodNotAllowed("POST");
  if (!RESEND_API_KEY) return serverError("RESEND_API_KEY not configured");

  // Allow either an admin JWT or the service-role key (for inter-function calls).
  const isService = isServiceRoleCaller(req);
  if (!isService) {
    try {
      const ctx = await getAuthedUser(req);
      if (ctx.role !== "admin") return forbidden("Admin role required");
    } catch (e) {
      if (e instanceof AuthError) return e.status === 403 ? forbidden(e.message) : unauthorized(e.message);
      return serverError("Auth failure");
    }
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const to = body.to?.trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return badRequest("Valid `to` required");

  let subject: string;
  let html: string;
  if (body.template === "custom") {
    if (!body.subject || !body.html) return badRequest("custom template requires subject and html");
    subject = body.subject;
    html = body.html;
  } else if (body.template) {
    const rendered = renderTemplate(body.template, body.params ?? {});
    subject = body.subject ?? rendered.subject;
    html = body.html ?? rendered.html;
  } else {
    return badRequest("template required");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return serverError("Resend API error", { status: res.status, detail });
  }
  const sent = await res.json() as { id?: string };
  return ok({ message_id: sent.id ?? null });
});
