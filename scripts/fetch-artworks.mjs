import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DIR = join(ROOT, 'public', 'artworks')
const MANIFEST_PATH = join(OUTPUT_DIR, 'manifest.json')
const USER_AGENT = 'ColorMasterMVP/1.0 (local educational artwork viewer)'

const sources = [
  {
    id: 'night-cafe',
    filename: 'night-cafe.jpg',
    provider: 'Yale University Art Gallery / Wikimedia Commons',
    objectId: 12507,
    title: 'Le café de nuit (The Night Café)',
    creator: 'Vincent van Gogh',
    date: '1888',
    rights: 'Public Domain',
    objectPageUrl: 'https://artgallery.yale.edu/collections/objects/12507',
    manifestUrl: 'https://manifests.collections.yale.edu/yuag/obj/12507',
    commonsRecordUrl:
      'https://commons.wikimedia.org/wiki/File:Le_caf%C3%A9_de_nuit_(The_Night_Caf%C3%A9)_by_Vincent_van_Gogh.jpeg',
  },
  {
    id: 'roses',
    filename: 'roses.jpg',
    provider: 'The Metropolitan Museum of Art',
    objectId: 436534,
    title: 'Roses',
    creator: 'Vincent van Gogh',
    date: '1890',
    rights: 'Public Domain',
    objectPageUrl: 'https://www.metmuseum.org/art/collection/search/436534',
  },
  {
    id: 'apples-pears',
    filename: 'apples-pears.jpg',
    provider: 'The Metropolitan Museum of Art',
    objectId: 435883,
    title: 'Still Life with Apples and Pears',
    creator: 'Paul Cézanne',
    date: 'ca. 1891–92',
    rights: 'Public Domain',
    objectPageUrl: 'https://www.metmuseum.org/art/collection/search/435883',
  },
  {
    id: 'oleanders',
    filename: 'oleanders.jpg',
    provider: 'The Metropolitan Museum of Art',
    objectId: 436530,
    title: 'Oleanders',
    creator: 'Vincent van Gogh',
    date: '1888',
    rights: 'Public Domain',
    objectPageUrl: 'https://www.metmuseum.org/art/collection/search/436530',
  },
  {
    id: 'women-picking-olives',
    filename: 'women-picking-olives.jpg',
    provider: 'The Metropolitan Museum of Art',
    objectId: 436536,
    title: 'Women Picking Olives',
    creator: 'Vincent van Gogh',
    date: '1889',
    rights: 'Public Domain',
    objectPageUrl: 'https://www.metmuseum.org/art/collection/search/436536',
  },
  {
    id: 'great-wave',
    filename: 'great-wave.jpg',
    provider: 'The Metropolitan Museum of Art',
    objectId: 56353,
    title: 'Under the Wave off Kanagawa (The Great Wave)',
    creator: 'Katsushika Hokusai',
    date: 'ca. 1830–32',
    rights: 'Public Domain',
    objectPageUrl: 'https://www.metmuseum.org/art/collection/search/56353',
  },
]

async function fetchChecked(url, expected = 'application/json') {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}): ${url}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith(expected)) {
    throw new Error(`Expected ${expected}, received ${contentType}: ${url}`)
  }
  return response
}

async function resolveSource(source) {
  if (source.provider === 'The Metropolitan Museum of Art') {
    const apiUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${source.objectId}`
    const response = await fetchChecked(apiUrl)
    const metadata = await response.json()
    if (metadata.objectID !== source.objectId) {
      throw new Error(`Changed Met object ID for ${source.id}`)
    }
    if (metadata.isPublicDomain !== true) {
      throw new Error(`Met object is no longer marked public domain: ${source.id}`)
    }
    if (!metadata.primaryImage) {
      throw new Error(`Met object has no primary image: ${source.id}`)
    }
    return {
      ...source,
      apiUrl,
      imageSourceUrl: metadata.primaryImage,
    }
  }

  const apiUrl = source.manifestUrl
  const response = await fetchChecked(apiUrl)
  const payload = await response.json()
  if (payload.id !== source.manifestUrl) {
    throw new Error(`Changed Yale object ID for ${source.id}`)
  }
  const copyright = payload.metadata?.find(
    (entry) => entry.label?.en?.[0] === 'Copyright Statement',
  )?.value?.en?.[0]
  const canvas = payload.items?.[0]
  const image = canvas?.items?.[0]?.items?.[0]?.body
  const imageRights = canvas?.metadata?.find(
    (entry) => entry.label?.en?.[0] === 'Image Use Rights',
  )?.value?.en?.[0]
  if (copyright !== 'Public domain' || imageRights !== 'No Copyright - United States') {
    throw new Error(`Yale image is missing public-domain status: ${source.id}`)
  }
  if (image?.format !== 'image/jpeg' || !image?.service?.[0]?.['@id']) {
    throw new Error(`Yale source is not a JPEG IIIF image: ${source.id}`)
  }
  return {
    ...source,
    apiUrl,
    imageSourceUrl: `${image.service[0]['@id']}/full/2000,/0/default.jpg`,
  }
}

async function resizeAndHash(source) {
  const response = await fetchChecked(source.imageSourceUrl, 'image/')
  const input = Buffer.from(await response.arrayBuffer())
  const metadata = await sharp(input).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unreadable image dimensions: ${source.id}`)
  }

  let pipeline = sharp(input).rotate().resize({
    width: 2000,
    height: 2000,
    fit: 'inside',
    withoutEnlargement: true,
  })
  if (metadata.icc) {
    pipeline = pipeline.keepIccProfile()
  }
  const output = await pipeline.jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer()
  const outputMetadata = await sharp(output).metadata()
  const hash = createHash('sha256').update(output).digest('hex')
  return {
    output,
    hash,
    width: outputMetadata.width,
    height: outputMetadata.height,
  }
}

async function readExistingManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const existing = await readExistingManifest()
  const records = []

  for (const definition of sources) {
    const source = await resolveSource(definition)
    const image = await resizeAndHash(source)
    const previous = existing?.artworks?.find((item) => item.id === source.id)
    if (previous && previous.sha256 !== image.hash) {
      throw new Error(
        `Hash mismatch for ${source.id}; review the upstream change before replacing local art`,
      )
    }
    const target = join(OUTPUT_DIR, source.filename)
    const temporary = `${target}.tmp`
    await writeFile(temporary, image.output)
    await rename(temporary, target)
    records.push({
      id: source.id,
      filename: source.filename,
      title: source.title,
      creator: source.creator,
      date: source.date,
      provider: source.provider,
      objectId: source.objectId,
      objectPageUrl: source.objectPageUrl,
      metadataSourceUrl: source.apiUrl,
      imageSourceUrl: source.imageSourceUrl,
      ...(source.commonsRecordUrl
        ? { commonsRecordUrl: source.commonsRecordUrl }
        : {}),
      rights: source.rights,
      width: image.width,
      height: image.height,
      sha256: image.hash,
    })
  }

  const manifest = {
    schemaVersion: 1,
    processing: {
      longEdgePixels: 2000,
      jpegQuality: 88,
      chromaSubsampling: '4:4:4',
      metadata: 'ICC preserved when present; unrelated metadata removed',
    },
    artworks: records,
  }
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Verified and wrote ${records.length} artworks to ${OUTPUT_DIR}`)
}

await main()
