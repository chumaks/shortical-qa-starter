export const sel = '~episodes-button'; // expect: selectors-in-one-file
export async function buy() {
  await $(S.vipButton).click(); // expect: no-prod-writes
  await (await $(S.emailInput)).setValue('qa@example.com'); // expect: no-prod-writes
}
