import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const auth = vi.hoisted(() => ({
  value: {
    user: { id: "u1" },
    profile: null,
    isAdmin: false,
    isAuthenticated: true,
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  } as Record<string, unknown>,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value, AuthProvider: ({ children }: { children: unknown }) => children }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, from: vi.fn() } }));

// Whole-app check: the real route table, signed in, at the root address.
describe("root address for a signed-in visitor (full app routes)", () => {
  it("stays on / and shows the home page", async () => {
    window.history.pushState({}, "", "/");
    const { default: App } = await import("@/App");
    render(<App />);
    // The whole app loads lazily, so the first render can take longer than the default wait.
    expect(await screen.findByTestId("home-page", {}, { timeout: 8000 })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });
});
