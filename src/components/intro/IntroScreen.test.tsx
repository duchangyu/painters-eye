import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IntroScreen } from "./IntroScreen";

describe("IntroScreen", () => {
  it("explains the product and offers both entry paths", async () => {
    const user = userEvent.setup();
    const onStartQuick = vi.fn();
    const onStartPrecise = vi.fn();
    render(
      <IntroScreen onStartQuick={onStartQuick} onStartPrecise={onStartPrecise} />,
    );

    expect(
      screen.getByRole("heading", { name: "Painter's Eye" }),
    ).toBeVisible();
    expect(screen.getByText(/专为红绿色弱、色盲朋友设计/)).toBeVisible();
    expect(screen.getByText(/两步就好/)).toBeVisible();
    expect(screen.getByText(/它基于什么？/)).toBeVisible();
    expect(screen.getByText(/这不是医学诊断或治疗/)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /开始测试/ }),
    );
    expect(onStartQuick).toHaveBeenCalledOnce();
    expect(onStartPrecise).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /完整版测试/ }),
    );
    expect(onStartPrecise).toHaveBeenCalledOnce();
  });

  it("records that the user has seen the intro before starting", async () => {
    const user = userEvent.setup();
    const setItem = vi.fn();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem,
        removeItem: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    render(
      <IntroScreen onStartQuick={vi.fn()} onStartPrecise={vi.fn()} />,
    );

    await user.click(
      screen.getByRole("button", { name: /开始测试/ }),
    );
    expect(setItem).toHaveBeenCalledWith("painters-eye:seen-intro", "1");
  });
});
