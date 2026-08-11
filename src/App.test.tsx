import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("explains the product boundary", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Painter's Eye" }),
    ).toBeVisible();
    expect(screen.getByText(/不是医学诊断/)).toBeVisible();
  });
});
