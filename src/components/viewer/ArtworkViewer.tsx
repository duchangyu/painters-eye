import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Lut3D } from "../../color/lut";
import type { ArtworkRecord } from "../../data/artworks";
import { renderImageWithCpu } from "../../rendering/cpuRenderer";
import {
  createWebglArtworkRenderer,
  type WebGlArtworkRenderer,
} from "../../rendering/webglRenderer";

/**
 * The viewer's display mode. AppFlow keeps the latest copy and hands it back
 * as `initialDisplay` on the next artwork, so switching paintings never
 * resets how the user prefers to look at them.
 */
export interface ViewerDisplayState {
  readonly enhanced: boolean;
  readonly strength: number;
  readonly split: boolean;
  readonly zoom: number;
}

export interface ArtworkViewerProps {
  readonly artwork: ArtworkRecord;
  readonly lut: Lut3D;
  readonly recommendedStrength: number;
  readonly initialDisplay: ViewerDisplayState;
  readonly onDisplayChange: (display: ViewerDisplayState) => void;
  readonly onBack: () => void;
  readonly onPrevious: (() => void) | null;
  readonly onNext: (() => void) | null;
}

type RendererStatus = "waiting" | "webgl" | "cpu" | "error";

function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("button, input, select, textarea, a, [contenteditable]") !==
      null
  );
}

export function ArtworkViewer({
  artwork,
  lut,
  recommendedStrength,
  initialDisplay,
  onDisplayChange,
  onBack,
  onPrevious,
  onNext,
}: ArtworkViewerProps) {
  const pageRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const cpuCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGlArtworkRenderer | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [enhanced, setEnhanced] = useState(initialDisplay.enhanced);
  const [strength, setStrength] = useState(initialDisplay.strength);
  const [peeking, setPeeking] = useState(false);
  const [split, setSplit] = useState(initialDisplay.split);
  const [zoom, setZoom] = useState(initialDisplay.zoom);
  const [showInterpretation, setShowInterpretation] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rendererStatus, setRendererStatus] =
    useState<RendererStatus>("waiting");

  // Keep the parent informed so the next artwork opens with the same setup.
  useEffect(() => {
    onDisplayChange({ enhanced, strength, split, zoom });
  }, [enhanced, strength, split, zoom, onDisplayChange]);

  useEffect(() => {
    return () => {
      // Read the ref at cleanup time: capturing it in the closure would
      // dispose the renderer that existed at setup (often null) and leak
      // the current WebGL context.
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [artwork.id, lut]);

  useEffect(() => {
    let cancelled = false;
    const report = (status: RendererStatus) => {
      queueMicrotask(() => {
        if (!cancelled) {
          setRendererStatus(status);
        }
      });
    };
    const image = imageRef.current;
    const webglCanvas = webglCanvasRef.current;
    const cpuCanvas = cpuCanvasRef.current;
    if (!imageReady || !image || !webglCanvas || !cpuCanvas) {
      return () => {
        cancelled = true;
      };
    }
    try {
      const renderer =
        rendererRef.current ?? createWebglArtworkRenderer(webglCanvas, lut);
      rendererRef.current = renderer;
      renderer.render(image, strength / 100);
      report("webgl");
    } catch {
      try {
        renderImageWithCpu(cpuCanvas, image, lut, strength / 100);
        report("cpu");
      } catch {
        report("error");
      }
    }
    return () => {
      cancelled = true;
    };
  }, [imageReady, lut, strength]);

  function toggleEnhancement() {
    if (enhanced) {
      setEnhanced(false);
      return;
    }
    // Reuse the strength the user last settled on; fall back to the
    // recommendation the first time enhancement is switched on.
    setStrength((current) =>
      current > 0
        ? current
        : Math.round(Math.min(1, Math.max(0, recommendedStrength)) * 100),
    );
    setEnhanced(true);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await pageRef.current?.requestFullscreen();
      }
    } catch {
      // Fullscreen unsupported (e.g. embedded iframe); the button is a
      // convenience, not a requirement.
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement !== null);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Gallery-style navigation shortcuts. Space-to-peek has its own effect
  // below; both share the isInteractive guard so typing never triggers them.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.repeat || isInteractive(event.target)) return;
      if (event.code === "ArrowLeft" && onPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.code === "ArrowRight" && onNext) {
        event.preventDefault();
        onNext();
      } else if (event.code === "KeyF") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.code === "Escape") {
        // Real browsers usually consume Escape to leave fullscreen before
        // the page sees it; when they don't (or in embedded contexts) we
        // exit explicitly. Outside fullscreen, Escape returns to the gallery.
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          onBack();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPrevious, onNext, onBack]);

  // Space-to-peek must work no matter where focus rests (most commonly the
  // "看到画家眼中的颜色" button the user just clicked), without stealing Space from
  // interactive controls.
  useEffect(() => {
    if (!enhanced) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (
        event.code !== "Space" ||
        event.repeat ||
        isInteractive(event.target)
      ) {
        return;
      }
      event.preventDefault();
      setPeeking(true);
    }
    function onKeyUp(event: globalThis.KeyboardEvent) {
      if (event.code !== "Space" || isInteractive(event.target)) return;
      setPeeking(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enhanced]);

  const renderFailed = enhanced && rendererStatus === "error";
  const showOriginal = !enhanced || peeking || strength === 0 || renderFailed;
  const statusLabel = renderFailed
    ? "转换渲染失败，显示原图"
    : peeking
      ? "按住查看原图"
      : enhanced
        ? "正常视觉模拟"
        : "你看到的原图";
  const stageStyle = {
    "--artwork-zoom": String(zoom),
    "--artwork-width": `${zoom * 100}%`,
  } as CSSProperties;

  return (
    <main className="viewer-page" ref={pageRef}>
      <header className="viewer-header">
        <button
          className="text-button"
          type="button"
          aria-label="返回画廊"
          onClick={onBack}
        >
          ← 返回画廊
        </button>
        <div>
          <p className="folio">
            观察台{artwork.date ? ` · ${artwork.date}` : ""}
          </p>
          <h1>{artwork.titleZh}</h1>
          <p>{artwork.artist}</p>
        </div>
        <div className="viewer-chrome">
          <button
            className="text-button"
            type="button"
            aria-label={isFullscreen ? "退出全屏" : "全屏欣赏"}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? "退出全屏" : "全屏"}
          </button>
          <div className="viewer-status" aria-live="polite">
            <span
              className={
                enhanced && !peeking ? "status-dot active" : "status-dot"
              }
            />
            {statusLabel}
          </div>
        </div>
      </header>

      <section className="viewer-workbench">
        <div className="stage-shell">
          {onPrevious && (
            <button
              className="stage-nav stage-prev"
              type="button"
              aria-label="上一张"
              onClick={onPrevious}
            >
              ‹
            </button>
          )}
          {onNext && (
            <button
              className="stage-nav stage-next"
              type="button"
              aria-label="下一张"
              onClick={onNext}
            >
              ›
            </button>
          )}
          <div
            className={`artwork-stage ${split ? "split" : ""}`}
            data-testid="artwork-stage"
            data-layout={split ? "split" : "single"}
            style={stageStyle}
            tabIndex={0}
            onPointerDown={() => enhanced && setPeeking(true)}
            onPointerUp={() => setPeeking(false)}
            onPointerCancel={() => setPeeking(false)}
            onPointerLeave={() => setPeeking(false)}
            aria-label="画作比较区；开启正常视觉模拟后按住空格查看原图"
          >
          {split && (
            <figure className="viewer-panel original-panel">
              <img src={artwork.imagePath} alt={`${artwork.titleZh}原图`} />
              <figcaption>你看到的原图</figcaption>
            </figure>
          )}
          <figure className="viewer-panel">
            <img
              ref={imageRef}
              className={
                showOriginal ? "viewer-source active" : "viewer-source"
              }
              src={artwork.imagePath}
              alt={artwork.titleZh}
              onLoad={() => setImageReady(true)}
            />
            <canvas
              ref={webglCanvasRef}
              className={
                !showOriginal && rendererStatus === "webgl"
                  ? "viewer-output active"
                  : "viewer-output"
              }
              aria-label={`${artwork.titleZh}正常视觉模拟图像`}
            />
            <canvas
              ref={cpuCanvasRef}
              className={
                !showOriginal && rendererStatus === "cpu"
                  ? "viewer-output active"
                  : "viewer-output"
              }
              aria-label={`${artwork.titleZh}正常视觉模拟图像（兼容模式）`}
            />
            {renderFailed && (
              <div className="render-warning" role="status">
                当前浏览器无法渲染正常视觉模拟图像，已保留原图。
              </div>
            )}
            {split && <figcaption>{statusLabel}</figcaption>}
          </figure>
          </div>
        </div>

        <aside className="viewer-controls" aria-label="查看器控制">
          <div className="control-primary">
            <span>01 · 显示方式</span>
            <button
              className="primary-button"
              type="button"
              onClick={(event) => {
                toggleEnhancement();
                // Move focus off the button so the next Space press peeks at
                // the original instead of re-activating this button.
                event.currentTarget.blur();
              }}
            >
              {enhanced ? "返回原图" : "看到画家眼中的颜色"}
            </button>
            <small>不会修改原始文件，随时可以按住画面或空格键对照。</small>
          </div>

          <label className="strength-control">
            <span>02 · 转换强度</span>
            <strong>{strength}%</strong>
            <input
              type="range"
              min="0"
              max="100"
              value={strength}
              aria-label="转换强度"
              disabled={!enhanced}
              onChange={(event) => setStrength(Number(event.target.value))}
            />
            <small>测试建议 {Math.round(recommendedStrength * 100)}%</small>
          </label>

          <div className="view-control-group">
            <span>03 · 画面</span>
            <div>
              <button
                className="quiet-button"
                type="button"
                aria-label="缩小"
                disabled={zoom <= 1}
                onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
              >
                −
              </button>
              <output>{Math.round(zoom * 100)}%</output>
              <button
                className="quiet-button"
                type="button"
                aria-label="放大"
                disabled={zoom >= 2}
                onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
              >
                +
              </button>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => setSplit((value) => !value)}
            >
              {split ? "单幅查看" : "并排比较"}
            </button>
          </div>

          {artwork.interpretation !== "" && (
            <div className="interpretation-control">
              <span>04 · 作品线索</span>
              <button
                className="text-button"
                type="button"
                aria-expanded={showInterpretation}
                onClick={() => setShowInterpretation((value) => !value)}
              >
                {showInterpretation ? "收起色彩解读" : "展开色彩解读"}
              </button>
              {showInterpretation && <p>{artwork.interpretation}</p>}
            </div>
          )}

          <p className="shortcut-hint">
            ← → 切换 · 空格看原图 · F 全屏 · Esc 返回
          </p>

          <p className="renderer-note">
            {rendererStatus === "cpu"
              ? "正在使用 CPU 兼容渲染。"
              : "图像仅在本机浏览器中处理。"}
          </p>
        </aside>
      </section>
    </main>
  );
}
