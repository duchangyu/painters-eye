import type {
  CalibrationProfileV1,
  ProfileValidationSummary,
} from '../domain/profile'
import { migrateProfile } from './profileRepository'

export type ValidationSummary = ProfileValidationSummary

interface ProfileFilePayload {
  readonly profile: CalibrationProfileV1
  readonly validation: ValidationSummary
}

interface ProfileFileEnvelope {
  readonly fileSchemaVersion: 1
  readonly checksum: string
  readonly payload: ProfileFilePayload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function exportProfileFile(
  profile: CalibrationProfileV1,
  validation: ValidationSummary,
): Promise<string> {
  const payload: ProfileFilePayload = { profile, validation }
  const checksum = await sha256(JSON.stringify(payload))
  const envelope: ProfileFileEnvelope = {
    fileSchemaVersion: 1,
    checksum,
    payload,
  }
  return JSON.stringify(envelope, null, 2)
}

export async function importProfileFile(value: string): Promise<ProfileFilePayload> {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new SyntaxError('Invalid JSON profile file')
  }

  if (!isRecord(parsed) || parsed.fileSchemaVersion !== 1) {
    throw new RangeError('Unsupported profile file schema')
  }
  if (!isRecord(parsed.payload) || !isRecord(parsed.payload.profile)) {
    throw new TypeError('Profile file payload is missing')
  }
  if (!Array.isArray(parsed.payload.profile.rawTrials)) {
    throw new TypeError('Profile file must contain raw trials')
  }
  if (typeof parsed.checksum !== 'string') {
    throw new TypeError('Profile file checksum is missing')
  }

  const expectedChecksum = await sha256(JSON.stringify(parsed.payload))
  if (expectedChecksum !== parsed.checksum) {
    throw new Error('Profile file checksum mismatch')
  }

  return {
    profile: migrateProfile(parsed.payload.profile),
    validation: isRecord(parsed.payload.validation)
      ? (parsed.payload.validation as unknown as ValidationSummary)
      : { passed: false },
  }
}
