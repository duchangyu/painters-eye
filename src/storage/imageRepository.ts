import { openColorMasterDb, type ColorMasterDb, type StoredImage } from './db'

/** Largest accepted user image; bigger files are rejected before storage. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export class ImageRepository {
  constructor(private readonly database: ColorMasterDb) {}

  async listImages(): Promise<readonly StoredImage[]> {
    const images = await this.database.getAll('images')
    return images.sort((left, right) =>
      left.addedAt.localeCompare(right.addedAt),
    )
  }

  saveImage(image: StoredImage): Promise<string> {
    return this.database.put('images', image)
  }

  deleteImage(id: string): Promise<void> {
    return this.database.delete('images', id)
  }

  close() {
    this.database.close()
  }
}

export async function createImageRepository(
  databaseName = 'color-master',
): Promise<ImageRepository> {
  return new ImageRepository(await openColorMasterDb(databaseName))
}
