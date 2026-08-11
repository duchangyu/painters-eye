import {
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import type { ArtworkRecord } from "../../data/artworks";

export interface UserImageSectionProps {
  readonly userImages: readonly ArtworkRecord[];
  readonly onSelect: (artwork: ArtworkRecord) => void;
  readonly onAddFiles: (files: File[]) => Promise<string | null>;
  readonly onAddUrl: (url: string) => Promise<string | null>;
  readonly onDeleteImage: (id: string) => void;
}

/**
 * The user's own image library: local files (picker or drag-and-drop) and
 * URL imports, all persisted in the browser. Lives outside .gallery-grid so
 * the built-in collection's layout and offline invariants stay untouched.
 */
export function UserImageSection({
  userImages,
  onSelect,
  onAddFiles,
  onAddUrl,
  onDeleteImage,
}: UserImageSectionProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    try {
      setError(await onAddFiles(files));
    } finally {
      setBusy(false);
    }
  }

  function pickFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    void addFiles(files);
  }

  async function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const message = await onAddUrl(trimmed);
      if (message) {
        setError(message);
      } else {
        setError(null);
        setUrl("");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragActive(false);
    void addFiles([...event.dataTransfer.files]);
  }

  return (
    <section
      className={`personal-section${dragActive ? " drag-active" : ""}`}
      aria-label="我的图片"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="personal-header">
        <div>
          <p className="folio">我的图片 · 只保存在这台设备</p>
          <h2>看你自己的图片</h2>
          <p>把图片拖进来、从相册选择，或粘贴图片链接。不会上传到服务器。</p>
        </div>
        <div className="personal-actions">
          <label className={`quiet-button upload-label${busy ? " disabled" : ""}`}>
            选择图片
            <input
              className="sr-only"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              aria-label="选择图片"
              disabled={busy}
              onChange={pickFiles}
            />
          </label>
          <form className="url-import" onSubmit={submitUrl}>
            <input
              type="url"
              value={url}
              placeholder="粘贴图片链接，https://…"
              aria-label="图片链接"
              disabled={busy}
              onChange={(event) => setUrl(event.target.value)}
            />
            <button
              className="quiet-button"
              type="submit"
              disabled={busy || url.trim() === ""}
            >
              添加
            </button>
          </form>
        </div>
      </div>
      {error && (
        <p className="personal-error" role="alert">
          {error}
        </p>
      )}
      {dragActive && (
        <p className="personal-drop-hint">松开即可添加图片</p>
      )}
      {userImages.length > 0 && (
        <div className="personal-grid">
          {userImages.map((image) => (
            <article className="personal-card" key={image.id}>
              <button
                className="artwork-image-button"
                type="button"
                aria-label={`查看${image.titleZh}`}
                onClick={() => onSelect(image)}
              >
                <img src={image.imagePath} alt={image.titleZh} loading="lazy" />
                <span aria-hidden="true">进入查看器 ↗</span>
              </button>
              <div className="personal-card-footer">
                <span className="personal-card-name">{image.titleZh}</span>
                <button
                  className="text-button"
                  type="button"
                  aria-label={`删除 ${image.titleZh}`}
                  onClick={() => onDeleteImage(image.id)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
