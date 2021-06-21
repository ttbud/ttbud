import { expect, Page } from "@playwright/test";

export type WaitForSelectorOptions = Parameters<Page["waitForSelector"]>[1];
export type State = WaitForSelectorOptions["state"];

declare global {
  export namespace PlaywrightTest {
    export interface Matchers<R> {
      toContainSelector(selector: string, options?: WaitForSelectorOptions): R;
    }
  }
}

interface Opposites {
  [key: string]: State;
}

const opposites: Opposites = {
  visible: "hidden",
  hidden: "visible",
  attached: "detached",
  detached: "attached",
};

expect.extend({
  async toContainSelector(
    received: Page,
    selector: string,
    options: WaitForSelectorOptions = {}
  ) {
    options.timeout = 500;
    if (this.isNot) {
      options.state = opposites[options.state ?? "attached"];
    }
    try {
      await received.waitForSelector(selector, options);
      return { pass: !this.isNot };
    } catch (e) {
      return {
        message: () => {
          const expectation = this.isNot ? "not to contain" : "to contain";
          return `Expected page ${expectation} selector ${selector}.`;
        },
        pass: this.isNot,
      };
    }
  },
});
