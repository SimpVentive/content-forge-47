import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock("@/lib/edgeFunctions", () => ({ callEdgeFunction: vi.fn() }));

import { isCustomTrainerId, PORTRAIT_HEIGHT, PORTRAIT_WIDTH, UPLOAD_GUIDELINES, VOICE_MAX_SECONDS, VOICE_MIN_SECONDS } from "@/lib/customTrainers";
import { TrainerGrid } from "@/components/contentforge/TrainerGrid";
import { AVATAR_TRAINERS } from "@/lib/avatarTrainers";

describe("custom trainer ids", () => {
  it("recognises a uuid as a custom trainer and built-in names as not custom", () => {
    expect(isCustomTrainerId("3f2b8c1e-9a4d-4e7b-8c1f-0a1b2c3d4e5f")).toBe(true);
    for (const trainer of AVATAR_TRAINERS) expect(isCustomTrainerId(trainer.id)).toBe(false);
    expect(isCustomTrainerId(null)).toBe(false);
    expect(isCustomTrainerId("")).toBe(false);
  });
});

describe("custom trainer constants", () => {
  it("uses the built-in 2:3 portrait shape and a 1 to 3 minute voice range", () => {
    expect(PORTRAIT_WIDTH / PORTRAIT_HEIGHT).toBeCloseTo(2 / 3, 5);
    expect(VOICE_MIN_SECONDS).toBe(60);
    expect(VOICE_MAX_SECONDS).toBe(180);
    expect(UPLOAD_GUIDELINES.length).toBeGreaterThanOrEqual(4);
  });
});

describe("TrainerGrid", () => {
  it("shows the seven built-in trainers, the create card, and calls back when it is clicked", () => {
    const onCreate = vi.fn();
    const onSelect = vi.fn();
    render(
      <TrainerGrid
        selectedId="priya"
        onSelect={onSelect}
        customTrainers={[]}
        customPhotoUrls={{}}
        onCreateCustom={onCreate}
        avatarEnv={{}}
      />,
    );
    for (const trainer of AVATAR_TRAINERS) expect(screen.getByText(trainer.name)).toBeTruthy();
    fireEvent.click(screen.getByText("Use my own photo and voice"));
    expect(onCreate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Irina"));
    expect(onSelect).toHaveBeenCalledWith("irina");
    cleanup();
  });

  it("shows a custom trainer with its name and AI-generated label only when its voice is ready", () => {
    const base = { owner_user_id: "u", owner_org_id: null, photo_path: "p", voice_sample_path: "v", voice_error: null, created_at: "", deleted_at: null };
    render(
      <TrainerGrid
        selectedId=""
        onSelect={() => {}}
        customTrainers={[
          { ...base, id: "3f2b8c1e-9a4d-4e7b-8c1f-0a1b2c3d4e5f", name: "Dr Rao", voice_id: "vx", voice_status: "ready" },
          { ...base, id: "4f2b8c1e-9a4d-4e7b-8c1f-0a1b2c3d4e5f", name: "Anita", voice_id: null, voice_status: "processing" },
        ]}
        customPhotoUrls={{ "3f2b8c1e-9a4d-4e7b-8c1f-0a1b2c3d4e5f": "https://example.test/p.jpg" }}
        onCreateCustom={() => {}}
        avatarEnv={{}}
      />,
    );
    expect(screen.getByText("Dr Rao")).toBeTruthy();
    expect(screen.getByText("Option 1 · video · AI-generated")).toBeTruthy();
    expect(screen.getByText("Creating voice…")).toBeTruthy();
    cleanup();
  });

  it("keeps a trainer whose voice failed selectable, with a retry button", () => {
    const base = { owner_user_id: "u", owner_org_id: null, photo_path: "p", voice_sample_path: "v", voice_error: "boom", created_at: "", deleted_at: null };
    const onSelect = vi.fn();
    const onRetry = vi.fn();
    render(
      <TrainerGrid
        selectedId=""
        onSelect={onSelect}
        customTrainers={[{ ...base, id: "5f2b8c1e-9a4d-4e7b-8c1f-0a1b2c3d4e5f", name: "Mouli", voice_id: null, voice_status: "failed" }]}
        customPhotoUrls={{}}
        onCreateCustom={() => {}}
        onRetryVoice={onRetry}
        avatarEnv={{}}
      />,
    );
    fireEvent.click(screen.getByText("Mouli"));
    expect(onSelect).toHaveBeenCalledWith("5f2b8c1e-9a4d-4e7b-8c1f-0a1b2c3d4e5f");
    fireEvent.click(screen.getByText("Retry voice"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("offers Delete on a custom trainer card and passes the trainer to the handler", () => {
    const base = { owner_user_id: "u", owner_org_id: null, photo_path: "p", voice_sample_path: "v", voice_error: null, created_at: "", deleted_at: null };
    const onDelete = vi.fn();
    render(
      <TrainerGrid
        selectedId=""
        onSelect={() => {}}
        customTrainers={[{ ...base, id: "6f2b8c1e-9a4d-4e7b-8c1f-0a1b2c3d4e5f", name: "Asha", voice_id: "vx", voice_status: "ready" }]}
        customPhotoUrls={{}}
        onCreateCustom={() => {}}
        onDeleteTrainer={onDelete}
        avatarEnv={{}}
      />,
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0][0].name).toBe("Asha");
    cleanup();
  });
});
