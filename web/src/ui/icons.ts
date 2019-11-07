import beard from "../icon/beard.svg";
import bowman from "../icon/bowman.svg";
import elfHelmet from "../icon/elf-helmet.svg";
import entMouth from "../icon/ent-mouth.svg";
import kangaroo from "../icon/kangaroo.svg";
import suspicious from "../icon/suspicious.svg";
import swordsman from "../icon/swordman.svg";
import wolfHead from "../icon/wolf-head.svg";
import wall from "../icon/stone-wall.svg";
import stairs from "../icon/stairs.svg";
import door from "../icon/door.svg";

import { List, Map } from "immutable";

function byId(icons: List<Icon>): Map<string, Icon> {
  return Map(icons.map(icon => [icon.id, icon]));
}

export enum IconType {
  wall,
  token,
  floor
}

export interface Icon {
  id: string;
  img: string;
  type: IconType;
  desc: string;
}

export const WALL_ICON: Icon = {
  id: "e1fe6c14-48c4-40e2-8eec-56bdde988324",
  img: wall,
  type: IconType.wall,
  desc: "Wall"
};

export const ICONS: List<Icon> = List.of(
  {
    id: "a511ebd2-827b-490d-b20a-c206e4edd25e",
    img: beard,
    type: IconType.token,
    desc: "beard"
  },
  {
    id: "cde2b122-0023-472c-a083-9c8bcb5830aa",
    img: bowman,
    type: IconType.token,
    desc: "bowman"
  },
  {
    id: "0a2bd4c8-bf65-48bc-ac4a-2d0585c8226e",
    img: elfHelmet,
    type: IconType.token,
    desc: "elf helmet"
  },
  {
    id: "c8345331-d3d9-436b-abf9-054deac8fcc1",
    img: entMouth,
    type: IconType.token,
    desc: "ent mouth"
  },
  {
    id: "7d8445b4-5d80-43a7-aba5-863aa1617ca1",
    img: kangaroo,
    type: IconType.token,
    desc: "kangaroo"
  },
  {
    id: "46dd9a28-f5d9-4256-a679-d08295ed2995",
    img: suspicious,
    type: IconType.token,
    desc: "suspicious"
  },
  {
    id: "47341013-dd7f-44e2-8ee1-53ca59e2df60",
    img: swordsman,
    type: IconType.token,
    desc: "swordsman"
  },
  {
    id: "94db5586-2d18-4250-a874-58264fcb4b79",
    img: wolfHead,
    type: IconType.token,
    desc: "wolf head"
  },
  {
    id: "278a102e-643d-4a10-b945-22d1a2b42b3d",
    img: stairs,
    type: IconType.floor,
    desc: "stairs"
  },
  {
    id: "278a102e-643d-4a10-b945-22d1a2b42b3c",
    img: door,
    type: IconType.floor,
    desc: "door"
  },
  WALL_ICON
);

export const ICONS_BY_ID: Map<string, Icon> = byId(ICONS);
