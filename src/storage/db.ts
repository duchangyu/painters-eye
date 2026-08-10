import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CalibrationSession } from '../domain/calibration'
import type { CalibrationProfileV1 } from '../domain/profile'

interface SettingRecord {
  readonly key: string
  readonly value: string
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
}

export type ColorMasterDb = IDBPDatabase<ColorMasterDatabase>

export function openColorMasterDb(
  databaseName = 'color-master',
): Promise<ColorMasterDb> {
  return openDB<ColorMasterDatabase>(databaseName, 1, {
    upgrade(database) {
      database.createObjectStore('sessions', { keyPath: 'id' })
      const profiles = database.createObjectStore('profiles', { keyPath: 'id' })
      profiles.createIndex('by-display', 'displayFingerprint')
      database.createObjectStore('settings', { keyPath: 'key' })
    },
  })
}
