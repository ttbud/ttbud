import wall from "../../icon/wall/stone-wall.svg";
import beech from "../../icon/floor/beech.svg";
import swordman from "../../icon/token/swordman.svg";

// Jest doesn't support require.context, so for tests we just have a subset of
// the icons hardcoded
// noinspection JSUnusedGlobalSymbols
export const loadIcons = () => [
  {
    path: "./wall/stone-wall.svg",
    img: wall
  },
  {
    path: "./floor/beech.svg",
    img: beech
  },
  {
    path: "./token/swordman.svg",
    img: swordman
  }
];
