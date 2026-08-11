import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ARTWORKS, toUserArtworkRecord } from "../../data/artworks";
import { GalleryScreen } from "./GalleryScreen";

function renderGallery(overrides: Partial<Parameters<typeof GalleryScreen>[0]>) {
  const props = {
    artworks: ARTWORKS,
    userImages: [],
    onSelect: vi.fn(),
    onAddFiles: vi.fn(async () => null),
    onAddUrl: vi.fn(async () => null),
    onDeleteImage: vi.fn(),
    ...overrides,
  };
  render(<GalleryScreen {...props} />);
  return props;
}

describe("GalleryScreen", () => {
  it("presents twelve local, explained works and opens a selection", async () => {
    const user = userEvent.setup();
    const props = renderGallery({});

    expect(screen.getAllByRole("button", { name: /查看/ })).toHaveLength(12);
    expect(screen.getAllByText("为什么选择这幅作品")).toHaveLength(12);
    for (const image of screen.getAllByRole("img")) {
      expect(image.getAttribute("src")).toMatch(/^\/artworks\//);
    }

    await user.click(screen.getByRole("button", { name: /查看夜间咖啡馆/ }));
    expect(props.onSelect).toHaveBeenCalledWith(ARTWORKS[0]);
  });

  it("accepts multiple image files at once", async () => {
    const user = userEvent.setup();
    const props = renderGallery({});

    const input = screen.getByLabelText("选择图片");
    const files = [
      new File(["a"], "one.png", { type: "image/png" }),
      new File(["b"], "two.png", { type: "image/png" }),
    ];
    await user.upload(input, files);
    expect(props.onAddFiles).toHaveBeenCalledWith(files);
  });

  it("submits a URL import and surfaces the error message on failure", async () => {
    const user = userEvent.setup();
    const props = renderGallery({
      onAddUrl: vi.fn(async () => "对方网站不允许直接读取"),
    });

    await user.type(
      screen.getByLabelText("图片链接"),
      "https://example.com/cat.jpg",
    );
    await user.click(screen.getByRole("button", { name: "添加" }));

    expect(props.onAddUrl).toHaveBeenCalledWith("https://example.com/cat.jpg");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "对方网站不允许直接读取",
    );
  });

  it("lists user images with delete and select actions", async () => {
    const user = userEvent.setup();
    const mine = toUserArtworkRecord("personal-1", "家里的猫.jpg", "blob:fake");
    const props = renderGallery({ userImages: [mine] });

    await user.click(screen.getByRole("button", { name: /查看家里的猫/ }));
    expect(props.onSelect).toHaveBeenCalledWith(mine);

    await user.click(screen.getByRole("button", { name: "删除 家里的猫.jpg" }));
    expect(props.onDeleteImage).toHaveBeenCalledWith("personal-1");
  });
});
