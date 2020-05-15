import "expect-puppeteer";
import dragTo from "./dragTo";
import config from "./config";

function trayCharSelector(character: string) {
  return `[aria-label="Character Tray"] [aria-label="Character: ${character}"]`;
}

function boardCharSelector(character: string) {
  return `[aria-label="Board"] [aria-label="Character: ${character}"]`;
}

describe("TTBud", () => {
  it("Synchronizes actions between pages", async () => {
    const pageOne = await browser.newPage();
    const pageTwo = await browser.newPage();
    await pageOne.goto(config.domain);

    const trayArcher = trayCharSelector("archer");
    const boardArcher = boardCharSelector("archer");

    // Drag an archer out on the first page
    await dragTo(pageOne, trayArcher, { x: 0, y: 0 });
    await expect(pageOne).toMatchElement(boardArcher);

    // Archer should show up on the second page
    await pageTwo.goto(pageOne.url());
    const archer = await expect(pageTwo).toMatchElement(boardArcher);

    // Delete archer on second page
    await archer.click({ button: "right" });

    // Should disappear from first page
    await expect(pageOne).not.toMatchElement(boardArcher);
  });
});
