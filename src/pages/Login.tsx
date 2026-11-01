import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type LocationState = { from?: { pathname?: string } } | null;

// A saved "from" pointing into the admin console (left behind when a non-admin was bounced there)
// must not decide where a normal sign-in lands, so those fall back to the default.
const returnPathFor = (state: LocationState) => {
  const from = state?.from?.pathname;
  return from && !from.startsWith("/admin") ? from : "/new-course";
};

const Login = () => {
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set by the reset-password page after a successful change.
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [linkError, setLinkError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Supabase returns failed email links as #error=… in the URL; explain it instead of showing a blank sign-in page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (!params.get("error") && !params.get("error_code")) return;
    setLinkError(
      params.get("error_code") === "otp_expired"
        ? "This confirmation link has expired or was already used."
        : "This confirmation link could not be verified.",
    );
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const handleResend = async () => {
    setResendStatus(null);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setResendStatus(resendError ? resendError.message : "A new confirmation email is on its way. Check your spam folder too.");
  };

  // already signed in? bounce out
  if (!isLoading && isAuthenticated) {
    return <Navigate to={returnPathFor(location.state as LocationState)} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate(returnPathFor(location.state as LocationState), { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your ContentForge account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {linkError && (
              <div className="space-y-2">
                <p className="text-sm text-destructive" role="alert">
                  {linkError}
                </p>
                <Button type="button" variant="outline" className="w-full" disabled={!email} onClick={handleResend}>
                  Resend confirmation email
                </Button>
                <p className="text-xs text-muted-foreground">Enter your email above first.</p>
                {resendStatus && (
                  <p className="text-sm text-muted-foreground" role="status">
                    {resendStatus}
                  </p>
                )}
              </div>
            )}
            {notice && !error && (
              <p className="text-sm text-muted-foreground" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              No account?{" "}
              <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
