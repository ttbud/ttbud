import { Page } from "@playwright/test";
import { assert } from "./invariants";

export interface Pos {
  x: number;
  y: number;
}

export default async function dragTo(page: Page, selector: string, dest: Pos) {
  const element = await page.waitForSelector(selector);
  const boundingBox = await element.boundingBox();
  assert(boundingBox, `Element ${selector} is not visible`);

  await page.mouse.move(
    boundingBox.x + boundingBox.width / 2,
    boundingBox.y + boundingBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(dest.x, dest.y);
  await page.mouse.up();
}
