import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { CourseParametersDialog } from "@/components/contentforge/CourseParametersDialog";

function renderDialog(estimatedMinutes: number | null) {
  const onConfirm = vi.fn();
  render(
    <CourseParametersDialog
      open
      courseTitle="Duration Check"
      estimatedMinutes={estimatedMinutes}
      onConfirm={onConfirm}
      onCancel={() => {}}
    />,
  );
  return onConfirm;
}

describe("course duration check before launch", () => {
  it("stops and asks when the source is far longer than the selected duration", () => {
    const onConfirm = renderDialog(55);
    fireEvent.click(screen.getByRole("button", { name: "Launch Course" }));
    expect(screen.getByText("Duration Mismatch")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Keep my selected duration/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].duration).toBe("15min");
    cleanup();
  });

  it("uses the source duration when the learner chooses it", () => {
    const onConfirm = renderDialog(55);
    fireEvent.click(screen.getByRole("button", { name: "Launch Course" }));
    fireEvent.click(screen.getByRole("button", { name: /Use source narration duration/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].duration).toBe("60min");
    cleanup();
  });

  it("launches straight away when the source is close to the selected duration", () => {
    const onConfirm = renderDialog(16);
    fireEvent.click(screen.getByRole("button", { name: "Launch Course" }));
    expect(screen.queryByText("Duration Mismatch")).not.toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("launches straight away when no source duration is known", () => {
    const onConfirm = renderDialog(null);
    fireEvent.click(screen.getByRole("button", { name: "Launch Course" }));
    expect(screen.queryByText("Duration Mismatch")).not.toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
