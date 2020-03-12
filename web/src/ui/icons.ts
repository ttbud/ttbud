import { List, Map } from "immutable";
import { loadIcons } from "./icon-loader";

function byId(icons: List<Icon>): Map<string, Icon> {
  return Map(icons.map(icon => [icon.id, icon]));
}

export interface Icon {
  id: string;
  img: string;
  desc: string;
}

export const ICONS = List(
  loadIcons().map(({ path, img }) => {
    const [, name] = path.match(/\/(.*)\.svg/);
    return {
      id: path,
      img,
      desc: name.replace("-", " ")
    };
  })
);

export const ICONS_BY_ID = byId(ICONS);

export const WALL_ICON = ICONS_BY_ID.get("./stone-wall.svg")!;

// Don't change these without also changing src/ui/__mocks__/icon-loader.ts
export const DEFAULT_FLOOR_ICONS = [
  WALL_ICON,
  ICONS_BY_ID.get("./bed.svg")!,
  ICONS_BY_ID.get("./wooden-crate.svg")!,
  ICONS_BY_ID.get("./locked-chest.svg")!,
  ICONS_BY_ID.get("./door.svg")!
];

export const DEFAULT_CHARACTER_ICONS = [
  ICONS_BY_ID.get("./archer.svg")!,
  ICONS_BY_ID.get("./bandit.svg")!,
  ICONS_BY_ID.get("./bear-head.svg")!,
  ICONS_BY_ID.get("./beard.svg")!,
  ICONS_BY_ID.get("./cowled.svg")!
];
