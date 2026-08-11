export interface IntroScreenProps {
  readonly onStart: () => void;
}

export function IntroScreen({ onStart }: IntroScreenProps) {
  return (
    <main className="setup-page">
      <header className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          PE
        </span>
        <span>看见另一种颜色</span>
      </header>

      <section className="setup-intro" aria-labelledby="product-title">
        <p className="folio"> painter's eye · 世界名画预览</p>
        <h1 id="product-title">Painter's Eye</h1>
        <p className="intro-lede">
          看见画家创作时看到的颜色。
          <br />
          专为红绿色弱、色盲朋友设计。
        </p>
      </section>

      <div className="setup-form">
        <div className="form-section">
          <p className="section-number">01</p>
          <div>
            <h2>这会做什么？</h2>
            <p>
              色觉异常大多来自基因，我们治不好你的眼睛，但可以通过一套基于科学的色彩转换，让你在世界名画中看到更多平时容易错过的红绿关系。
            </p>
            <p>
              这不是复制「正常人眼中的主观颜色」，而是一种帮你发现色彩关系的替代编码。
            </p>
          </div>
        </div>

        <div className="form-section">
          <p className="section-number">02</p>
          <div>
            <h2>三步流程</h2>
            <ul className="intro-steps">
              <li>
                <strong>记录显示环境</strong>
                <span>约 2 分钟：屏幕名称、亮度，关闭 Night Shift 等色彩处理。</span>
              </li>
              <li>
                <strong>色彩分辨测试</strong>
                <span>
                  约 8–12
                  分钟：辨认开口方向，测出你在这块屏幕上的辨色阈值。没有对错，越放松越准。
                </span>
              </li>
              <li>
                <strong>浏览世界名画</strong>
                <span>先看原图，再切换到正常视觉模拟，比较你平时看到的和画家可能看到的。</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="form-section">
          <p className="section-number">03</p>
          <div>
            <h2>它基于什么？</h2>
            <p>
              应用在浏览器里测量你的行为辨色阈值，结合色觉异常模拟与 OKLab
              色貌空间，把容易混淆的红绿信息重新编码到你更敏感的通道。
            </p>
            <p>
              所有回答、配置和画作选择都只保存在当前浏览器中；你随时可以在「配置与备份」中导出或删除。
            </p>
          </div>
        </div>

        <div className="form-section">
          <p className="section-number">04</p>
          <div>
            <h2>请先有合理预期</h2>
            <ul className="intro-expectations">
              <li>这不是医学诊断或治疗。</li>
              <li>效果只在同一台显示器、相近亮度和色彩设置下稳定。</li>
              <li>认真、快速地作答，结果才可靠。</li>
            </ul>
          </div>
        </div>

        <div className="setup-action">
          <p>整个过程约 8–12 分钟。</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              globalThis.localStorage?.setItem("painters-eye:seen-intro", "1");
              onStart();
            }}
          >
            我了解了，开始设置 <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}
