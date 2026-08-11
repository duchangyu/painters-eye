import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { generateLut } from "../../color/lut";
import { ARTWORKS } from "../../data/artworks";
import { ArtworkViewer } from "./ArtworkViewer";

describe("ArtworkViewer", () => {
  function renderViewer(overrides: Partial<Parameters<typeof ArtworkViewer>[0]> = {}) {
    const props = {
      artwork: ARTWORKS[0]!,
      lut: generateLut(2, (color) => color),
      recommendedStrength: 0.72,
      initialDisplay: { enhanced: false, strength: 0, split: false, zoom: 1 },
      onDisplayChange: vi.fn(),
      onBack: vi.fn(),
      onPrevious: null,
      onNext: null,
      ...overrides,
    };
    render(<ArtworkViewer {...props} />);
    return props;
  }

  it("opens on the original and enables the recommendation explicitly", async () => {
    const user = userEvent.setup();
    renderViewer();

    expect(screen.getByText("你看到的原图")).toBeVisible();
    expect(screen.getByRole("slider", { name: "转换强度" })).toHaveValue("0");
    await user.click(
      screen.getByRole("button", { name: "看到画家眼中的颜色" }),
    );
    expect(screen.getByText("正常视觉模拟")).toBeVisible();
    expect(screen.getByRole("slider", { name: "转换强度" })).toHaveValue("72");
  });

  it("temporarily reveals the original while pointer or Space is held", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.click(
      screen.getByRole("button", { name: "看到画家眼中的颜色" }),
    );
    const stage = screen.getByTestId("artwork-stage");

    fireEvent.pointerDown(stage);
    expect(screen.getByText("按住查看原图")).toBeVisible();
    fireEvent.pointerUp(stage);
    expect(screen.getByText("正常视觉模拟")).toBeVisible();

    stage.focus();
    fireEvent.keyDown(stage, { code: "Space" });
    expect(screen.getByText("按住查看原图")).toBeVisible();
    fireEvent.keyUp(stage, { code: "Space" });
    expect(screen.getByText("正常视觉模拟")).toBeVisible();
  });

  it("changes strength and zoom, supports comparison, and gates interpretation", async () => {
    const user = userEvent.setup();
    const { onBack } = renderViewer();

    expect(screen.queryByText(/梵高有意让红与绿/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "展开色彩解读" }));
    expect(screen.getByText(/梵高有意让红与绿/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "并排比较" }));
    expect(screen.getByTestId("artwork-stage")).toHaveAttribute(
      "data-layout",
      "split",
    );
    await user.click(screen.getByRole("button", { name: "放大" }));
    expect(screen.getByTestId("artwork-stage")).toHaveStyle({
      "--artwork-zoom": "1.25",
    });
    await user.click(screen.getByRole("button", { name: "返回画廊" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("navigates with edge buttons and arrow keys, and closes with Escape", async () => {
    const user = userEvent.setup();
    const props = renderViewer({
      onPrevious: vi.fn(),
      onNext: vi.fn(),
    });

    await user.click(screen.getByRole("button", { name: "上一张" }));
    expect(props.onPrevious).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "下一张" }));
    expect(props.onNext).toHaveBeenCalledOnce();

    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(props.onNext).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { code: "ArrowLeft" });
    expect(props.onPrevious).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { code: "Escape" });
    expect(props.onBack).toHaveBeenCalledOnce();
  });

  it("hides navigation buttons at the list ends and shows shortcut hints", () => {
    renderViewer();
    expect(
      screen.queryByRole("button", { name: "上一张" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "下一张" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/← → 切换 · 空格看原图 · F 全屏 · Esc 返回/)).toBeVisible();
  });

  it("hides the interpretation section for user images without one", () => {
    renderViewer({
      artwork: { ...ARTWORKS[0]!, interpretation: "" },
    });
    expect(
      screen.queryByRole("button", { name: "展开色彩解读" }),
    ).not.toBeInTheDocument();
  });

  it("opens with a previously chosen display mode and reports changes", async () => {
    const user = userEvent.setup();
    const props = renderViewer({
      initialDisplay: { enhanced: true, strength: 65, split: true, zoom: 1.5 },
    });

    // The carried-over state is applied without any user action.
    // (split mode shows the status label twice: header + panel caption)
    expect(screen.getAllByText("正常视觉模拟").length).toBeGreaterThan(0);
    expect(screen.getByRole("slider", { name: "转换强度" })).toHaveValue("65");
    expect(screen.getByTestId("artwork-stage")).toHaveAttribute(
      "data-layout",
      "split",
    );
    expect(props.onDisplayChange).toHaveBeenCalledWith({
      enhanced: true,
      strength: 65,
      split: true,
      zoom: 1.5,
    });

    // Re-enabling after a manual strength choice keeps that strength.
    await user.click(screen.getByRole("button", { name: "返回原图" }));
    await user.click(
      screen.getByRole("button", { name: "看到画家眼中的颜色" }),
    );
    expect(screen.getByRole("slider", { name: "转换强度" })).toHaveValue("65");
  });
});
