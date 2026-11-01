import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

// Matches the minimum enforced at sign-up.
const MIN_PASSWORD_LENGTH = 6;

type Status = "checking" | "ready" | "invalid";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The reset link signs the user in with a recovery session. Without one, the link was already used or has expired.
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session) setStatus("ready");
      else if (mounted) setStatus("invalid");
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (mounted && event === "PASSWORD_RECOVERY") setStatus("ready");
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }
    // Sign out so the user confirms the new password on the sign-in page.
    await supabase.auth.signOut();
    setSubmitting(false);
    navigate("/login", { replace: true, state: { notice: "Password updated. Sign in with your new password." } });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            {status === "invalid" ? "This reset link is invalid or has already been used." : "Enter a new password for your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "checking" && <p className="text-sm text-muted-foreground">Checking your link…</p>}
          {status === "invalid" && (
            <p className="text-sm">
              <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
                Request a new reset link
              </Link>
            </p>
          )}
          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving…" : "Set new password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
