import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IntroScreen } from "./IntroScreen";

describe("IntroScreen", () => {
  it("explains the product and starts setup when the user is ready", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<IntroScreen onStart={onStart} />);

    expect(
      screen.getByRole("heading", { name: "Painter's Eye" }),
    ).toBeVisible();
    expect(screen.getByText(/专为红绿色弱、色盲朋友设计/)).toBeVisible();
    expect(screen.getByText(/三步流程/)).toBeVisible();
    expect(screen.getByText(/它基于什么？/)).toBeVisible();
    expect(screen.getByText(/这不是医学诊断或治疗/)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /我了解了，开始设置/ }),
    );
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("records that the user has seen the intro before starting", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
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
    render(<IntroScreen onStart={onStart} />);

    await user.click(
      screen.getByRole("button", { name: /我了解了，开始设置/ }),
    );
    expect(setItem).toHaveBeenCalledWith("painters-eye:seen-intro", "1");
  });
});
