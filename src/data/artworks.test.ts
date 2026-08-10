import { describe, expect, it } from 'vitest'
import { ARTWORKS } from './artworks'

describe('curated artwork metadata', () => {
  it('contains exactly six stable, licensed local records', () => {
    expect(ARTWORKS).toHaveLength(6)
    expect(new Set(ARTWORKS.map((artwork) => artwork.id)).size).toBe(6)

    for (const artwork of ARTWORKS) {
      expect(artwork.id).toMatch(/^[a-z0-9-]+$/)
      expect(artwork.titleZh.trim()).not.toBe('')
      expect(artwork.titleOriginal.trim()).not.toBe('')
      expect(artwork.artist.trim()).not.toBe('')
      expect(artwork.date.trim()).not.toBe('')
      expect(artwork.imagePath).toMatch(/^\/artworks\/[a-z0-9-]+\.jpg$/)
      expect(artwork.objectPageUrl).toMatch(/^https:\/\//)
      expect(artwork.imageSourceUrl).toMatch(/^https:\/\//)
      expect(['Public Domain', 'CC0']).toContain(artwork.rights)
      expect(artwork.rationale.trim().length).toBeGreaterThan(12)
    }
  })

  it('uses the approved museum collection', () => {
    expect(ARTWORKS.map((artwork) => artwork.id)).toEqual([
      'night-cafe',
      'roses',
      'apples-pears',
      'oleanders',
      'women-picking-olives',
      'great-wave',
    ])
  })
})
