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
        <h1>{metrics.passed ? "可以看到正常视觉了" : "结果还不够稳定"}</h1>
        <p>这些结果描述当前显示器上的表现，不是医学诊断。</p>
      </header>

      <section className="result-scoreboard" aria-label="正确率比较">
        <article>
          <span>你看到的颜色</span>
          <strong>{percent(metrics.byCondition.original.accuracy)}</strong>
          <small>
            {metrics.byCondition.original.medianReactionTimeMs} ms 中位反应
          </small>
        </article>
        <article className="featured-score">
          <span>正常视觉模拟</span>
          <strong>{percent(metrics.byCondition.personalized.accuracy)}</strong>
          <small>
            {metrics.byCondition.personalized.medianReactionTimeMs} ms 中位反应
          </small>
        </article>
        <article>
          <span>通用转换</span>
          <strong>{percent(metrics.byCondition.generic.accuracy)}</strong>
          <small>
            {metrics.byCondition.generic.medianReactionTimeMs} ms 中位反应
          </small>
        </article>
      </section>

      <section className="measurement-ledger">
        <div>
          <span>红色分辨力</span>
          <strong>{protan?.delta.toFixed(3) ?? "—"}</strong>
        </div>
        <div>
          <span>绿色分辨力</span>
          <strong>{deutan?.delta.toFixed(3) ?? "—"}</strong>
        </div>
        <div>
          <span>测试稳定性</span>
          <strong>{percent(metrics.repeatConsistency)}</strong>
        </div>
        <div>
          <span>色彩平衡</span>
          <strong>
            {percent(metrics.byCondition.personalized.controlAccuracy)}
          </strong>
        </div>
        <div>
          <span>结果可靠度</span>
          <strong>{percent(profile.confidence)}</strong>
        </div>
      </section>

      <aside className="limitations-note">
        <h2>仍然不能代表什么</h2>
        <p>
          这不是复制正常人的主观视觉，而是一种帮你发现色彩关系的转换方式。配置仅适用于本次记录的显示器环境。
        </p>
      </aside>

      {!metrics.passed && (
        <p className="validation-failure-note" role="status">
          测试未通过，转换方案不会被保存。你可以仅浏览原图，或重新测试后再试一次。
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
