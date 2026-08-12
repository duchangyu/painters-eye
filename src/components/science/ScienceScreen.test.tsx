import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScienceScreen } from "./ScienceScreen";

describe("ScienceScreen", () => {
  it("explains the four-stage pipeline in plain language", () => {
    render(<ScienceScreen onBack={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "这套转换是怎么算出来的？" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "先测量，再转换" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "模拟你眼中的颜色" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "把丢失的信息换个通道" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "参数不是拍的" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "实时渲染到画面" }),
    ).toBeVisible();
    expect(screen.getByText(/不等于医学诊断/)).toBeVisible();
  });

  it("keeps technical details collapsed until the reader asks", async () => {
    const user = userEvent.setup();
    render(<ScienceScreen onBack={vi.fn()} />);

    const summaries = screen.getAllByText(/^技术细节：/);
    expect(summaries).toHaveLength(5);
    for (const summary of summaries) {
      const details = summary.closest("details");
      expect(details).not.toBeNull();
      expect(details).not.toHaveAttribute("open");
    }

    await user.click(screen.getByText("技术细节：Machado 矩阵"));
    const machado = screen
      .getByText("技术细节：Machado 矩阵")
      .closest("details");
    expect(machado).toHaveAttribute("open");
    expect(screen.getByText(/线性\s*sRGB/)).toBeInTheDocument();
  });

  it("returns via the back button", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<ScienceScreen onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: /返回/ }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
