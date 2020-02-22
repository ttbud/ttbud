import { List, Map } from "immutable";
import { loadIcons } from "./icon-loader";

function byId(icons: List<Icon>): Map<string, Icon> {
  return Map(icons.map(icon => [icon.id, icon]));
}

export enum IconType {
  Wall = "wall",
  token = "token",
  floor = "floor"
}

export interface Icon {
  id: string;
  img: string;
  type: IconType;
  desc: string;
}

export const ICONS = List(
  loadIcons().map(({ path, img }) => {
    const [, typeName, name] = path.match(/\/(.*)\/(.*)\.svg/);
    const type = IconType[typeName as keyof typeof IconType];
    return {
      id: path,
      img,
      type,
      desc: name.replace("-", " ")
    };
  })
);

export const ICONS_BY_ID = byId(ICONS);
export const WALL_ICON = ICONS_BY_ID.get("./wall/stone-wall.svg")!;
