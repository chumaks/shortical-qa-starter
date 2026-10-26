import type { Page } from '@playwright/test';

/** Home: the catalogue a new viewer lands on. */
export class HomePage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/');
  }

  /** Cards and links leading to series pages (/drama/<slug>). */
  dramaLinks() {
    return this.page.locator('a[href^="/drama/"]');
  }
}
