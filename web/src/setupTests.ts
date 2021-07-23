import "pepjs";
import "@testing-library/jest-dom/extend-expect";
import { act } from "@testing-library/react";

jest.mock("./ui/icon-loader.ts");

// Mock out scrollTo since jsdom doesn't support it
// @ts-ignore
global.scrollTo = jest.fn();

// Always use fake timers
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

// Useless export to convince typescript that this is a module
// https://stackoverflow.com/questions/56577201/why-is-isolatedmodules-error-fixed-by-any-import/56577324
export {};
