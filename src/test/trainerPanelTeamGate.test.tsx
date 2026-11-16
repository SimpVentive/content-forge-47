import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

// The trainer panel shows nothing to a user who is not in a team. Its only team lookup is the team_members query.
const rows: Record<string, unknown[]> = {};

function chain(data: unknown[]) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "order", "limit"]) c[m] = () => c;
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return c;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => chain(rows[table] ?? [])),
    rpc: vi.fn(async () => ({ data: false, error: null })),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { supabase } from "@/lib/supabase";
import { TrainerVideoPanel } from "@/components/contentforge/TrainerVideoPanel";

beforeEach(() => {
  cleanup();
  for (const k of Object.keys(rows)) delete rows[k];
});

describe("TrainerVideoPanel team gate", () => {
  it("renders nothing for a user who is not in a team", async () => {
    rows.team_members = [];
    const { container } = render(<TrainerVideoPanel moduleTitle="Module 1" />);
    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith("team_members"));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(/not in a team/i)).toBeNull();
    expect(screen.queryByText("Trainer video")).toBeNull();
  });

  it("renders the panel for a user who is in a team", async () => {
    rows.team_members = [{ team_id: "team-1", role: "member" }];
    render(<TrainerVideoPanel moduleTitle="Module 1" />);
    await waitFor(() => expect(screen.getByText("Trainer video")).toBeTruthy());
    expect(screen.queryByText(/not in a team/i)).toBeNull();
  });
});
