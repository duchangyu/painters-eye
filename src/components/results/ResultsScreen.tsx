import { useState } from "react";
import type { FittedBehavioralProfile } from "../../profile/fitProfile";
import type { ValidationMetrics } from "../../validation/metrics";

export interface ResultsScreenProps {
  readonly metrics: ValidationMetrics;
  readonly profile: FittedBehavioralProfile;
  readonly onContinue: () => void;
  readonly onRecalibrate?: () => void;
  readonly onRetryValidation?: () => void;
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
  onRetryValidation,
}: ResultsScreenProps) {
  const [showDetails, setShowDetails] = useState(false);

  const protan = profile.thresholds.find((item) => item.axis === "protan");
  const deutan = profile.thresholds.find((item) => item.axis === "deutan");

  const original = metrics.byCondition.original;
  const personalized = metrics.byCondition.personalized;
  const generic = metrics.byCondition.generic;
  const controlDropped =
    personalized.controlAccuracy < original.controlAccuracy - 0.05;

  const failureReason = controlDropped
    ? "转换虽然让你答对了更多题，但有几道你本来能分清颜色的题答错了——这通常是手滑或状态波动。重新验证一次（约 2 分钟，不用重头来），通常就能通过。"
    : "这次专属转换带来的提升还不够明显。重新验证一次（约 2 分钟，不用重头来），拿到更稳定的结果后就能保存配置。";

  return (
    <main className="results-page">
      <header className="results-hero">
        <p className="folio">测试结果</p>
        <h1>{metrics.passed ? "测试通过" : "建议重新测一次"}</h1>
        <p>
          {metrics.passed
            ? "这套为你定制的转换已经生效，可以开始欣赏名画了。结果只代表你在这台显示器上的表现，不是医学诊断。"
            : "别担心，这不是你的问题——结果不稳定通常只是测试时的状态波动。"}
        </p>
      </header>

      {metrics.passed ? (
        <section className="simple-verdict" aria-label="测试结论">
          <div className="simple-comparison">
            <div>
              <span>看原图时答对</span>
              <strong>{percent(original.accuracy)}</strong>
            </div>
            <div className="simple-arrow" aria-hidden="true">
              →
            </div>
            <div className="simple-highlight">
              <span>用专属转换答对</span>
              <strong>{percent(personalized.accuracy)}</strong>
            </div>
          </div>
          <p className="simple-caption">
            同一组辨色题，转换之后你明显更容易分清颜色了。
          </p>
        </section>
      ) : (
        <section className="simple-verdict" aria-label="测试结论">
          <p className="simple-reason">{failureReason}</p>
        </section>
      )}

      <div className="simple-actions">
        {metrics.passed ? (
          <button className="primary-button" type="button" onClick={onContinue}>
            保存配置，开始欣赏名画
          </button>
        ) : (
          <>
            {onRetryValidation && (
              <button
                className="primary-button"
                type="button"
                onClick={onRetryValidation}
              >
                重新验证（约 2 分钟）
              </button>
            )}
            {onRecalibrate && (
              <button
                className={onRetryValidation ? "quiet-button" : "primary-button"}
                type="button"
                onClick={onRecalibrate}
              >
                完整重新测试
              </button>
            )}
            <button className="quiet-button" type="button" onClick={onContinue}>
              不保存配置，仅浏览原图
            </button>
          </>
        )}
        <button
          className="quiet-button details-toggle"
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((current) => !current)}
        >
          {showDetails ? "收起详细数据" : "查看详细数据"}
        </button>
      </div>

      {showDetails && (
        <div className="results-details">
          <p className="details-intro">
            你刚刚用同一组辨色题，分别看了三种显示方式。数字是答对率，越高说明那种显示方式下你越容易分清颜色。
          </p>

          <section
            className="result-scoreboard"
            aria-label="三种显示方式的对比"
          >
            <article>
              <span>原图（你平时看到的）</span>
              <strong>{percent(original.accuracy)}</strong>
              <small>{secondsPerAnswer(original.medianReactionTimeMs)}</small>
            </article>
            <article className="featured-score">
              <span>为你定制的转换</span>
              <strong>{percent(personalized.accuracy)}</strong>
              <small>
                {secondsPerAnswer(personalized.medianReactionTimeMs)}
              </small>
            </article>
            <article>
              <span>通用色盲转换</span>
              <strong>{percent(generic.accuracy)}</strong>
              <small>{secondsPerAnswer(generic.medianReactionTimeMs)}</small>
            </article>
          </section>

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
              <strong>{percent(personalized.controlAccuracy)}</strong>
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
        </div>
      )}
    </main>
  );
}
