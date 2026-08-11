import { useState, type FormEvent } from "react";
import type { DisplayConditions } from "../../domain/calibration";

export interface DisplaySetupProps {
  readonly onComplete: (conditions: DisplayConditions) => void;
  readonly initialConditions?: DisplayConditions;
  readonly mode?: "calibrate" | "review";
}

export function DisplaySetup({
  onComplete,
  initialConditions,
  mode = "calibrate",
}: DisplaySetupProps) {
  const [displayNickname, setDisplayNickname] = useState(
    initialConditions?.displayNickname ?? "",
  );
  const [brightnessDescription, setBrightnessDescription] = useState(
    initialConditions?.brightnessDescription ?? "",
  );
  const [nightShiftOff, setNightShiftOff] = useState(false);
  const [trueToneOff, setTrueToneOff] = useState(false);
  const [colorFiltersOff, setColorFiltersOff] = useState(false);
  const ready =
    displayNickname.trim() !== "" &&
    brightnessDescription.trim() !== "" &&
    nightShiftOff &&
    trueToneOff &&
    colorFiltersOff;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) {
      return;
    }

    onComplete({
      displayNickname: displayNickname.trim(),
      brightnessDescription: brightnessDescription.trim(),
      nightShiftOff,
      trueToneOff,
      colorFiltersOff,
      screenWidthPx: globalThis.screen?.width ?? 0,
      screenHeightPx: globalThis.screen?.height ?? 0,
      colorDepth: globalThis.screen?.colorDepth ?? 0,
      pixelRatio: globalThis.devicePixelRatio ?? 1,
      recordedAt: new Date().toISOString(),
    });
  }

  return (
    <main className="setup-page">
      <header className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          CM
        </span>
        <span>看见另一种颜色</span>
      </header>

      <section className="setup-intro" aria-labelledby="product-title">
        <p className="folio">
          {mode === "review"
            ? "显示环境复核 · 约 2 分钟"
            : "开始之前 · 约 8–12 分钟"}
        </p>
        <h1 id="product-title">Painter's Eye</h1>
        <p className="intro-lede">
          你眼中的世界，和别人一样吗？
          <br />
          在这里，你可以看到画家创作时看到的颜色。
        </p>
        <p className="boundary-note">
          色弱大多来自基因，我们没法治好你的眼睛。但我们可以通过一套色彩转换，让你瞥见色觉正常的人眼中的名画、花朵和世界。这不是医学治疗，而是一次看看「另一种颜色」的机会。
        </p>
      </section>

      <form className="setup-form" onSubmit={submit}>
        <div className="form-section">
          <p className="section-number">01</p>
          <div>
            <h2>记录这块屏幕</h2>
            <p>配置只适用于相同显示器与相近亮度。</p>
            <label className="field-label" htmlFor="display-nickname">
              显示器名称
            </label>
            <input
              id="display-nickname"
              value={displayNickname}
              onChange={(event) => setDisplayNickname(event.target.value)}
              placeholder="例如：书房显示器"
              autoComplete="off"
            />
            <label className="field-label" htmlFor="brightness-description">
              亮度记录
            </label>
            <input
              id="brightness-description"
              value={brightnessDescription}
              onChange={(event) => setBrightnessDescription(event.target.value)}
              placeholder="例如：系统亮度 50%"
              autoComplete="off"
            />
          </div>
        </div>

        <fieldset className="form-section display-checks">
          <legend className="sr-only">显示环境检查</legend>
          <p className="section-number">02</p>
          <div>
            <h2>固定显示环境</h2>
            <p>请在整个测试和看画期间保持这些设置。</p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={nightShiftOff}
                onChange={(event) => setNightShiftOff(event.target.checked)}
              />
              <span>Night Shift 或夜览已关闭</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={trueToneOff}
                onChange={(event) => setTrueToneOff(event.target.checked)}
              />
              <span>True Tone 或原彩已关闭</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={colorFiltersOff}
                onChange={(event) => setColorFiltersOff(event.target.checked)}
              />
              <span>护眼或色彩滤镜已关闭</span>
            </label>
          </div>
        </fieldset>

        <div className="setup-action">
          {mode !== "review" && (
            <p>
              接下来的色觉测试会花几分钟，请耐心作答。它不是为了考倒你，也不是要证明你「有问题」——而是为了摸清你眼睛的辨色特点：测得越准，之后的画面调整就越贴合你的眼睛，你就越接近画家眼中真实的世界。
            </p>
          )}
          <p>数据仅保存在当前浏览器中。</p>
          <button className="primary-button" type="submit" disabled={!ready}>
            {mode === "review" ? "开始短复核" : "开始测试"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </main>
  );
}
