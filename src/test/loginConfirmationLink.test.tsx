import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "@/pages/Login";

const auth = vi.hoisted(() => ({ resend: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ signIn: vi.fn(), isAuthenticated: false, isLoading: false }),
}));

function renderLoginAt(hash: string) {
  window.history.replaceState(null, "", `/login${hash}`);
  render(<MemoryRouter initialEntries={[`/login${hash}`]}><Login /></MemoryRouter>);
}

describe("confirmation link errors on the sign-in page", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("explains an expired or already-used confirmation link", () => {
    renderLoginAt("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(screen.getByRole("alert")).toHaveTextContent("This confirmation link has expired or was already used.");
    // The error is removed from the address bar so a refresh doesn't repeat it.
    expect(window.location.hash).toBe("");
  });

  it("sends a new confirmation email to the address entered", async () => {
    auth.resend.mockResolvedValue({ error: null });
    renderLoginAt("#error=access_denied&error_code=otp_expired");

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ceo@simpventive.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("A new confirmation email is on its way."));
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "ceo@simpventive.com",
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
  });

  it("shows nothing extra on a normal visit", () => {
    renderLoginAt("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend confirmation email" })).not.toBeInTheDocument();
  });
});
