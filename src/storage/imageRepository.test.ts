// @vitest-environment node
// Node's structured clone round-trips Blob intact; jsdom's does not, and
// fake-indexeddb relies on structured clone for stored values.
import { deleteDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createImageRepository,
  type ImageRepository,
} from './imageRepository'
import type { StoredImage } from './db'

const DATABASE = 'color-master-image-test'

function storedImage(id: string, addedAt: string): StoredImage {
  return {
    id,
    name: `${id}.jpg`,
    blob: new Blob(['fake-image-bytes'], { type: 'image/jpeg' }),
    addedAt,
  }
}

describe('ImageRepository', () => {
  let repository: ImageRepository

  beforeEach(async () => {
    repository = await createImageRepository(DATABASE)
  })

  afterEach(async () => {
    repository.close()
    await deleteDB(DATABASE)
  })

  it('round-trips saved images ordered by addedAt', async () => {
    await repository.saveImage(storedImage('img-b', '2026-08-11T02:00:00Z'))
    await repository.saveImage(storedImage('img-a', '2026-08-11T01:00:00Z'))

    const images = await repository.listImages()
    expect(images.map((image) => image.id)).toEqual(['img-a', 'img-b'])
    expect(images[0]!.blob.size).toBeGreaterThan(0)
  })

  it('deletes images by id', async () => {
    await repository.saveImage(storedImage('img-a', '2026-08-11T01:00:00Z'))
    await repository.deleteImage('img-a')

    expect(await repository.listImages()).toEqual([])
  })

  it('opens a v1 database and upgrades it with the images store', async () => {
    repository.close()
    await deleteDB(DATABASE)
    // Simulate a returning user whose database was created before images.
    const { openDB } = await import('idb')
    const legacy = await openDB(DATABASE, 1, {
      upgrade(database) {
        database.createObjectStore('sessions', { keyPath: 'id' })
        const profiles = database.createObjectStore('profiles', {
          keyPath: 'id',
        })
        profiles.createIndex('by-display', 'displayFingerprint')
        database.createObjectStore('settings', { keyPath: 'key' })
      },
    })
    legacy.close()

    repository = await createImageRepository(DATABASE)
    await repository.saveImage(storedImage('img-c', '2026-08-11T03:00:00Z'))
    expect((await repository.listImages()).map((image) => image.id)).toEqual([
      'img-c',
    ])
  })
})
