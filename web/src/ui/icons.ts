import { loadIcons } from "./icon-loader";
import { assert } from "../util/invariants";

function byId(icons: Icon[]): Map<string, Icon> {
  return new Map(icons.map((icon) => [icon.id, icon]));
}

export interface Icon {
  id: string;
  img: string;
  desc: string;
}

export const ICONS = loadIcons().map(({ path, img }) => {
  const match = path.match(/\/(.*)\.svg/);
  assert(match, `Invalid icon path ${path}`);
  const [, name] = match;
  return {
    id: path,
    img,
    desc: name.replace("-", " "),
  };
});

export const ICONS_BY_ID = byId(ICONS);

export const WALL_ICON = ICONS_BY_ID.get("./stone-wall.svg")!;
export const STACK_ICON = ICONS_BY_ID.get("./stack.svg")!;

// Don't change these without also changing src/ui/__mocks__/icon-loader.ts
export const DEFAULT_FLOOR_ICONS = [
  WALL_ICON,
  ICONS_BY_ID.get("./bed.svg")!,
  ICONS_BY_ID.get("./wooden-crate.svg")!,
  ICONS_BY_ID.get("./locked-chest.svg")!,
  ICONS_BY_ID.get("./door.svg")!,
];

export const DEFAULT_CHARACTER_ICONS = [
  ICONS_BY_ID.get("./archer.svg")!,
  ICONS_BY_ID.get("./bandit.svg")!,
  ICONS_BY_ID.get("./bear-head.svg")!,
  ICONS_BY_ID.get("./beard.svg")!,
  ICONS_BY_ID.get("./cowled.svg")!,
];
