import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DisplaySetup } from "./DisplaySetup";

describe("DisplaySetup", () => {
  it("requires a named, stable display environment before calibration", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<DisplaySetup onComplete={onComplete} />);

    const start = screen.getByRole("button", { name: "开始测试" });
    expect(start).toBeDisabled();

    await user.type(screen.getByLabelText("显示器名称"), "书房显示器");
    await user.type(screen.getByLabelText("亮度记录"), "系统亮度 50%");
    await user.click(screen.getByLabelText(/Night Shift.*已关闭/));
    await user.click(screen.getByLabelText(/True Tone.*已关闭/));
    await user.click(screen.getByLabelText(/护眼或色彩滤镜.*已关闭/));

    expect(start).toBeEnabled();
    await user.click(start);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        displayNickname: "书房显示器",
        brightnessDescription: "系统亮度 50%",
        nightShiftOff: true,
        trueToneOff: true,
        colorFiltersOff: true,
      }),
    );
  });
});
