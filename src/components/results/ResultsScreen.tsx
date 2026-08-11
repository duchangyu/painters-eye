import type { FittedBehavioralProfile } from "../../profile/fitProfile";
import type { ValidationMetrics } from "../../validation/metrics";

export interface ResultsScreenProps {
  readonly metrics: ValidationMetrics;
  readonly profile: FittedBehavioralProfile;
  readonly onContinue: () => void;
  readonly onRecalibrate?: () => void;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function secondsPerAnswer(medianMs: number): string {
  return `答对一题约 ${(medianMs / 1000).toFixed(1)} 秒`;
}

export function ResultsScreen({
  metrics,
  profile,
  onContinue,
  onRecalibrate,
}: ResultsScreenProps) {
  const protan = profile.thresholds.find((item) => item.axis === "protan");
  const deutan = profile.thresholds.find((item) => item.axis === "deutan");

  return (
    <main className="results-page">
      <header className="results-hero">
        <p className="folio">测试结果</p>
        <h1>{metrics.passed ? "专属转换对你有效" : "这次测试还不够稳定"}</h1>
        <p>
          你刚刚用同一组辨色题，分别看了三种显示方式。结果只代表你在这台显示器上的表现，不是医学诊断。
        </p>
      </header>

      <section className="result-scoreboard" aria-label="三种显示方式的对比">
        <article>
          <span>原图（你平时看到的）</span>
          <strong>{percent(metrics.byCondition.original.accuracy)}</strong>
          <small>
            {secondsPerAnswer(metrics.byCondition.original.medianReactionTimeMs)}
          </small>
        </article>
        <article className="featured-score">
          <span>为你定制的转换</span>
          <strong>{percent(metrics.byCondition.personalized.accuracy)}</strong>
          <small>
            {secondsPerAnswer(
              metrics.byCondition.personalized.medianReactionTimeMs,
            )}
          </small>
        </article>
        <article>
          <span>通用色盲转换</span>
          <strong>{percent(metrics.byCondition.generic.accuracy)}</strong>
          <small>
            {secondsPerAnswer(metrics.byCondition.generic.medianReactionTimeMs)}
          </small>
        </article>
      </section>
      <p className="scoreboard-caption">
        数字是辨色题的答对率，越高说明那种显示方式下你越容易分清颜色。
      </p>

      <section className="measurement-ledger" aria-label="详细数据">
        <div>
          <span>红色分辨力</span>
          <strong>{protan?.delta.toFixed(3) ?? "—"}</strong>
          <small>你能分辨的最小红色差别，数字越小越敏锐</small>
        </div>
        <div>
          <span>绿色分辨力</span>
          <strong>{deutan?.delta.toFixed(3) ?? "—"}</strong>
          <small>你能分辨的最小绿色差别，数字越小越敏锐</small>
        </div>
        <div>
          <span>测试稳定性</span>
          <strong>{percent(metrics.repeatConsistency)}</strong>
          <small>同一个颜色重复出现时，你答案的一致程度</small>
        </div>
        <div>
          <span>副作用检查</span>
          <strong>
            {percent(metrics.byCondition.personalized.controlAccuracy)}
          </strong>
          <small>转换后，蓝黄等其他颜色你依然分得清</small>
        </div>
        <div>
          <span>结果可靠度</span>
          <strong>{percent(profile.confidence)}</strong>
          <small>系统对这套为你定制的配置有多大把握</small>
        </div>
      </section>

      <aside className="limitations-note">
        <h2>这个配置能做什么、不能做什么</h2>
        <p>
          它不能让你看到“正常人眼中的颜色”——任何转换都做不到这一点。它做的是把你容易混淆的颜色拉开差距，让你更容易分辨。配置只适用于这台显示器和当前的环境光，换了显示器建议重新测试。
        </p>
      </aside>

      {!metrics.passed && (
        <p className="validation-failure-note" role="status">
          这次的结果不够稳定，配置不会被保存。你可以重新测一次，或者只看原图。
        </p>
      )}
      <button className="primary-button" type="button" onClick={onContinue}>
        {metrics.passed ? "保存配置并继续" : "不保存配置，仅浏览原图"}
      </button>
      {!metrics.passed && onRecalibrate && (
        <button className="quiet-button" type="button" onClick={onRecalibrate}>
          重新测试
        </button>
      )}
    </main>
  );
}
