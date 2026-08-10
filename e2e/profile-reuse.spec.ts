import { expect, test } from '@playwright/test'
import { answerTrial, completeFirstRun } from './helpers'

test('a validated profile survives reload and skips full calibration', async ({
  page,
}) => {
  await completeFirstRun(page)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '从熟悉的作品开始看' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '开始校准' })).toHaveCount(0)

  await page.getByRole('button', { name: '配置与备份' }).click()
  await expect(page.getByText('当前配置：书房显示器')).toBeVisible()
})

test('a changed display nickname requires the short check', async ({ page }) => {
  await completeFirstRun(page)
  await page.evaluate(() => {
    const key = 'color-master:display-conditions'
    const conditions = JSON.parse(localStorage.getItem(key) ?? '{}')
    conditions.displayNickname = '客厅显示器'
    localStorage.setItem(key, JSON.stringify(conditions))
  })
  await page.reload()

  await expect(page.getByText('配置短复核 · 8 题')).toBeVisible()
  for (let index = 0; index < 8; index += 1) {
    await answerTrial(page, true)
  }
  await expect(
    page.getByRole('heading', { name: '从熟悉的作品开始看' }),
  ).toBeVisible()
})
