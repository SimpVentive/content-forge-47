import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

const unsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
});

describe("forgot password request", () => {
  it("sends the reset email with a redirect back to the reset page and confirms without revealing the account", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " ceo@simpventive.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("If an account exists for ceo@simpventive.com"));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("ceo@simpventive.com", {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    cleanup();
  });

  it("shows the error when the reset email cannot be sent", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { message: "Email rate limit exceeded" } });
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ceo@simpventive.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email rate limit exceeded");
    cleanup();
  });
});

function renderReset() {
  render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("reset password page", () => {
  it("tells the user the link is invalid when there is no recovery session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    renderReset();
    expect(await screen.findByText("This reset link is invalid or has already been used.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute("href", "/forgot-password");
    cleanup();
  });

  it("refuses passwords that are too short or do not match", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });
    renderReset();
    await screen.findByLabelText("New password");

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use at least 6 characters.");

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "secret1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "secret2" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The two passwords don't match.");

    expect(auth.updateUser).not.toHaveBeenCalled();
    cleanup();
  });

  it("saves the new password, signs out, and sends the user to sign in", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    renderReset();
    await screen.findByLabelText("New password");

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "secret1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "secret1" });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
