import { useState, type FormEvent } from 'react'
import type { DisplayConditions } from '../../domain/calibration'

export interface DisplaySetupProps {
  readonly onComplete: (conditions: DisplayConditions) => void
}

export function DisplaySetup({ onComplete }: DisplaySetupProps) {
  const [displayNickname, setDisplayNickname] = useState('')
  const [brightnessDescription, setBrightnessDescription] = useState('')
  const [nightShiftOff, setNightShiftOff] = useState(false)
  const [trueToneOff, setTrueToneOff] = useState(false)
  const [colorFiltersOff, setColorFiltersOff] = useState(false)
  const ready =
    displayNickname.trim() !== '' &&
    brightnessDescription.trim() !== '' &&
    nightShiftOff &&
    trueToneOff &&
    colorFiltersOff

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready) {
      return
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
    })
  }

  return (
    <main className="setup-page">
      <header className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">CM</span>
        <span>个人色彩实验室</span>
      </header>

      <section className="setup-intro" aria-labelledby="product-title">
        <p className="folio">首次校准 · 约 10–15 分钟</p>
        <h1 id="product-title">Color Master</h1>
        <p className="intro-lede">
          在这台固定显示器上测量你的红绿色彩辨别能力，再生成可验证的个人增强。
        </p>
        <p className="boundary-note">
          这是行为个性化色彩工具，不提供医学诊断，也不声称复制他人的主观颜色体验。
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
            <p>请在整个校准和画作体验期间保持这些设置。</p>
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
          <p>数据仅保存在当前浏览器中。</p>
          <button className="primary-button" type="submit" disabled={!ready}>
            开始校准 <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </main>
  )
}
