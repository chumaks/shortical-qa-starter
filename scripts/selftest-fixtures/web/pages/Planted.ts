export class Planted {
  async wait() {
    await this.page.waitForTimeout(500); // expect: no-fixed-wait
    await this.page.locator('#ok').waitFor({ timeout: 10_000 });
    await this.page.locator('input').type('x'); // expect: no-prod-writes
  }
}
