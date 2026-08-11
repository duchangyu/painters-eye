import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ARTWORKS } from "../../data/artworks";
import { GalleryScreen } from "./GalleryScreen";

describe("GalleryScreen", () => {
  it("presents twelve local, explained works and opens a selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<GalleryScreen artworks={ARTWORKS} onSelect={onSelect} />);

    expect(screen.getAllByRole("button", { name: /查看/ })).toHaveLength(12);
    expect(screen.getAllByText("为什么选择这幅作品")).toHaveLength(12);
    for (const image of screen.getAllByRole("img")) {
      expect(image.getAttribute("src")).toMatch(/^\/artworks\//);
    }

    await user.click(screen.getByRole("button", { name: /查看夜间咖啡馆/ }));
    expect(onSelect).toHaveBeenCalledWith(ARTWORKS[0]);
  });

  it("keeps personal image upload secondary and optional", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(
      <GalleryScreen
        artworks={ARTWORKS}
        onSelect={vi.fn()}
        onUpload={onUpload}
      />,
    );

    const input = screen.getByLabelText("使用自己的图片");
    const file = new File(["pixels"], "mine.png", { type: "image/png" });
    await user.upload(input, file);
    expect(onUpload).toHaveBeenCalledWith(file);
  });
});
