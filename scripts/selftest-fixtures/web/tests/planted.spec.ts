// Planted defects. Each line that must be flagged ends with "expect: <rule>".
// Lines without a marker must stay clean. Not compiled, not run.
test('a', async ({ page }) => {
  await page.waitForTimeout(3000); // expect: no-fixed-wait
  await page.waitForTimeout(3000); // lint-allow: documented observation window
  await expect(x).toBeVisible({ timeout: 45_000 }); // expect: wait-cap
  await expect(x).toBeVisible({ timeout: 30_000 });
  const a = page.locator('a[href]'); // expect: no-raw-locators-in-specs
  const b = page.getByText('Episodes'); // expect: no-raw-locators-in-specs
  await player.gate().email.fill('qa@example.com'); // expect: no-prod-writes
  await player.gate().continue.click(); // expect: no-prod-writes
  await player.gate().continue.click(); // expect: no-prod-writes lint-allow: trying to bypass the hard rule
  await player.counter().click();
  test.fail(true, 'no reference'); // expect: known-bug-needs-finding
  test.fail(true, 'FINDINGS #7: not in findings'); // expect: known-bug-needs-finding
  test.fail(true, 'FINDINGS #1: exists');
  // await page.waitForTimeout(1000) in a comment is fine
});
test.only('b', async () => {}); // expect: no-only
