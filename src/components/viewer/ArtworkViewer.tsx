import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import type { Lut3D } from '../../color/lut'
import type { ArtworkRecord } from '../../data/artworks'
import { renderImageWithCpu } from '../../rendering/cpuRenderer'
import {
  createWebglArtworkRenderer,
  type WebGlArtworkRenderer,
} from '../../rendering/webglRenderer'

export interface ArtworkViewerProps {
  readonly artwork: ArtworkRecord
  readonly lut: Lut3D
  readonly recommendedStrength: number
  readonly onBack: () => void
}

type RendererStatus = 'waiting' | 'webgl' | 'cpu' | 'error'

export function ArtworkViewer({
  artwork,
  lut,
  recommendedStrength,
  onBack,
}: ArtworkViewerProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const webglCanvasRef = useRef<HTMLCanvasElement>(null)
  const cpuCanvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGlArtworkRenderer | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const [enhanced, setEnhanced] = useState(false)
  const [strength, setStrength] = useState(0)
  const [peeking, setPeeking] = useState(false)
  const [split, setSplit] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [showInterpretation, setShowInterpretation] = useState(false)
  const [rendererStatus, setRendererStatus] =
    useState<RendererStatus>('waiting')

  useEffect(() => {
    const renderer = rendererRef.current
    return () => {
      renderer?.dispose()
      rendererRef.current = null
    }
  }, [artwork.id, lut])

  useEffect(() => {
    let cancelled = false
    const report = (status: RendererStatus) => {
      queueMicrotask(() => {
        if (!cancelled) {
          setRendererStatus(status)
        }
      })
    }
    const image = imageRef.current
    const webglCanvas = webglCanvasRef.current
    const cpuCanvas = cpuCanvasRef.current
    if (!imageReady || !image || !webglCanvas || !cpuCanvas) {
      return () => {
        cancelled = true
      }
    }
    try {
      const renderer =
        rendererRef.current ?? createWebglArtworkRenderer(webglCanvas, lut)
      rendererRef.current = renderer
      renderer.render(image, strength / 100)
      report('webgl')
    } catch {
      try {
        renderImageWithCpu(cpuCanvas, image, lut, strength / 100)
        report('cpu')
      } catch {
        report('error')
      }
    }
    return () => {
      cancelled = true
    }
  }, [imageReady, lut, strength])

  function toggleEnhancement() {
    if (enhanced) {
      setEnhanced(false)
      return
    }
    setStrength(Math.round(Math.min(1, Math.max(0, recommendedStrength)) * 100))
    setEnhanced(true)
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.code !== 'Space' || !enhanced) {
      return
    }
    event.preventDefault()
    setPeeking(event.type === 'keydown')
  }

  const showOriginal = !enhanced || peeking || strength === 0
  const statusLabel = peeking
    ? '按住查看原图'
    : enhanced
      ? '个人增强'
      : '原始数字图像'
  const stageStyle = {
    '--artwork-zoom': String(zoom),
    '--artwork-width': `${zoom * 100}%`,
  } as CSSProperties

  return (
    <main className="viewer-page">
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
          <p className="folio">观察台 · {artwork.date}</p>
          <h1>{artwork.titleZh}</h1>
          <p>{artwork.artist}</p>
        </div>
        <div className="viewer-status" aria-live="polite">
          <span className={enhanced && !peeking ? 'status-dot active' : 'status-dot'} />
          {statusLabel}
        </div>
      </header>

      <section className="viewer-workbench">
        <div
          className={`artwork-stage ${split ? 'split' : ''}`}
          data-testid="artwork-stage"
          data-layout={split ? 'split' : 'single'}
          style={stageStyle}
          tabIndex={0}
          onPointerDown={() => enhanced && setPeeking(true)}
          onPointerUp={() => setPeeking(false)}
          onPointerCancel={() => setPeeking(false)}
          onPointerLeave={() => setPeeking(false)}
          onKeyDown={handleKeyboard}
          onKeyUp={handleKeyboard}
          aria-label="画作比较区；开启增强后按住空格查看原图"
        >
          {split && (
            <figure className="viewer-panel original-panel">
              <img src={artwork.imagePath} alt={`${artwork.titleZh}原始数字图像`} />
              <figcaption>原始数字图像</figcaption>
            </figure>
          )}
          <figure className="viewer-panel">
            <img
              ref={imageRef}
              className={showOriginal ? 'viewer-source active' : 'viewer-source'}
              src={artwork.imagePath}
              alt={artwork.titleZh}
              onLoad={() => setImageReady(true)}
            />
            <canvas
              ref={webglCanvasRef}
              className={
                !showOriginal && rendererStatus === 'webgl'
                  ? 'viewer-output active'
                  : 'viewer-output'
              }
              aria-label={`${artwork.titleZh}个人增强图像`}
            />
            <canvas
              ref={cpuCanvasRef}
              className={
                !showOriginal && rendererStatus === 'cpu'
                  ? 'viewer-output active'
                  : 'viewer-output'
              }
              aria-label={`${artwork.titleZh}个人增强图像（兼容模式）`}
            />
            {!showOriginal && rendererStatus === 'error' && (
              <div className="render-warning" role="status">
                当前浏览器无法渲染增强图像，已保留原图。
              </div>
            )}
            {split && <figcaption>{statusLabel}</figcaption>}
          </figure>
        </div>

        <aside className="viewer-controls" aria-label="查看器控制">
          <div className="control-primary">
            <span>01 · 显示方式</span>
            <button className="primary-button" type="button" onClick={toggleEnhancement}>
              {enhanced ? '关闭个人增强' : '开启个人增强'}
            </button>
            <small>增强不会修改原始文件，随时可以按住画面或空格键对照。</small>
          </div>

          <label className="strength-control">
            <span>02 · 增强强度</span>
            <strong>{strength}%</strong>
            <input
              type="range"
              min="0"
              max="100"
              value={strength}
              aria-label="增强强度"
              disabled={!enhanced}
              onChange={(event) => setStrength(Number(event.target.value))}
            />
            <small>校准建议 {Math.round(recommendedStrength * 100)}%</small>
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
              {split ? '单幅查看' : '并排比较'}
            </button>
          </div>

          <div className="interpretation-control">
            <span>04 · 作品线索</span>
            <button
              className="text-button"
              type="button"
              aria-expanded={showInterpretation}
              onClick={() => setShowInterpretation((value) => !value)}
            >
              {showInterpretation ? '收起色彩解读' : '展开色彩解读'}
            </button>
            {showInterpretation && <p>{artwork.interpretation}</p>}
          </div>

          <p className="renderer-note">
            {rendererStatus === 'cpu'
              ? '正在使用 CPU 兼容渲染。'
              : '图像仅在本机浏览器中处理。'}
          </p>
        </aside>
      </section>
    </main>
  )
}
