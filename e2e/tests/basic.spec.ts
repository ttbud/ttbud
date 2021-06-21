import { test, expect } from "@playwright/test";
import config from "./config";
import dragTo from "./util/dragTo";
import "./util/page-expectations";

function trayCharSelector(character: string) {
  return `[aria-label="Character Tray"] [aria-label="Character: ${character}"]`;
}

function trayFloorSelector(floor: string) {
  return `[aria-label="Floor Tray"] [aria-label="Floor: ${floor}"]`;
}

function boardCharSelector(character: string) {
  return `[aria-label="Board"] [aria-label="Character: ${character}"]`;
}

function boardFloorSelector(floor: string) {
  return `[aria-label="Board"] [aria-label="Floor: ${floor}"]`;
}

test("characters sync between pages", async ({ context }) => {
  const pageOne = await context.newPage();
  const pageTwo = await context.newPage();
  await pageOne.goto(config.domain);
  await pageTwo.goto(pageOne.url());

  const trayArcher = trayCharSelector("archer");
  const boardArcher = boardCharSelector("archer");

  // Drag an archer out on the first page
  await dragTo(pageOne, trayArcher, { x: 0, y: 0 });
  await expect(pageOne).toContainSelector(boardArcher);

  // Archer should show up on the second page
  const pageTwoArcher = await pageTwo.waitForSelector(boardArcher);

  // Delete archer on second page
  await pageTwoArcher.click({ button: "right" });

  // Should disappear from first page
  await expect(pageOne).not.toContainSelector(boardArcher);
});

test("floors sync between pages", async ({ context }) => {
  const pageOne = await context.newPage();
  const pageTwo = await context.newPage();
  await pageOne.goto(config.domain);
  await pageTwo.goto(pageOne.url());

  const trayWall = trayFloorSelector("stone wall");
  const boardWall = boardFloorSelector("stone wall");

  // Select the wall from the floor tray and draw one in the top left
  await pageOne.click(trayWall);
  await pageOne.mouse.click(10, 10);
  await expect(pageOne).toContainSelector(boardWall);

  // Archer should show up on the second page
  const pageTwoWall = await pageTwo.waitForSelector(boardWall);

  // Delete archer on second page
  await pageTwoWall.click({ button: "right" });

  // Should disappear from first page
  await expect(pageOne).not.toContainSelector(boardWall);
});
