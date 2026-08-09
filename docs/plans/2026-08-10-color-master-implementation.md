# Color Master MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first web app that calibrates one user's red-green color discrimination on one fixed display, saves the resulting profile, and applies a validated personalized color transform to a curated public-domain art gallery.

**Architecture:** A React single-page app owns the user flow. Pure TypeScript modules generate calibration stimuli, run adaptive staircases, fit a bounded color-compensation model, and build a 3D lookup table; IndexedDB stores raw trials and profiles. A WebGL2 renderer applies the lookup table in real time, with a CPU fallback that shares the same interpolation code.

**Tech Stack:** Node.js 22.12+; React; TypeScript; Vite; Color.js; IndexedDB via `idb`; Vitest; Testing Library; Playwright; WebGL2; Canvas 2D; `vite-plugin-pwa`.

---

## Execution rules

- Read `docs/plans/2026-08-10-color-master-design.md` before Task 1.
- Execute in a dedicated worktree on branch `codex/color-master-mvp`.
- Use @Code and @karpathy-guidelines for implementation. Use @frontend-design for Tasks 8–10.
- Follow TDD: write one failing test, run it, add the minimum implementation, rerun the test, then commit.
- Keep all color-science functions pure. UI components may call them but must not contain color math.
- Treat calibration as behavioral personalization, not medical diagnosis. Preserve this wording in UI copy and tests.
- Run `npm run check` before every milestone commit.

## Worktree setup

Run these commands from the repository root after this plan is committed:

```bash
git worktree add .worktrees/color-master-mvp -b codex/color-master-mvp
cd .worktrees/color-master-mvp
```

If Git reports that `.worktrees` is unignored, add `.worktrees/` to the root `.gitignore`, commit that change on `master`, then repeat the commands.

### Task 1: Scaffold the tested React application

**Files:**

- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `eslint.config.js`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles/global.css`
- Create: `.gitignore`

**Step 1: Initialize the package and install dependencies**

Run:

```bash
npm init -y
npm install react react-dom colorjs.io idb
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh @playwright/test vite-plugin-pwa fake-indexeddb sharp
```

Expected: `package.json` and `package-lock.json` exist; npm exits 0.

**Step 2: Add exact scripts and engine constraints**

Set these `package.json` fields:

```json
{
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test --project=chromium",
    "lint": "eslint .",
    "check": "npm run lint && npm run test:run && npm run build"
  }
}
```

Create Vite, TypeScript, ESLint, jsdom, and Testing Library configuration. Configure Vitest through `vite.config.ts` with `environment: "jsdom"` and `setupFiles: ["./src/test/setup.ts"]`.

**Step 3: Write the failing shell test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('explains the product boundary', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Color Master' })).toBeVisible()
    expect(screen.getByText(/不提供医学诊断/)).toBeVisible()
  })
})
```

**Step 4: Run the test and confirm failure**

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL because `src/App.tsx` does not exist.

**Step 5: Add the minimum app shell**

Create `src/App.tsx`:

```tsx
export function App() {
  return (
    <main>
      <h1>Color Master</h1>
      <p>个性化色彩补偿工具，不提供医学诊断。</p>
    </main>
  )
}
```

Wire it through `src/main.tsx`, add a restrained neutral theme in `src/styles/global.css`, and add standard Vite output, Playwright output, coverage, and `.worktrees/` entries to `.gitignore`.

**Step 6: Verify and commit**

Run: `npm run check`

Expected: lint, unit tests, type-check, and production build all pass.

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig*.json eslint.config.js src .gitignore
git commit -m "chore: scaffold Color Master web app"
```

### Task 2: Define domain types and deterministic randomness

**Files:**

- Create: `src/domain/calibration.ts`
- Create: `src/domain/profile.ts`
- Create: `src/lib/random.ts`
- Create: `src/lib/random.test.ts`

**Step 1: Write the failing deterministic-random test**

```ts
import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'

describe('createSeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createSeededRandom(42)
    const b = createSeededRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('returns values in [0, 1)', () => {
    const random = createSeededRandom(7)
    expect(Array.from({ length: 100 }, random).every((n) => n >= 0 && n < 1)).toBe(true)
  })
})
```

**Step 2: Run the test and confirm failure**

Run: `npm run test:run -- src/lib/random.test.ts`

Expected: FAIL because `createSeededRandom` is missing.

**Step 3: Implement the seeded generator**

```ts
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
```

Define discriminated types for `ConfusionAxis`, `Stimulus`, `TrialResponse`, `StaircaseState`, `CalibrationSession`, `DisplayConditions`, `ThresholdEstimate`, `CompensationParameters`, and versioned `CalibrationProfileV1`. Store raw colors as normalized sRGB tuples and timestamps as ISO strings.

**Step 4: Verify type safety and tests**

Run: `npm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/domain src/lib
git commit -m "feat: define calibration domain model"
```

### Task 3: Implement tested color-science primitives

**Files:**

- Create: `src/color/srgb.ts`
- Create: `src/color/matrix.ts`
- Create: `src/color/machadoMatrices.ts`
- Create: `src/color/machado.ts`
- Create: `src/color/machado.test.ts`
- Create: `src/color/README.md`

**Step 1: Write reference and invariant tests**

Test these behaviors:

```ts
import { describe, expect, it } from 'vitest'
import { decodeSrgb, encodeSrgb } from './srgb'
import { getMachadoMatrix, simulateCvd } from './machado'

describe('sRGB transfer functions', () => {
  it('round-trips representative channels', () => {
    for (const channel of [0, 0.02, 0.18, 0.5, 1]) {
      expect(encodeSrgb(decodeSrgb(channel))).toBeCloseTo(channel, 7)
    }
  })
})

describe('Machado CVD model', () => {
  it('matches the published protanomaly interpolation example', () => {
    const row = getMachadoMatrix('protan', 0.15)[0]
    expect(row[0]).toBeCloseTo(0.7869875, 5)
    expect(row[1]).toBeCloseTo(0.2694875, 5)
    expect(row[2]).toBeCloseTo(-0.0564735, 5)
  })

  it('keeps white neutral for every severity', () => {
    for (const channel of simulateCvd([1, 1, 1], 'deutan', 0.8)) {
      expect(channel).toBeCloseTo(1, 6)
    }
  })
})
```

**Step 2: Run tests and confirm failure**

Run: `npm run test:run -- src/color/machado.test.ts`

Expected: FAIL because color modules are absent.

**Step 3: Implement gamma-correct simulation**

Implement the standard sRGB transfer functions:

```ts
export const decodeSrgb = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

export const encodeSrgb = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
```

Check in the Machado 2010 precomputed matrices for protanomaly and deuteranomaly at severities 0.0–1.0 in increments of 0.1. Attribute the published dataset and its source in `src/color/README.md`. Interpolate matrix entries between adjacent severities, apply the matrix in linear sRGB, encode back to sRGB, and clamp only at output.

Do not copy the obsolete `color-blind` npm algorithm; its inherited license and older model do not meet this project's accuracy and reuse requirements.

**Step 4: Add edge-case tests**

Cover black, white, primary colors, severity 0 identity, severity bounds, NaN rejection, and interpolation at 0.15.

Run: `npm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/color
git commit -m "feat: add reference color vision model"
```

### Task 4: Generate reproducible pseudoisochromatic stimuli

**Files:**

- Create: `src/calibration/stimulus.ts`
- Create: `src/calibration/stimulus.test.ts`
- Create: `src/calibration/landoltMask.ts`
- Create: `src/calibration/renderPlate.ts`
- Create: `src/components/calibration/PlateCanvas.tsx`
- Create: `src/components/calibration/PlateCanvas.test.tsx`

**Step 1: Write failing stimulus tests**

```ts
import { describe, expect, it } from 'vitest'
import { createStimulus } from './stimulus'

describe('createStimulus', () => {
  it('is reproducible and balances target directions', () => {
    const first = createStimulus({ seed: 9, axis: 'deutan', delta: 0.04 })
    const second = createStimulus({ seed: 9, axis: 'deutan', delta: 0.04 })
    expect(first).toEqual(second)
    expect(['up', 'right', 'down', 'left']).toContain(first.direction)
  })

  it('keeps foreground and background luminance within tolerance', () => {
    const stimulus = createStimulus({ seed: 3, axis: 'protan', delta: 0.03 })
    expect(Math.abs(stimulus.foregroundLuminance - stimulus.backgroundLuminance)).toBeLessThan(0.02)
  })
})
```

**Step 2: Run tests and confirm failure**

Run: `npm run test:run -- src/calibration/stimulus.test.ts`

Expected: FAIL because `createStimulus` is missing.

**Step 3: Implement stimulus generation**

Use a four-orientation Landolt-C target instead of fixed digits. Generate dot centers and radii with `createSeededRandom`; classify each dot by whether its center falls inside the Landolt mask. Sample foreground and background around a common color center along the selected protan or deutan confusion direction. Match relative luminance before applying small, seeded within-class jitter.

Return all generated dot geometry in the `Stimulus`. The canvas renderer must only draw the returned model; it must not call `Math.random()`.

**Step 4: Test the canvas contract**

Mock the 2D context. Assert that `PlateCanvas` uses the supplied width, height, dot count, and accessible label. Provide four real HTML buttons for answers so the canvas never becomes the only accessible control.

Run: `npm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/calibration src/components/calibration
git commit -m "feat: generate calibration plates"
```

### Task 5: Build the adaptive calibration engine

**Files:**

- Create: `src/calibration/staircase.ts`
- Create: `src/calibration/staircase.test.ts`
- Create: `src/calibration/session.ts`
- Create: `src/calibration/session.test.ts`

**Step 1: Write failing staircase tests**

Test a two-correct-down, one-wrong-up staircase:

```ts
it('reduces delta after two consecutive correct answers', () => {
  const initial = createStaircase({ axis: 'deutan', startDelta: 0.12 })
  const once = updateStaircase(initial, true)
  const twice = updateStaircase(once, true)
  expect(once.delta).toBe(initial.delta)
  expect(twice.delta).toBeLessThan(initial.delta)
})

it('records a reversal when direction changes', () => {
  const descending = updateStaircase(updateStaircase(createStaircase(defaults), true), true)
  expect(updateStaircase(descending, false).reversals).toHaveLength(1)
})
```

**Step 2: Run tests and confirm failure**

Run: `npm run test:run -- src/calibration/staircase.test.ts`

Expected: FAIL because staircase functions are absent.

**Step 3: Implement the staircase**

Clamp delta to the displayable gamut. Finish after eight reversals or the configured safety limit. Estimate threshold from the median of the final six reversal deltas. Keep `updateStaircase` immutable.

**Step 4: Implement the session scheduler through tests**

Interleave protan, deutan, blue-yellow control, and luminance-control trials. Balance orientation counts. Insert seeded repeat trials without exposing which trials repeat. Mark a session `needs-more-data` when repeat disagreement or threshold spread exceeds configured limits.

Run: `npm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/calibration
git commit -m "feat: add adaptive calibration engine"
```

### Task 6: Fit a bounded personalized compensation model

**Files:**

- Create: `src/profile/fitProfile.ts`
- Create: `src/profile/fitProfile.test.ts`
- Create: `src/color/compensate.ts`
- Create: `src/color/compensate.test.ts`
- Create: `src/color/lut.ts`
- Create: `src/color/lut.test.ts`

**Step 1: Write failing profile-fit tests**

Create fixtures where deutan thresholds consistently exceed protan thresholds. Assert that the fitter selects `deutan`, returns severity and gains inside declared bounds, and reports lower confidence for inconsistent repeats.

```ts
const consistentProfile = fitProfile(consistentTrials)
const inconsistentProfile = fitProfile(inconsistentTrials)

expect(consistentProfile.deficiency).toBe('deutan')
expect(consistentProfile.severity).toBeGreaterThan(0)
expect(consistentProfile.severity).toBeLessThanOrEqual(1)
expect(consistentProfile.confidence).toBeGreaterThan(inconsistentProfile.confidence)
```

**Step 2: Run tests and confirm failure**

Run: `npm run test:run -- src/profile/fitProfile.test.ts`

Expected: FAIL because the fitter is absent.

**Step 3: Implement relative profile fitting**

Normalize protan and deutan thresholds against control thresholds. Select the dominant axis only when its confidence interval separates from the other; otherwise return `mixed`. Map normalized excess threshold to a bounded severity estimate and label it behavioral, not clinical.

**Step 4: Write failing compensation invariants**

Tests must prove:

- strength 0 is pixel identity;
- every output channel is finite and lies in `[0, 1]`;
- white, black, and neutral grays stay neutral;
- recommended strength keeps relative luminance within 0.03 for reference colors;
- after applying the fitted transform, the simulated user's Delta E for a held-out confusing pair increases;
- blue-yellow control-pair Delta E does not fall by more than 5%.

**Step 5: Implement bounded optimization and LUT generation**

Use Color.js for OKLab/OKLCH conversion, Delta E, and gamut mapping. For each candidate, compute the color detail lost under the fitted Machado simulation, encode that detail into the user's stronger blue-yellow and limited lightness channels, then simulate the candidate again. Grid-search bounded gains and minimize:

```text
objective = -mean(heldOutSimulatedDeltaE)
            + 0.25 * mean(normalObserverDeltaEFromOriginal)
            + luminancePenalty
            + controlAxisPenalty
```

Record the chosen gains and objective terms in the profile. Generate a 17×17×17 3D LUT for the recommended transform. Keep optimization deterministic and side-effect free.

Run: `npm run check`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/profile src/color
git commit -m "feat: fit personalized color compensation"
```

### Task 7: Persist, migrate, export, and import profiles

**Files:**

- Create: `src/storage/db.ts`
- Create: `src/storage/profileRepository.ts`
- Create: `src/storage/profileRepository.test.ts`
- Create: `src/storage/profileFile.ts`
- Create: `src/storage/profileFile.test.ts`
- Modify: `src/test/setup.ts`

**Step 1: Configure fake IndexedDB and write failing repository tests**

Import `fake-indexeddb/auto` from `src/test/setup.ts`. Test saving and loading drafts, promoting a validated profile, refusing an unsupported schema version, and preserving raw trials during migration.

**Step 2: Run tests and confirm failure**

Run: `npm run test:run -- src/storage`

Expected: FAIL because storage modules are absent.

**Step 3: Implement the database**

Use `idb` with database name `color-master`, version 1, and stores `sessions`, `profiles`, and `settings`. Keep one active profile per display fingerprint. Build the fingerprint only from browser-exposed non-sensitive values: screen dimensions, color depth, pixel ratio, and a user-supplied display nickname.

**Step 4: Implement file backup through tests**

Export a UTF-8 JSON file containing schema version, raw trials, fitted parameters, validation summary, display conditions, and checksummed payload. Reject malformed JSON, unknown versions, missing raw trials, and checksum mismatch without overwriting the stored profile.

Run: `npm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/storage src/test/setup.ts
git commit -m "feat: persist calibration profiles locally"
```

### Task 8: Implement setup and calibration screens

**Files:**

- Create: `src/app/AppFlow.tsx`
- Create: `src/app/useAppFlow.ts`
- Create: `src/components/setup/DisplaySetup.tsx`
- Create: `src/components/setup/DisplaySetup.test.tsx`
- Create: `src/components/calibration/CalibrationScreen.tsx`
- Create: `src/components/calibration/CalibrationScreen.test.tsx`
- Create: `src/components/common/ProgressBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/global.css`

**Step 1: Write failing setup-screen tests**

Assert that the screen asks for a display nickname, requires confirmation that Night Shift/True Tone/eye-comfort filters are off, records the brightness reminder, and cannot start until every required check is complete.

**Step 2: Run tests and confirm failure**

Run: `npm run test:run -- src/components/setup`

Expected: FAIL because `DisplaySetup` is absent.

**Step 3: Implement the setup screen**

Use semantic form controls, visible focus states, large targets, and neutral UI colors. Do not use red and green alone to encode progress or correctness. Persist display conditions before starting calibration.

**Step 4: Write and implement calibration-screen tests**

Test keyboard and pointer answers, progress updates, draft autosave after every response, pause/resume, and the rule that feedback never reveals the correct orientation during measurement.

Inject the calibration engine through props so tests can use a four-trial deterministic fixture. Production uses the full configured session.

Run: `npm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app src/components src/App.tsx src/styles/global.css
git commit -m "feat: add display setup and calibration flow"
```

### Task 9: Add blinded validation and transparent results

**Files:**

- Create: `src/validation/validationSession.ts`
- Create: `src/validation/validationSession.test.ts`
- Create: `src/validation/metrics.ts`
- Create: `src/validation/metrics.test.ts`
- Create: `src/components/results/ResultsScreen.tsx`
- Create: `src/components/results/ResultsScreen.test.tsx`
- Modify: `src/app/AppFlow.tsx`

**Step 1: Write failing blind-order tests**

Assert that unseen stimuli appear in seeded random order under `original`, `generic`, and `personalized` transforms; no UI-facing trial object exposes the transform label.

**Step 2: Implement the validation scheduler**

Keep validation stimuli disjoint from calibration seeds. Balance conditions and orientations. Store accuracy, reaction time, repeat consistency, and control-axis performance by condition.

**Step 3: Write failing metric tests**

Verify correct accuracy, median reaction time, threshold summaries, improvement deltas, and confidence labels. A profile passes only when personalized compensation beats original or generic compensation on the declared primary metric and does not breach control-axis limits.

**Step 4: Implement the results screen**

Show baseline and enhanced accuracy, median response time, protan/deutan thresholds, repeat consistency, control performance, confidence, and remaining limitations. Include this tested sentence: “这些结果描述当前显示器上的行为表现，不是医学诊断。”

Run: `npm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/validation src/components/results src/app/AppFlow.tsx
git commit -m "feat: validate and explain compensation results"
```

### Task 10: Build and verify the curated local gallery

**Files:**

- Create: `scripts/fetch-artworks.mjs`
- Create: `src/data/artworks.ts`
- Create: `src/data/artworks.test.ts`
- Create: `public/artworks/manifest.json`
- Create: `public/artworks/night-cafe.jpg`
- Create: `public/artworks/grapes-lemons-pears-apples.jpg`
- Create: `public/artworks/apples-pears.jpg`
- Create: `public/artworks/oleanders.jpg`
- Create: `public/artworks/women-picking-olives.jpg`
- Create: `public/artworks/great-wave.jpg`
- Create: `src/components/gallery/GalleryScreen.tsx`
- Create: `src/components/gallery/GalleryScreen.test.tsx`

**Step 1: Write failing metadata tests**

Require exactly six initial records. Every record must contain a stable ID, Chinese and original title, artist, date, local image path, object-page URL, image-source URL, `Public Domain` or `CC0` status, and a non-empty test rationale.

**Step 2: Run tests and confirm failure**

Run: `npm run test:run -- src/data/artworks.test.ts`

Expected: FAIL because gallery data is absent.

**Step 3: Implement the acquisition script**

Fetch metadata only from the approved object pages and museum APIs listed in the design. For The Met, require `isPublicDomain === true`; for the Art Institute of Chicago, require `is_public_domain === true`; for The Night Café, retain both the Yale object page and the public-domain Wikimedia image record. Resize to a 2000-pixel long edge with `sharp`, preserve ICC information when available, remove unrelated metadata, and write SHA-256 hashes into `manifest.json`.

The script must abort on missing rights data, changed object IDs, non-image responses, or hash mismatch. Never substitute a search-result image.

**Step 4: Run the script and inspect every image**

Run: `node scripts/fetch-artworks.mjs`

Expected: six JPEG files and a complete manifest. Manually compare each downloaded image with its museum object page before committing binaries.

**Step 5: Implement the gallery screen**

Display title, artist, date, and “为什么选择这幅作品”. Load only local image paths. Add an optional, visually secondary “使用自己的图片” entry without making upload part of onboarding.

Run: `npm run check`

Expected: PASS.

**Step 6: Commit**

```bash
git add scripts src/data src/components/gallery public/artworks
git commit -m "feat: add curated public-domain gallery"
```

### Task 11: Render personalized transforms in the artwork viewer

**Files:**

- Create: `src/rendering/trilinearLut.ts`
- Create: `src/rendering/trilinearLut.test.ts`
- Create: `src/rendering/cpuRenderer.ts`
- Create: `src/rendering/cpuRenderer.test.ts`
- Create: `src/rendering/webglRenderer.ts`
- Create: `src/rendering/shaders.ts`
- Create: `src/components/viewer/ArtworkViewer.tsx`
- Create: `src/components/viewer/ArtworkViewer.test.tsx`
- Modify: `src/app/AppFlow.tsx`

**Step 1: Write failing LUT interpolation tests**

Test corners, center points, boundaries, identity LUTs, and out-of-range rejection. A 2×2×2 identity LUT must return the input RGB within `1e-6`.

**Step 2: Implement shared trilinear interpolation**

Keep index calculation and interpolation in a pure module. The CPU and WebGL paths must use the same channel order and LUT layout.

**Step 3: Test and implement CPU rendering**

Given a small `ImageData` fixture and identity LUT, output bytes must match exactly. Given a known transform LUT, compare bytes against a checked-in expected fixture. Preserve alpha.

**Step 4: Implement WebGL2 rendering**

Upload the source image as a 2D texture and the profile LUT as a 3D texture. The fragment shader samples the LUT and linearly blends original and transformed color by the strength uniform. If WebGL2 context creation, texture upload, or shader compilation fails, return a typed error and activate the CPU renderer.

**Step 5: Implement viewer interactions through component tests**

The viewer must:

- open on “原始数字图像”;
- enable “个人增强” explicitly;
- use the calibrated recommendation as the initial enhanced strength;
- show the original while pointer or Space is held, and restore enhancement on release;
- expose a 0%–100% strength slider;
- support zoom and optional side-by-side mode;
- reveal color interpretation only after the user requests it.

Run: `npm run check`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/rendering src/components/viewer src/app/AppFlow.tsx
git commit -m "feat: add real-time artwork compensation viewer"
```

### Task 12: Add profile backup, quick checks, and recalibration rules

**Files:**

- Create: `src/components/profile/ProfileSettings.tsx`
- Create: `src/components/profile/ProfileSettings.test.tsx`
- Create: `src/calibration/quickCheck.ts`
- Create: `src/calibration/quickCheck.test.ts`
- Modify: `src/app/AppFlow.tsx`

**Step 1: Write failing quick-check tests**

Create a short seeded set of control and dominant-axis trials. Pass when performance stays inside the saved profile's confidence bounds; return `review-display-settings` for borderline results and `recalibrate` for clear drift.

**Step 2: Implement quick checks**

Run the check at most once per configured interval and whenever the display fingerprint changes. Never delete the old profile automatically. Let the user enter the gallery in original-only mode after failure.

**Step 3: Implement backup controls through tests**

Test export download, import preview, explicit confirmation, safe rejection, and restoration of the previous profile after a failed import.

Run: `npm run check`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/profile src/calibration src/app/AppFlow.tsx
git commit -m "feat: add reusable profile controls"
```

### Task 13: Make the app offline-capable and test complete journeys

**Files:**

- Create: `playwright.config.ts`
- Create: `e2e/onboarding.spec.ts`
- Create: `e2e/profile-reuse.spec.ts`
- Create: `e2e/gallery-viewer.spec.ts`
- Create: `e2e/offline.spec.ts`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Modify: `vite.config.ts`
- Modify: `package.json`

**Step 1: Configure Playwright and write a failing onboarding journey**

Use Chromium first because the MVP targets one fixed computer. Start Vite through `webServer`. Inject a reduced deterministic calibration configuration through a test-only build variable; production builds must ignore it.

The onboarding test must complete display setup, answer the short calibration, finish blinded validation, save a profile, and reach the gallery.

**Step 2: Run the test and confirm failure**

Run: `npm run test:e2e -- e2e/onboarding.spec.ts`

Expected: FAIL until the flow wiring is complete.

**Step 3: Complete app-flow wiring**

Connect first-run setup, calibration, validation, results, gallery, viewer, quick check, and profile settings. Use persisted state to resume the correct screen after reload.

**Step 4: Add PWA caching**

Configure `vite-plugin-pwa` to precache the application shell, six local art images, manifest, and icons. Do not cache external museum pages. Show a clear offline status without blocking local use.

**Step 5: Add remaining end-to-end tests**

Verify:

- a saved profile survives reload and skips full calibration;
- hold-to-original restores the same image position and zoom;
- strength 0 matches the original screenshot;
- offline reload still opens the gallery and viewer;
- a changed display nickname triggers quick check;
- keyboard-only users can complete setup, calibration, and comparison.

Run:

```bash
npx playwright install chromium
npm run test:e2e
npm run check
```

Expected: all Chromium journeys and all static/unit checks pass.

**Step 6: Commit**

```bash
git add playwright.config.ts e2e public/icons vite.config.ts package.json package-lock.json src
git commit -m "test: verify complete offline user journeys"
```

### Task 14: Document validation limits and release the MVP candidate

**Files:**

- Create: `README.md`
- Create: `docs/validation-protocol.md`
- Create: `docs/manual-display-checklist.md`
- Modify: `docs/plans/2026-08-10-color-master-design.md`

**Step 1: Write the manual validation protocol**

Document the fixed display, browser version, display mode, brightness setting, ambient-light conditions, user profile version, calibration duration, held-out validation metrics, and artwork observations. Separate automated software validation from human perceptual validation.

**Step 2: Write the README**

Include prerequisites, install/run/test commands, local-data behavior, profile backup, artwork licenses, algorithm references, known limits, and the explicit non-diagnostic disclaimer.

**Step 3: Run the complete quality gate**

Run:

```bash
npm ci
npm run check
npm run test:e2e
git diff --check
git status --short
```

Expected: all commands pass; only intended documentation changes remain before the final commit.

**Step 4: Perform the fixed-display manual trial**

Follow `docs/manual-display-checklist.md`. Record actual results without substituting illustrative values. If personalized compensation fails to beat the baseline or damages controls, mark the build experimental and return to Task 6; do not change the success criteria after seeing results.

**Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: prepare Color Master MVP validation"
```

## Milestone gates

1. **Calibration engine:** Tasks 1–5 pass unit and component tests.
2. **Personalization model:** Task 6 passes reference, invariant, and held-out-pair tests.
3. **Reusable local profile:** Tasks 7–9 save raw data and report blind validation honestly.
4. **Art experience:** Tasks 10–12 deliver licensed local art and real-time comparison.
5. **MVP candidate:** Tasks 13–14 pass automated checks and one documented fixed-display human trial.

## Official implementation references

- [Vite getting started](https://vite.dev/guide/)
- [React with TypeScript](https://react.dev/learn/typescript)
- [Vitest getting started](https://vitest.dev/guide/)
- [Playwright installation](https://playwright.dev/docs/intro)
- [Color.js installation and API](https://colorjs.io/get/)
- [Machado color-vision model implementation reference](https://colour.readthedocs.io/en/latest/generated/colour.matrix_cvd_Machado2009.html)
- `docs/plans/2026-08-10-color-master-design.md`

## Execution handoff

Plan complete. Choose one execution mode:

1. **Subagent-Driven (this session):** dispatch a fresh implementation subagent per task and review after each task.
2. **Parallel Session (separate):** open a new task in the implementation worktree and use `executing-plans` with milestone checkpoints.
