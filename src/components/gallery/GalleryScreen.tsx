import type { ChangeEvent } from "react";
import type { ArtworkRecord } from "../../data/artworks";

export interface GalleryScreenProps {
  readonly artworks: readonly ArtworkRecord[];
  readonly onSelect: (artwork: ArtworkRecord) => void;
  readonly onUpload?: (file: File) => void;
  readonly onOpenProfile?: () => void;
}

export function GalleryScreen({
  artworks,
  onSelect,
  onUpload,
  onOpenProfile,
}: GalleryScreenProps) {
  function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onUpload?.(file);
    }
    event.target.value = "";
  }

  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <div>
          <p className="folio">世界名画 · 正常视觉预览</p>
          <h1>画家眼中，是什么颜色？</h1>
        </div>
        <div className="gallery-intro">
          <p>
            先看你熟悉的画面，再切换到正常视觉模式。你会看到，色觉正常的人在欣赏同一幅画时，可能注意到哪些你平时错过的细节。
          </p>
          {onOpenProfile && (
            <button
              className="text-button"
              type="button"
              onClick={onOpenProfile}
            >
              配置与备份
            </button>
          )}
        </div>
      </header>

      <section className="gallery-grid" aria-label="内置公版画作">
        {artworks.map((artwork, index) => (
          <article className="artwork-card" key={artwork.id}>
            <button
              className="artwork-image-button"
              type="button"
              aria-label={`查看${artwork.titleZh}`}
              onClick={() => onSelect(artwork)}
            >
              <img
                src={artwork.imagePath}
                alt={`${artwork.titleZh}，${artwork.artist}`}
                loading={index < 2 ? "eager" : "lazy"}
              />
              <span aria-hidden="true">进入查看器 ↗</span>
            </button>
            <div className="artwork-caption">
              <span className="collection-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{artwork.titleZh}</h2>
                <p className="original-title">{artwork.titleOriginal}</p>
                <p className="artwork-credit">
                  {artwork.period} · {artwork.artist} · {artwork.date}
                </p>
                <div className="curatorial-note">
                  <strong>为什么选择这幅作品</strong>
                  <p>{artwork.rationale}</p>
                </div>
                <a
                  className="source-link"
                  href={artwork.objectPageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  馆藏记录 · {artwork.rights}
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      {onUpload && (
        <aside className="personal-image-entry">
          <div>
            <p className="folio">可选 · 不影响校准</p>
            <h2>也可以看你熟悉的图片</h2>
            <p>图片只在当前浏览器中处理，不会上传到服务器。</p>
          </div>
          <label className="quiet-button upload-label">
            使用自己的图片
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="使用自己的图片"
              onChange={uploadImage}
            />
          </label>
        </aside>
      )}
    </main>
  );
}
