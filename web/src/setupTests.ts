jest.mock("./ui/icon-loader.ts");

// Mock out scrollTo since jsdom doesn't support it
// @ts-ignore
global.scrollTo = jest.fn();

// Useless export to convince typescript that this is a module
// https://stackoverflow.com/questions/56577201/why-is-isolatedmodules-error-fixed-by-any-import/56577324
export {};
