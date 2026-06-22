import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthError, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  accountType: "individual" | "organization";
  organizationName?: string;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (input: SignUpInput) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("Failed to load profile:", error);
      setProfile(null);
      return;
    }
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
      if (mounted) setIsLoading(false);
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        // defer to avoid running another supabase call inside the callback
        setTimeout(() => {
          if (mounted) void loadProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      setUser(data.user);
      await loadProfile(data.user.id);
    }
    return { error };
  };

  const signUp: AuthContextValue["signUp"] = async ({ email, password, fullName, accountType, organizationName }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          account_type: accountType,
          organization_name: organizationName ?? null,
        },
      },
    });
    return { error };
  };

  const signOut: AuthContextValue["signOut"] = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile: AuthContextValue["refreshProfile"] = async () => {
    if (user) await loadProfile(user.id);
  };

  const value: AuthContextValue = {
    user,
    profile,
    isAdmin: profile?.role === "admin",
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
