describe('a', () => {
  it('b', async () => {
    const el = await $('android=new UiSelector().text("Episodes")'); // expect: selectors-in-one-file no-raw-locators-in-specs
    await $(S.episodeCounter).waitForDisplayed(); // expect: no-raw-locators-in-specs
    await browser.pause(5000); // expect: no-fixed-wait
    await player.counter.waitForDisplayed();
  });
  it.only('c', async () => {}); // expect: no-only
});
