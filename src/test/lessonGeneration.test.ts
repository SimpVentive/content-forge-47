import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentPipeline } from "@/hooks/useAgentPipeline";
import { AGENTS } from "@/types/agents";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/lib/edgeFunctions", () => ({ logApiUsage: vi.fn().mockResolvedValue(undefined) }));
beforeEach(() => invoke.mockReset());
const disabled = Object.fromEntries(AGENTS.map(agent => [agent.id, false]));

describe("mandatory lesson generation", () => {
  it("runs the writer even if an old setting disabled it", async () => {
    invoke.mockResolvedValue({ data: { text: "# Camera Selection\n\nChoose an NVR for IP cameras. Keep a DVR when upgrading existing coaxial installations." }, error: null });
    const { result } = renderHook(() => useAgentPipeline());
    await act(async () => { await result.current.runPipeline("Camera Selection", "Choose a recorder for the existing cameras.", disabled, { duration: "3" }); });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.current.rawOutputs.writer).toContain("Choose an NVR");
  });
  it("stops before assessment and packaging when the writer returns nothing", async () => {
    invoke.mockResolvedValue({ data: { text: "" }, error: null });
    const { result } = renderHook(() => useAgentPipeline());
    await act(async () => { await result.current.runPipeline("Camera Selection", "Choose a recorder.", { ...disabled, assessment: true, assembly: true }, { duration: "3" }); });
    await waitFor(() => expect(result.current.isRunning).toBe(false));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.current.rawOutputs.assessment).toBe("");
    expect(result.current.rawOutputs.assembly).toBe("");
    expect(result.current.agents.find(agent => agent.id === "assembly")?.status).toBe("error");
    expect(result.current.logs.join(" ")).toContain("Lesson content is missing");
  });
});