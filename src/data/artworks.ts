export interface ArtworkRecord {
  id: string;
  titleZh: string;
  titleOriginal: string;
  artist: string;
  date: string;
  period: string;
  imagePath: string;
  objectPageUrl: string;
  imageSourceUrl: string;
  rights: "Public Domain" | "CC0" | "User provided";
  rationale: string;
  interpretation: string;
}

export const ARTWORKS: readonly ArtworkRecord[] = [
  {
    id: "night-cafe",
    titleZh: "夜间咖啡馆",
    titleOriginal: "Le café de nuit (The Night Café)",
    artist: "文森特·梵高 Vincent van Gogh",
    date: "1888",
    period: "后印象派",
    imagePath: "/artworks/night-cafe.jpg",
    objectPageUrl: "https://artgallery.yale.edu/collections/objects/12507",
    imageSourceUrl:
      "https://images.collections.yale.edu/iiif/2/yuag:3b072179-2fc7-42bc-87cc-9ee4d782b270/full/2000,/0/default.jpg",
    rights: "Public Domain",
    rationale:
      "红墙与绿色天花板形成近乎正面的冲突，是检验红绿关系、空间压迫感与情绪表达的核心作品。",
    interpretation:
      "梵高有意让红与绿彼此碰撞，使咖啡馆显得焦躁、不安。增强后可留意墙面、天花板和台球桌之间是否更容易分开。",
  },
  {
    id: "roses",
    titleZh: "玫瑰",
    titleOriginal: "Roses",
    artist: "文森特·梵高 Vincent van Gogh",
    date: "1890",
    period: "后印象派",
    imagePath: "/artworks/roses.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/436534",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DP346475.jpg",
    rights: "Public Domain",
    rationale:
      "浅粉玫瑰与绿色叶片在低对比背景中重叠，适合观察柔和红绿变化能否被分开而不失去空气感。",
    interpretation:
      "梵高用浅淡、相近的色调组织花束。增强的目标是帮助辨认花与叶，而不是把花朵变成刺眼的高饱和色块。",
  },
  {
    id: "apples-pears",
    titleZh: "苹果与梨的静物",
    titleOriginal: "Still Life with Apples and Pears",
    artist: "保罗·塞尚 Paul Cézanne",
    date: "约 1891–1892",
    period: "后印象派",
    imagePath: "/artworks/apples-pears.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/435883",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DP-14936-049.jpg",
    rights: "Public Domain",
    rationale:
      "塞尚以克制的红绿变化塑造体积，可用于观察增强是否改善果实分离，同时保留自然的明暗结构。",
    interpretation:
      "苹果和梨的体积来自冷暖、红绿与明暗共同作用。若增强恰当，轮廓会更清楚，但白布与阴影不应明显染色。",
  },
  {
    id: "oleanders",
    titleZh: "夹竹桃",
    titleOriginal: "Oleanders",
    artist: "文森特·梵高 Vincent van Gogh",
    date: "1888",
    period: "后印象派",
    imagePath: "/artworks/oleanders.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/436530",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DT1494.jpg",
    rights: "Public Domain",
    rationale:
      "粉红花朵、绿色叶片和黄褐背景交叠密集，能够检验增强对复杂边缘和笔触的帮助。",
    interpretation:
      "花瓣与叶片并非靠轮廓线分开，而靠邻近色和笔触方向。增强后应更容易追踪枝叶，又不能让背景抢走注意力。",
  },
  {
    id: "women-picking-olives",
    titleZh: "采橄榄的女子",
    titleOriginal: "Women Picking Olives",
    artist: "文森特·梵高 Vincent van Gogh",
    date: "1889",
    period: "后印象派",
    imagePath: "/artworks/women-picking-olives.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/436536",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DP-17161-001.jpg",
    rights: "Public Domain",
    rationale:
      "低饱和人物与橄榄树彼此交织，可检查个性化增强在自然场景中是否提升辨认而不过度造色。",
    interpretation:
      "人物、树干和土地共享许多灰绿与暖褐色。观察增强是否帮助找到三位采摘者，以及画面是否仍保持安静的整体气氛。",
  },
  {
    id: "great-wave",
    titleZh: "神奈川冲浪里",
    titleOriginal: "Under the Wave off Kanagawa (The Great Wave)",
    artist: "葛饰北斋 Katsushika Hokusai",
    date: "约 1830–1832",
    period: "浮世绘",
    imagePath: "/artworks/great-wave.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/56353",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/as/original/DP141067.jpg",
    rights: "Public Domain",
    rationale:
      "以蓝、米白为主的作品作为对照，帮助判断红绿增强是否错误改变原本不依赖红绿对比的画面。",
    interpretation:
      "这是控制作品：浪尖、天空和富士山主要依赖蓝色与明度。个性化增强不应明显改变它的层次或纸张色。",
  },
  {
    id: "dance-class",
    titleZh: "舞蹈课",
    titleOriginal: "The Dance Class",
    artist: "埃德加·德加 Edgar Degas",
    date: "1874",
    period: "印象派",
    imagePath: "/artworks/dance-class.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/438817",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DP-20101-001.jpg",
    rights: "Public Domain",
    rationale:
      "室内暖光、粉蓝舞裙与木质色调交织，可检验增强在复杂光源下是否帮助区分人物与背景。",
    interpretation:
      "注意舞女、钢琴和背景镜子之间的层次。增强应让空间关系更清晰，而不是把整幅画染上同一色调。",
  },
  {
    id: "wheat-field-cypresses",
    titleZh: "麦田与柏树",
    titleOriginal: "Wheat Field with Cypresses",
    artist: "文森特·梵高 Vincent van Gogh",
    date: "1889",
    period: "后印象派",
    imagePath: "/artworks/wheat-field-cypresses.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/436535",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DP-42549-001.jpg",
    rights: "Public Domain",
    rationale:
      "金黄麦浪、深绿柏树与蓝绿天空形成强烈对比，是测试红绿增强对高饱和画面稳定性的经典场景。",
    interpretation:
      "柏树的深绿与麦田的暖黄是这幅画的心跳。增强后应仍能感受到旋转笔触，而非只剩刺眼色块。",
  },
  {
    id: "farm-in-brittany",
    titleZh: "布列塔尼的农场",
    titleOriginal: "A Farm in Brittany",
    artist: "保罗·高更 Paul Gauguin",
    date: "约 1894",
    period: "后印象派",
    imagePath: "/artworks/farm-in-brittany.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/436448",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DP123847.jpg",
    rights: "Public Domain",
    rationale:
      "高更使用大面积平涂的红、绿、黄，可观察增强是否能分离这些色块而不破坏装饰性平面感。",
    interpretation:
      "前景的红色土地与绿色植被界限分明。增强的目标是保留这种装饰性对比，同时让土地与草地的关系更明显。",
  },
  {
    id: "virgin-and-child",
    titleZh: "圣母子",
    titleOriginal: "Virgin and Child",
    artist: "汉斯·梅姆林 Hans Memling",
    date: "约 1490–1494",
    period: "文艺复兴",
    imagePath: "/artworks/virgin-and-child.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/437060",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DP-42409-001.jpg",
    rights: "Public Domain",
    rationale:
      "文艺复兴作品以暖棕、深红和柔和绿色为主，可检验增强是否破坏古典画中克制的色彩平衡。",
    interpretation:
      "圣像画的色彩关系非常稳定。增强应让衣褶与背景稍微分离，同时保留宁静、庄重的气氛。",
  },
  {
    id: "fortune-teller",
    titleZh: "算命先生",
    titleOriginal: "The Fortune-Teller",
    artist: "乔治·德·拉·图尔 Georges de La Tour",
    date: "约 1630 年代",
    period: "巴洛克",
    imagePath: "/artworks/fortune-teller.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/436838",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/ep/original/DP-14286-015.jpg",
    rights: "Public Domain",
    rationale:
      "烛光下的红、绿衣料在暗部中相互渗透，可测试增强对低光照、低饱和色彩的分离能力。",
    interpretation:
      "画面几乎只靠一盏烛光照亮。增强后，年轻男子的衣袖、老妇的披肩和桌面应该更容易区分。",
  },
  {
    id: "hokusai-bridge",
    titleZh: "摄州阿治川口天保山",
    titleOriginal:
      "Tenpōzan at the Mouth of the Aji River in Settsu Province, from the series Remarkable Views of Bridges in Various Provinces",
    artist: "葛饰北斋 Katsushika Hokusai",
    date: "约 1833–1834",
    period: "浮世绘",
    imagePath: "/artworks/hokusai-bridge.jpg",
    objectPageUrl: "https://www.metmuseum.org/art/collection/search/56202",
    imageSourceUrl:
      "https://images.metmuseum.org/CRDImages/as/original/DP141278.jpg",
    rights: "Public Domain",
    rationale:
      "以蓝、绿和米色构成的浮世绘风景作为控制作品，可判断红绿增强是否误改原本不依赖红绿对比的画面。",
    interpretation:
      "天空、水面和桥主要依赖蓝色与明度。个性化增强不应明显改变这些层次或纸张的暖色调。",
  },
];

export function findArtwork(id: string) {
  return ARTWORKS.find((artwork) => artwork.id === id);
}

/**
 * Builds the gallery/viewer record for a user-provided image. Curatorial
 * fields stay empty — the UI hides them for user images. `imageUrl` is an
 * object URL owned by the caller, never stored.
 */
export function toUserArtworkRecord(
  id: string,
  name: string,
  imageUrl: string,
): ArtworkRecord {
  return {
    id,
    titleZh: name,
    titleOriginal: "个人图片",
    artist: "仅保存在此浏览器",
    date: "",
    period: "个人图片",
    imagePath: imageUrl,
    objectPageUrl: "",
    imageSourceUrl: imageUrl,
    rights: "User provided",
    rationale: "",
    interpretation: "",
  };
}
