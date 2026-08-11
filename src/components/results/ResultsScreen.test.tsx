import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FittedBehavioralProfile } from "../../profile/fitProfile";
import type { ValidationMetrics } from "../../validation/metrics";
import { ResultsScreen } from "./ResultsScreen";

const metrics: ValidationMetrics = {
  byCondition: {
    original: {
      accuracy: 0.42,
      medianReactionTimeMs: 1200,
      controlAccuracy: 1,
    },
    generic: { accuracy: 0.58, medianReactionTimeMs: 1050, controlAccuracy: 1 },
    personalized: {
      accuracy: 0.81,
      medianReactionTimeMs: 850,
      controlAccuracy: 1,
    },
  },
  accuracyImprovement: 0.39,
  reactionTimeImprovementMs: 350,
  repeatConsistency: 0.9,
  confidence: "high",
  passed: true,
};

const profile: FittedBehavioralProfile = {
  deficiency: "deutan",
  severity: 0.7,
  recommendedStrength: 0.8,
  chromaGain: 0.5,
  lightnessGain: 0.01,
  confidence: 0.86,
  classification: "behavioral-personalization",
  thresholds: [
    {
      axis: "protan",
      delta: 0.04,
      reversalDeltas: [0.04],
      confidenceInterval: [0.03, 0.05],
    },
    {
      axis: "deutan",
      delta: 0.1,
      reversalDeltas: [0.1],
      confidenceInterval: [0.09, 0.11],
    },
  ],
};

describe("ResultsScreen", () => {
  it("shows the simple verdict first and reveals details on demand", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <ResultsScreen
        metrics={metrics}
        profile={profile}
        onContinue={onContinue}
      />,
    );

    // Simple view: the two key numbers and the primary action are visible.
    expect(screen.getByText("42%")).toBeVisible();
    expect(screen.getByText("81%")).toBeVisible();
    expect(screen.queryByText("结果可靠度")).not.toBeInTheDocument();

    // Detailed view unfolds on request.
    await user.click(screen.getByRole("button", { name: "查看详细数据" }));
    expect(screen.getByText("结果可靠度")).toBeVisible();
    expect(screen.getByText("86%")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "保存配置，开始欣赏名画" }),
    );
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("prioritizes a quick validation retry when validation fails", async () => {
    const user = userEvent.setup();
    const onRetryValidation = vi.fn();
    const onRecalibrate = vi.fn();
    render(
      <ResultsScreen
        metrics={{ ...metrics, passed: false }}
        profile={profile}
        onContinue={vi.fn()}
        onRecalibrate={onRecalibrate}
        onRetryValidation={onRetryValidation}
      />,
    );

    expect(screen.getByText("建议重新测一次")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "重新验证（约 2 分钟）" }),
    );
    expect(onRetryValidation).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "完整重新测试" }));
    expect(onRecalibrate).toHaveBeenCalledOnce();
  });
});
