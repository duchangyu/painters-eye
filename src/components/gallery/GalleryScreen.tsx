import type { ArtworkRecord } from "../../data/artworks";
import { UserImageSection } from "./UserImageSection";

export interface GalleryScreenProps {
  readonly artworks: readonly ArtworkRecord[];
  readonly userImages: readonly ArtworkRecord[];
  readonly onSelect: (artwork: ArtworkRecord) => void;
  readonly onAddFiles: (files: File[]) => Promise<string | null>;
  readonly onAddUrl: (url: string) => Promise<string | null>;
  readonly onDeleteImage: (id: string) => void;
  readonly onOpenProfile?: () => void;
  readonly onOpenScience?: () => void;
  /** Shown while the gallery runs on a generic preset instead of a
   * personalized, validated profile. */
  readonly presetBanner?: {
    readonly labelZh: string;
    readonly onUpgrade: () => void;
  };
}

export function GalleryScreen({
  artworks,
  userImages,
  onSelect,
  onAddFiles,
  onAddUrl,
  onDeleteImage,
  onOpenProfile,
  onOpenScience,
  presetBanner,
}: GalleryScreenProps) {
  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <div>
          <p className="folio">世界名画 · 正常视觉预览</p>
          <h1>画家眼中，是什么颜色？</h1>
        </div>
        <div className="gallery-intro">
          <p>
            先看你熟悉的画面，再切换到正常视觉模式。你会看到，色觉正常的人在欣赏同一幅画时，可能注意到哪些你平时错过的细节。也可以上传或粘贴链接，看你自己的图片。
          </p>
          {onOpenScience && (
            <button
              className="text-button"
              type="button"
              onClick={onOpenScience}
            >
              背后的科学原理
            </button>
          )}
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

      {presetBanner && (
        <section className="preset-banner" aria-label="近似模式提示">
          <p>
            <strong>近似模式</strong>
            正在使用「{presetBanner.labelZh}」通用预设增强画面。
            做一次个性化精准测试，效果会更贴合你。
          </p>
          <button
            className="quiet-button"
            type="button"
            onClick={presetBanner.onUpgrade}
          >
            开始精准测试
          </button>
        </section>
      )}

      <UserImageSection
        userImages={userImages}
        onSelect={onSelect}
        onAddFiles={onAddFiles}
        onAddUrl={onAddUrl}
        onDeleteImage={onDeleteImage}
      />

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
    </main>
  );
}
