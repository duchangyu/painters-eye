import { expect, test } from '@playwright/test'
import { completeFirstRun } from './helpers'

test('strength zero is pixel-identical and hold-to-original keeps zoom', async ({
  page,
}) => {
  await completeFirstRun(page)
  await page.getByRole('button', { name: '查看夜间咖啡馆' }).click()

  const stage = page.getByTestId('artwork-stage')
  const source = page.locator('.viewer-source')
  await expect(source).toHaveClass(/active/)
  const original = await stage.screenshot({ animations: 'disabled' })

  await page.getByRole('button', { name: '开启个人增强' }).click()
  const strength = page.getByLabel('增强强度')
  await strength.focus()
  await page.keyboard.press('Home')
  await expect(strength).toHaveValue('0')
  await expect(source).toHaveClass(/active/)
  const zeroStrength = await stage.screenshot({ animations: 'disabled' })
  expect(zeroStrength.equals(original)).toBe(true)

  await page.keyboard.press('End')
  await page.getByRole('button', { name: '放大' }).click()
  await page.getByRole('button', { name: '放大' }).click()
  const zoomBefore = await stage.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--artwork-zoom'),
  )
  const output = page.locator('.viewer-output.active')
  await expect(output).toHaveCount(1)
  const positionBefore = await output.boundingBox()

  await stage.focus()
  await page.keyboard.down('Space')
  await expect(source).toHaveClass(/active/)
  expect(
    await stage.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--artwork-zoom'),
    ),
  ).toBe(zoomBefore)
  const originalPosition = await source.boundingBox()
  expect(positionBefore).not.toBeNull()
  expect(originalPosition).not.toBeNull()
  for (const coordinate of ['x', 'y', 'width', 'height'] as const) {
    expect(originalPosition![coordinate]).toBeCloseTo(
      positionBefore![coordinate],
      1,
    )
  }
  await page.keyboard.up('Space')
  await expect(source).not.toHaveClass(/active/)
})
