import type { CalibrationProfileV1 } from "../domain/profile";
import { migrateProfile } from "../storage/profileRepository";
import type { CloudClient } from "./cloudClient";

/**
 * Repository for calibration profiles stored in Supabase Postgres via the
 * `profiles` Edge Function. The server derives the user id from the Clerk
 * JWT, so callers never pass a user id.
 */

export interface CloudProfileSummary {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly algorithmVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly validationSummary: CalibrationProfileV1["validation"];
}

export interface CloudProfileDownload {
  readonly summary: CloudProfileSummary;
  readonly profile: CalibrationProfileV1;
}

export interface UploadCloudProfileInput {
  /** User-recognizable label, e.g. "MacBook Pro 2024". */
  readonly name: string;
  readonly profile: CalibrationProfileV1;
}

/** Shape of a row returned by the Edge Function (snake_case Postgres columns). */
interface CloudProfileRow {
  readonly id: string;
  readonly name: string;
  readonly display_conditions: CalibrationProfileV1["displayConditions"];
  readonly profile_data?: CalibrationProfileV1;
  readonly validation_summary: CalibrationProfileV1["validation"] | null;
  readonly algorithm_version: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ListProfilesResponse {
  readonly profiles: readonly CloudProfileRow[];
}

interface UploadProfileResponse {
  readonly profile: CloudProfileRow;
}

interface DownloadProfileResponse {
  readonly profile: CloudProfileRow;
}

function toSummary(row: CloudProfileRow): CloudProfileSummary {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_conditions.displayNickname,
    algorithmVersion: row.algorithm_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    validationSummary: row.validation_summary ?? undefined,
  };
}

export async function listCloudProfiles(
  client: CloudClient,
): Promise<readonly CloudProfileSummary[]> {
  const response = await client.request<ListProfilesResponse>(
    "GET",
    "/profiles",
  );
  return response.profiles.map(toSummary);
}

export async function uploadCloudProfile(
  client: CloudClient,
  input: UploadCloudProfileInput,
): Promise<CloudProfileSummary> {
  const { name, profile } = input;
  const response = await client.request<UploadProfileResponse>(
    "POST",
    "/profiles",
    {
      name,
      display_conditions: profile.displayConditions,
      profile_data: profile,
      validation_summary: profile.validation ?? null,
      algorithm_version: profile.algorithmVersion,
    },
  );
  return toSummary(response.profile);
}

export async function downloadCloudProfile(
  client: CloudClient,
  profileId: string,
): Promise<CloudProfileDownload> {
  const response = await client.request<DownloadProfileResponse>(
    "GET",
    `/profiles/${encodeURIComponent(profileId)}`,
  );
  if (!response.profile.profile_data) {
    throw new Error("Cloud profile is missing its calibration data.");
  }
  const validatedProfile = migrateProfile(response.profile.profile_data);
  return {
    summary: toSummary(response.profile),
    profile: validatedProfile,
  };
}

export async function deleteCloudProfile(
  client: CloudClient,
  profileId: string,
): Promise<void> {
  await client.request<void>(
    "DELETE",
    `/profiles/${encodeURIComponent(profileId)}`,
  );
}
