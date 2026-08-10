import type {
  CalibrationSession,
  DisplayConditions,
} from '../domain/calibration'
import type { CalibrationProfileV1 } from '../domain/profile'
import { openColorMasterDb, type ColorMasterDb } from './db'
import { parseCalibrationProfile } from './profileSchema'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createDisplayFingerprint(
  conditions: DisplayConditions,
): string {
  return [
    conditions.displayNickname.trim().toLocaleLowerCase(),
    `${conditions.screenWidthPx}x${conditions.screenHeightPx}`,
    conditions.colorDepth,
    conditions.pixelRatio,
  ].join('|')
}

export function migrateProfile(value: unknown): CalibrationProfileV1 {
  if (!isRecord(value)) {
    throw new TypeError('Profile must be an object')
  }

  if (value.schemaVersion === 1) {
    return parseCalibrationProfile(value)
  }
  if (value.schemaVersion === 0) {
    return parseCalibrationProfile({
      ...value,
      schemaVersion: 1,
      algorithmVersion:
        typeof value.algorithmVersion === 'string'
          ? value.algorithmVersion
          : 'migrated-v0',
    })
  }

  throw new RangeError(`Unsupported profile schema: ${String(value.schemaVersion)}`)
}

export class ProfileRepository {
  constructor(private readonly database: ColorMasterDb) {}

  saveDraft(session: CalibrationSession): Promise<string> {
    return this.database.put('sessions', session)
  }

  async loadDraft(sessionId: string): Promise<CalibrationSession | undefined> {
    return this.database.get('sessions', sessionId)
  }

  async promoteValidatedProfile(profile: CalibrationProfileV1): Promise<void> {
    const migrated = migrateProfile(profile)
    const transaction = this.database.transaction(
      ['profiles', 'settings'],
      'readwrite',
    )
    await Promise.all([
      transaction.objectStore('profiles').put(migrated),
      transaction.objectStore('settings').put({
        key: `active-profile:${migrated.displayFingerprint}`,
        value: migrated.id,
      }),
      transaction.done,
    ])
  }

  async loadActiveProfile(
    displayFingerprint: string,
  ): Promise<CalibrationProfileV1 | undefined> {
    const setting = await this.database.get(
      'settings',
      `active-profile:${displayFingerprint}`,
    )
    if (!setting) {
      return undefined
    }
    const profile = await this.database.get('profiles', setting.value)
    return profile ? migrateProfile(profile) : undefined
  }

  async loadMostRecentProfile(): Promise<CalibrationProfileV1 | undefined> {
    const profiles = (await this.database.getAll('profiles')).map(migrateProfile)
    return profiles.sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    )[0]
  }

  close() {
    this.database.close()
  }
}

export async function createProfileRepository(
  databaseName = 'color-master',
): Promise<ProfileRepository> {
  return new ProfileRepository(await openColorMasterDb(databaseName))
}
