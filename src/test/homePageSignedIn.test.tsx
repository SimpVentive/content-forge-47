import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import HomePage from "@/pages/home/HomePage";

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

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));

function Where() {
  return <p data-testid="pathname">{useLocation().pathname}</p>;
}

describe("home page for a signed-in visitor", () => {
  it("stays on the home page at the root address instead of redirecting to the dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<p>Dashboard</p>} />
        </Routes>
        <Where />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/");
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("offers a way into the app from the hero", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomePage />
      </MemoryRouter>,
    );
    const link = screen.getAllByRole("link", { name: "Go to My Courses" })[0];
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});
