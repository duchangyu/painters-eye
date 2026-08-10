/**
 * Shortens otherwise perceptual test journeys for browser automation only.
 * Normal development and production builds always use the full protocol.
 */
export const isE2eMode = import.meta.env.MODE === 'e2e'
