import type { ScreeningOutcome } from "../../calibration/screening";
import { findPreset } from "../../color/presets";

export interface ScreeningResultProps {
  readonly outcome: ScreeningOutcome;
  readonly onEnterGallery: () => void;
  readonly onStartPrecise: () => void;
  readonly onRetry: () => void;
}

/**
 * Fast-track verdict. The copy stays deliberately hedged: 8 trials produce
 * an approximate routing, not a measurement — the precise calibration is
 * always offered as the upgrade.
 */
export function ScreeningResult({
  outcome,
  onEnterGallery,
  onStartPrecise,
  onRetry,
}: ScreeningResultProps) {
  if (outcome.kind === "unreliable") {
    return (
      <main className="results-page">
        <header className="results-hero">
          <p className="folio">快速体验</p>
          <h1>刚才的回答不太稳定</h1>
          <p>
            两道基础题都答错了——这通常说明屏幕的夜览、原彩或护眼滤镜还开着，或者环境光太复杂。关掉系统的色彩处理后再试一次，结果就稳定了。
          </p>
        </header>
        <div className="simple-actions">
          <button className="primary-button" type="button" onClick={onRetry}>
            重新测一次
          </button>
          <button className="quiet-button" type="button" onClick={onStartPrecise}>
            改做个性化精准测试
          </button>
        </div>
      </main>
    );
  }

  if (outcome.kind === "normal-vision") {
    return (
      <main className="results-page">
        <header className="results-hero">
          <p className="folio">快速体验</p>
          <h1>你的红绿分辨看起来不错</h1>
          <p>
            从刚才几道题看，你分辨红绿的能力和大多数人差不多，暂时不需要画面增强。可以直接去画廊看原图——也可以把这些画分享给需要的朋友。
          </p>
        </header>
        <div className="simple-actions">
          <button className="primary-button" type="button" onClick={onEnterGallery}>
            去画廊看画
          </button>
          <button className="quiet-button" type="button" onClick={onStartPrecise}>
            仍然想做完整测试
          </button>
        </div>
      </main>
    );
  }

  const preset = findPreset(outcome.presetId);
  const label = preset?.labelZh ?? "红绿色弱";

  return (
    <main className="results-page">
      <header className="results-hero">
        <p className="folio">快速体验</p>
        <h1>可能是「{label}」</h1>
        <p>
          这是 8
          道题的近似判断，不是医学诊断，也不如完整测试准确。接下来画廊会用对应的通用预设帮你增强画面，让你更容易分清红绿关系。
        </p>
      </header>

      <section className="simple-verdict" aria-label="近似模式说明">
        <p className="simple-caption">
          通用预设对色盲档的朋友效果最接近；对色弱的朋友，每个人的程度不同，增强可能偏强或偏弱——想要最贴合你的效果，可以随时做个性化精准测试。
        </p>
      </section>

      <div className="simple-actions">
        <button className="primary-button" type="button" onClick={onEnterGallery}>
          去画廊看画
        </button>
        <button className="quiet-button" type="button" onClick={onStartPrecise}>
          做个性化精准测试（约 10–15 分钟，更准）
        </button>
      </div>
    </main>
  );
}
