import { useState, type ChangeEvent } from 'react'
import type { CalibrationProfileV1 } from '../../domain/profile'
import {
  exportProfileFile,
  importProfileFile,
  type ValidationSummary,
} from '../../storage/profileFile'

type Download = (filename: string, contents: string) => void

function downloadInBrowser(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text()
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(file)
  })
}

export interface ProfileSettingsProps {
  readonly profile: CalibrationProfileV1
  readonly validation?: ValidationSummary
  readonly onClose: () => void
  readonly onImport: (profile: CalibrationProfileV1) => void | Promise<void>
  readonly onReviewDisplay: () => void
  readonly onRecalibrate?: () => void
  readonly download?: Download
}

export function ProfileSettings({
  profile,
  validation = { passed: true },
  onClose,
  onImport,
  onReviewDisplay,
  onRecalibrate,
  download = downloadInBrowser,
}: ProfileSettingsProps) {
  const [preview, setPreview] = useState<CalibrationProfileV1 | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function exportBackup() {
    setBusy(true)
    setError(null)
    try {
      const contents = await exportProfileFile(profile, validation)
      download(`color-master-${profile.id}.json`, contents)
    } catch {
      setError('导出失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  async function previewImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setPreview(null)
    setError(null)
    try {
      const imported = await importProfileFile(await readText(file))
      if (!imported.validation.passed) {
        throw new Error('unvalidated profile')
      }
      setPreview(imported.profile)
    } catch {
      setError('无法导入：文件损坏、不受支持或未通过独立验证。')
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      await onImport(preview)
      setPreview(null)
    } catch {
      setError('导入失败，原配置仍保留。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <button
          className="text-button"
          type="button"
          aria-label="返回画廊"
          onClick={onClose}
        >
          ← 返回画廊
        </button>
        <div>
          <p className="folio">本机配置</p>
          <h1>保存一次，继续使用</h1>
        </div>
      </header>

      <section className="profile-summary">
        <div>
          <p className="folio">当前</p>
          <h2>当前配置：{profile.displayConditions.displayNickname}</h2>
          <p>
            {profile.displayConditions.brightnessDescription} · 创建于{' '}
            {new Date(profile.createdAt).toLocaleDateString('zh-CN')}
          </p>
        </div>
        <dl>
          <div>
            <dt>类型</dt>
            <dd>{profile.compensation.deficiency}</dd>
          </div>
          <div>
            <dt>建议强度</dt>
            <dd>{Math.round(profile.compensation.recommendedStrength * 100)}%</dd>
          </div>
          <div>
            <dt>置信度</dt>
            <dd>{Math.round(profile.confidence * 100)}%</dd>
          </div>
        </dl>
      </section>

      <section className="profile-actions">
        <article>
          <span>01</span>
          <div>
            <h2>备份到文件</h2>
            <p>导出包含原始试次、算法版本、显示条件和校验和的 JSON 文件。</p>
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={exportBackup}
            >
              导出配置备份
            </button>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h2>从备份恢复</h2>
            <p>文件会先在本机验证和预览；确认之前不会替换当前配置。</p>
            <label className="quiet-button upload-label">
              选择备份文件
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                aria-label="导入配置文件"
                disabled={busy}
                onChange={previewImport}
              />
            </label>
            {preview && (
              <div className="import-preview">
                <strong>
                  待导入：{preview.displayConditions.displayNickname}
                </strong>
                <span>{preview.algorithmVersion}</span>
                <button
                  className="primary-button"
                  type="button"
                  disabled={busy}
                  onClick={confirmImport}
                >
                  确认导入
                </button>
              </div>
            )}
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h2>显示环境</h2>
            <p>换显示器、明显改变亮度或系统色彩设置后，先做短复核。</p>
            <button className="quiet-button" type="button" onClick={onReviewDisplay}>
              复核显示环境
            </button>
            {onRecalibrate && (
              <button className="text-button" type="button" onClick={onRecalibrate}>
                重新完整校准
              </button>
            )}
          </div>
        </article>
      </section>

      {error && <p className="profile-error" role="alert">{error}</p>}
      <p className="limitations-note">
        配置保存在当前浏览器中，仅代表这套显示条件下的行为结果，不是医学诊断。
      </p>
    </main>
  )
}
