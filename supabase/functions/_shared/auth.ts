import type { User } from "npm:@supabase/supabase-js@2";
import { adminClient, userClient } from "./supabase.ts";

export type AuthedContext = {
  user: User;
  role: "user" | "admin";
};

// Validates the bearer token in Authorization header. Returns the auth user
// + their profile role. Throws AuthError on missing/invalid token.
export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const getAuthedUser = async (req: Request): Promise<AuthedContext> => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError(401, "Missing bearer token");
  }

  const { data, error } = await userClient(req).auth.getUser();
  if (error || !data.user) {
    throw new AuthError(401, "Invalid or expired token");
  }

  // Look up role via service-role client (bypasses RLS).
  const admin = adminClient();
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileErr) throw new AuthError(500, "Failed to load profile");
  const role = (profile?.role === "admin" ? "admin" : "user") as "user" | "admin";

  return { user: data.user, role };
};

export const requireAdmin = async (req: Request): Promise<AuthedContext> => {
  const ctx = await getAuthedUser(req);
  if (ctx.role !== "admin") {
    throw new AuthError(403, "Admin role required");
  }
  return ctx;
};
