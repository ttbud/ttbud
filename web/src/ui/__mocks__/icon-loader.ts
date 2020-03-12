import wall from "../../icon/stone-wall.svg";
import bed from "../../icon/bed.svg";
import crate from "../../icon/wooden-crate.svg";
import chest from "../../icon/locked-chest.svg";
import door from "../../icon/door.svg";
import archer from "../../icon/archer.svg";
import bandit from "../../icon/bandit.svg";
import head from "../../icon/bear-head.svg";
import beard from "../../icon/beard.svg";
import cowled from "../../icon/cowled.svg";

// Jest doesn't support require.context, so for tests we just have the default
// icons hardcoded
// noinspection JSUnusedGlobalSymbols
export const loadIcons = () => [
  { path: "./stone-wall.svg", img: wall },
  { path: "./bed.svg", img: bed },
  { path: "./wooden-crate.svg", img: crate },
  { path: "./locked-chest.svg", img: chest },
  { path: "./door.svg", img: door },
  { path: "./archer.svg", img: archer },
  { path: "./bandit.svg", img: bandit },
  { path: "./bear-head.svg", img: head },
  { path: "./beard.svg", img: beard },
  { path: "./cowled.svg", img: cowled }
];
