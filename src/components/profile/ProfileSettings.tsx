import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { CalibrationProfileV1 } from "../../domain/profile";
import { AuthModal } from "../../auth/AuthModal";
import { useAuthState } from "../../auth/authState";
import { createDefaultCloudClient } from "../../cloud/cloudClient";
import {
  deleteCloudProfile,
  downloadCloudProfile,
  listCloudProfiles,
  uploadCloudProfile,
  type CloudProfileSummary,
} from "../../cloud/CloudProfileRepository";
import {
  exportProfileFile,
  importProfileFile,
  type ValidationSummary,
} from "../../storage/profileFile";

type Download = (filename: string, contents: string) => void;

function downloadInBrowser(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

export interface ProfileSettingsProps {
  readonly profile: CalibrationProfileV1;
  readonly validation?: ValidationSummary;
  readonly onClose: () => void;
  readonly onImport: (profile: CalibrationProfileV1) => void | Promise<void>;
  readonly onReviewDisplay: () => void;
  readonly onRecalibrate?: () => void;
  readonly download?: Download;
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
  const [preview, setPreview] = useState<CalibrationProfileV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const auth = useAuthState();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<
    readonly CloudProfileSummary[]
  >([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const [cloudClient, cloudConfigError] = useMemo<
    [ReturnType<typeof createDefaultCloudClient> | null, string | null]
  >(() => {
    if (auth.status !== "signedIn") return [null, null];
    try {
      return [createDefaultCloudClient(auth.getToken), null];
    } catch (error) {
      return [
        null,
        error instanceof Error
          ? error.message
          : "云端服务配置错误，请检查环境变量。",
      ];
    }
  }, [auth.status, auth.getToken]);

  // Reset cloud state during render whenever the client changes (sign-in,
  // sign-out, token refresh), then load backups asynchronously.
  const [lastCloudClient, setLastCloudClient] = useState(cloudClient);
  if (cloudClient !== lastCloudClient) {
    setLastCloudClient(cloudClient);
    setCloudBackups([]);
    setCloudError(null);
    setCloudLoading(cloudClient !== null);
  }

  useEffect(() => {
    if (!cloudClient) return;
    let cancelled = false;
    listCloudProfiles(cloudClient)
      .then((items) => {
        if (!cancelled) setCloudBackups(items);
      })
      .catch(() => {
        if (!cancelled) setCloudError("无法读取云端备份，请稍后重试。");
      })
      .finally(() => {
        if (!cancelled) setCloudLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cloudClient]);

  async function saveToCloud() {
    if (auth.status !== "signedIn" || !cloudClient) {
      if (auth.status === "signedOut") {
        setAuthModalOpen(true);
      } else if (auth.status === "signedIn" && cloudConfigError) {
        setCloudError(cloudConfigError);
      }
      return;
    }
    setCloudSaving(true);
    setCloudError(null);
    try {
      const name = `${profile.displayConditions.displayNickname} · ${new Date().toLocaleString("zh-CN")}`;
      const summary = await uploadCloudProfile(cloudClient, { name, profile });
      setCloudBackups((current) => [summary, ...current]);
    } catch {
      setCloudError("保存到云端失败，请稍后重试。");
    } finally {
      setCloudSaving(false);
    }
  }

  async function restoreFromCloud(id: string) {
    if (!cloudClient) return;
    setCloudBusy(true);
    setCloudError(null);
    try {
      const payload = await downloadCloudProfile(cloudClient, id);
      await onImport(payload.profile);
    } catch {
      setCloudError("从云端恢复失败，当前配置仍保留。");
    } finally {
      setCloudBusy(false);
    }
  }

  async function downloadFromCloud(id: string) {
    if (!cloudClient) return;
    setCloudBusy(true);
    setCloudError(null);
    try {
      const payload = await downloadCloudProfile(cloudClient, id);
      const contents = await exportProfileFile(
        payload.profile,
        payload.summary.validationSummary ??
          payload.profile.validation ?? { passed: true },
      );
      download(`color-master-${payload.profile.id}.json`, contents);
    } catch {
      setCloudError("下载云端备份失败，请稍后重试。");
    } finally {
      setCloudBusy(false);
    }
  }

  async function removeFromCloud(id: string) {
    if (!cloudClient) return;
    setCloudBusy(true);
    setCloudError(null);
    try {
      await deleteCloudProfile(cloudClient, id);
      setCloudBackups((current) => current.filter((item) => item.id !== id));
    } catch {
      setCloudError("删除云端备份失败，请稍后重试。");
    } finally {
      setCloudBusy(false);
    }
  }

  async function exportBackup() {
    setBusy(true);
    setError(null);
    try {
      const contents = await exportProfileFile(profile, validation);
      download(`color-master-${profile.id}.json`, contents);
    } catch {
      setError("导出失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function previewImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setPreview(null);
    setError(null);
    try {
      const imported = await importProfileFile(await readText(file));
      if (!imported.validation.passed) {
        throw new Error("unvalidated profile");
      }
      setPreview(imported.profile);
    } catch {
      setError("无法导入：文件损坏、不受支持或未通过独立验证。");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await onImport(preview);
      setPreview(null);
    } catch {
      setError("导入失败，原配置仍保留。");
    } finally {
      setBusy(false);
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
            {profile.displayConditions.brightnessDescription} · 创建于{" "}
            {new Date(profile.createdAt).toLocaleDateString("zh-CN")}
          </p>
        </div>
        <dl>
          <div>
            <dt>类型</dt>
            <dd>{profile.compensation.deficiency}</dd>
          </div>
          <div>
            <dt>建议强度</dt>
            <dd>
              {Math.round(profile.compensation.recommendedStrength * 100)}%
            </dd>
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
            <button
              className="quiet-button"
              type="button"
              onClick={onReviewDisplay}
            >
              复核显示环境
            </button>
            {onRecalibrate && (
              <button
                className="text-button"
                type="button"
                onClick={onRecalibrate}
              >
                重新完整测试
              </button>
            )}
          </div>
        </article>
        <article>
          <span>04</span>
          <div>
            <h2>云端备份</h2>
            <p>
              登录后可将当前配置保存到云端，换设备时可随时恢复或下载历史备份。
            </p>
            {auth.status === "signedIn" ? (
              <p className="cloud-account">
                <span>已登录{auth.email ? `：${auth.email}` : ""}</span>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    void auth.signOut();
                  }}
                >
                  退出登录
                </button>
              </p>
            ) : auth.status === "unavailable" ? (
              <p className="cloud-account">
                {auth.error ?? "云端功能未配置，本地备份不受影响。"}
              </p>
            ) : (
              <p className="cloud-account">
                未登录；登录后才能使用云端保存与恢复。
              </p>
            )}
            {cloudConfigError && auth.status === "signedIn" && (
              <p className="cloud-account">{cloudConfigError}</p>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={
                busy ||
                cloudBusy ||
                cloudSaving ||
                auth.status === "unavailable" ||
                auth.status === "loading" ||
                (auth.status === "signedIn" &&
                  (!cloudClient || Boolean(cloudConfigError)))
              }
              onClick={() => {
                void saveToCloud();
              }}
            >
              {cloudSaving ? "正在保存…" : "保存到云端"}
            </button>
            {auth.status === "signedIn" && (
              <div className="cloud-backups">
                <h3>从云端恢复</h3>
                {cloudLoading && <p>正在读取云端备份…</p>}
                {!cloudLoading && cloudBackups.length === 0 && (
                  <p>暂无云端备份。</p>
                )}
                {cloudBackups.length > 0 && (
                  <ul className="cloud-backup-list">
                    {cloudBackups.map((backup) => (
                      <li key={backup.id}>
                        <div className="cloud-backup-info">
                          <strong>{backup.name}</strong>
                          <span>
                            {backup.displayName} ·{" "}
                            {new Date(backup.createdAt).toLocaleString("zh-CN")}
                          </span>
                        </div>
                        <div className="cloud-backup-actions">
                          <button
                            className="quiet-button"
                            type="button"
                            disabled={cloudBusy}
                            onClick={() => {
                              void restoreFromCloud(backup.id);
                            }}
                          >
                            恢复
                          </button>
                          <button
                            className="quiet-button"
                            type="button"
                            disabled={cloudBusy}
                            onClick={() => {
                              void downloadFromCloud(backup.id);
                            }}
                          >
                            下载
                          </button>
                          <button
                            className="text-button"
                            type="button"
                            disabled={cloudBusy}
                            onClick={() => {
                              void removeFromCloud(backup.id);
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </article>
      </section>

      {error && (
        <p className="profile-error" role="alert">
          {error}
        </p>
      )}
      {cloudError && (
        <p className="profile-error" role="alert">
          {cloudError}
        </p>
      )}
      <p className="limitations-note">
        配置保存在当前浏览器中，仅代表这套显示条件下的行为结果，不是医学诊断。
      </p>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </main>
  );
}
