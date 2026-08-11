import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CalibrationSession } from '../domain/calibration'
import type { CalibrationProfileV1 } from '../domain/profile'

interface SettingRecord {
  readonly key: string
  readonly value: string
}

/**
 * A user-provided image kept locally in IndexedDB. The blob is the source
 * of truth; object URLs are created per session and never stored.
 */
export interface StoredImage {
  readonly id: string
  readonly name: string
  readonly blob: Blob
  readonly addedAt: string
}

export interface ColorMasterDatabase extends DBSchema {
  sessions: {
    key: string
    value: CalibrationSession
  }
  profiles: {
    key: string
    value: CalibrationProfileV1
    indexes: { 'by-display': string }
  }
  settings: {
    key: string
    value: SettingRecord
  }
  images: {
    key: string
    value: StoredImage
  }
}

export type ColorMasterDb = IDBPDatabase<ColorMasterDatabase>

export function openColorMasterDb(
  databaseName = 'color-master',
): Promise<ColorMasterDb> {
  return openDB<ColorMasterDatabase>(databaseName, 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('sessions', { keyPath: 'id' })
        const profiles = database.createObjectStore('profiles', {
          keyPath: 'id',
        })
        profiles.createIndex('by-display', 'displayFingerprint')
        database.createObjectStore('settings', { keyPath: 'key' })
      }
      if (oldVersion < 2) {
        database.createObjectStore('images', { keyPath: 'id' })
      }
    },
  })
}
