// Supabase Edge Function: profiles
//
// Routes (all relative to /functions/v1/profiles):
//   GET    /            -> list the caller's cloud profiles (metadata only)
//   GET    /:id         -> download one profile including profile_data
//   POST   /            -> upload a new profile
//   DELETE /:id         -> delete one profile
//
// Auth: the caller sends a Clerk session JWT in `Authorization: Bearer ...`.
// The token is verified against Clerk's JWKS endpoint and the `sub` claim is
// used as user_id. Postgres access uses the service-role key; every query is
// scoped to the authenticated user's id.
//
// Required env vars (set via `supabase secrets set`):
//   CLERK_JWKS_URL            - e.g. https://<clerk-frontend-api>/.well-known/jwks.json
//   SUPABASE_URL              - injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY - injected automatically by Supabase
//
// Note: disable the gateway JWT check for this function (verify_jwt = false in
// supabase/config.toml) because we verify the Clerk JWT ourselves.

import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@5.9.6'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_NAME_LENGTH = 200
const MAX_BODY_BYTES = 2_000_000

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse(status, { error: message })
}

/** Verify the Clerk session JWT and return the user id (`sub` claim). */
async function authenticate(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing Authorization bearer token.')
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    throw new AuthError('Missing Authorization bearer token.')
  }

  const jwksUrl = Deno.env.get('CLERK_JWKS_URL')
  if (!jwksUrl) {
    console.error('CLERK_JWKS_URL is not configured')
    throw new AuthError('Authentication service is not configured.')
  }

  const jwks = createRemoteJWKSet(new URL(jwksUrl))
  try {
    const { payload } = await jwtVerify(token, jwks)
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new AuthError('Token is missing a subject claim.')
    }
    return payload.sub
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw new AuthError('Invalid or expired session token.')
  }
}

class AuthError extends Error {}

interface UploadBody {
  name: string
  display_conditions: unknown
  profile_data: unknown
  validation_summary: unknown
  algorithm_version: string
}

function validateUploadBody(body: unknown): UploadBody {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Request body must be a JSON object.')
  }
  const candidate = body as Record<string, unknown>

  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    throw new ValidationError('Field "name" is required.')
  }
  if (candidate.name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`Field "name" must be at most ${MAX_NAME_LENGTH} characters.`)
  }
  if (typeof candidate.algorithm_version !== 'string' || candidate.algorithm_version.length === 0) {
    throw new ValidationError('Field "algorithm_version" is required.')
  }
  if (typeof candidate.display_conditions !== 'object' || candidate.display_conditions === null) {
    throw new ValidationError('Field "display_conditions" is required.')
  }
  if (typeof candidate.profile_data !== 'object' || candidate.profile_data === null) {
    throw new ValidationError('Field "profile_data" is required.')
  }
  const profileData = candidate.profile_data as Record<string, unknown>
  if (profileData.schemaVersion !== 1 || typeof profileData.id !== 'string') {
    throw new ValidationError('Field "profile_data" must be a CalibrationProfileV1 object.')
  }
  if (candidate.validation_summary !== null && typeof candidate.validation_summary !== 'object') {
    throw new ValidationError('Field "validation_summary" must be an object or null.')
  }

  return {
    name: candidate.name.trim(),
    display_conditions: candidate.display_conditions,
    profile_data: candidate.profile_data,
    validation_summary: candidate.validation_summary ?? null,
    algorithm_version: candidate.algorithm_version,
  }
}

class ValidationError extends Error {}

/** Strip the function-name prefix and return path segments, e.g. ["<id>"]. */
function extractSegments(url: URL): string[] {
  return url.pathname
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== 'profiles')
}

async function handleList(supabase: SupabaseClient, userId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, name, display_conditions, validation_summary, algorithm_version, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('list profiles failed', { userId, error: error.message })
    return errorResponse(500, 'Failed to load cloud profiles.')
  }
  return jsonResponse(200, { profiles: data ?? [] })
}

async function handleDownload(
  supabase: SupabaseClient,
  userId: string,
  profileId: string,
): Promise<Response> {
  if (!UUID_PATTERN.test(profileId)) {
    return errorResponse(400, 'Invalid profile id.')
  }
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, name, display_conditions, profile_data, validation_summary, algorithm_version, created_at, updated_at')
    .eq('user_id', userId)
    .eq('id', profileId)
    .maybeSingle()

  if (error) {
    console.error('download profile failed', { userId, profileId, error: error.message })
    return errorResponse(500, 'Failed to load cloud profile.')
  }
  if (!data) {
    return errorResponse(404, 'Cloud profile not found.')
  }
  return jsonResponse(200, { profile: data })
}

async function handleUpload(req: Request, supabase: SupabaseClient, userId: string): Promise<Response> {
  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'Profile payload is too large.')
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return errorResponse(400, 'Request body must be valid JSON.')
  }

  let body: UploadBody
  try {
    body = validateUploadBody(rawBody)
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(400, error.message)
    }
    throw error
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      user_id: userId,
      name: body.name,
      display_conditions: body.display_conditions,
      profile_data: body.profile_data,
      validation_summary: body.validation_summary,
      algorithm_version: body.algorithm_version,
    })
    .select('id, name, display_conditions, validation_summary, algorithm_version, created_at, updated_at')
    .single()

  if (error) {
    console.error('upload profile failed', { userId, error: error.message })
    return errorResponse(500, 'Failed to save cloud profile.')
  }
  return jsonResponse(201, { profile: data })
}

async function handleDelete(
  supabase: SupabaseClient,
  userId: string,
  profileId: string,
): Promise<Response> {
  if (!UUID_PATTERN.test(profileId)) {
    return errorResponse(400, 'Invalid profile id.')
  }
  const { data, error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('user_id', userId)
    .eq('id', profileId)
    .select('id')

  if (error) {
    console.error('delete profile failed', { userId, profileId, error: error.message })
    return errorResponse(500, 'Failed to delete cloud profile.')
  }
  if (!data || data.length === 0) {
    return errorResponse(404, 'Cloud profile not found.')
  }
  return new Response(null, { status: 204, headers: corsHeaders })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let userId: string
  try {
    userId = await authenticate(req)
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(401, error.message)
    }
    throw error
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const segments = extractSegments(new URL(req.url))
  const profileId = segments[0]

  if (req.method === 'GET' && segments.length === 0) {
    return handleList(supabase, userId)
  }
  if (req.method === 'GET' && segments.length === 1 && profileId) {
    return handleDownload(supabase, userId, profileId)
  }
  if (req.method === 'POST' && segments.length === 0) {
    return handleUpload(req, supabase, userId)
  }
  if (req.method === 'DELETE' && segments.length === 1 && profileId) {
    return handleDelete(supabase, userId, profileId)
  }
  return errorResponse(404, 'Not found.')
})
