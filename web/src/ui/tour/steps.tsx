import { ReactourStep } from "reactour";
import isMac from "../../util/isMac";
import { Typography } from "@material-ui/core";
import React from "react";
import ShortcutText from "./ShortcutText";
import TourPopupContent from "./TourPopupContent";

const searchShortcut = isMac() ? "command+f" : "control+f";

const steps: ReactourStep[] = [
  {
    selector: "[data-tour=character-tray]",
    content: (
      <TourPopupContent
        title="Character Tray"
        notes={[
          "Tokens from this tray can be moved after placing them",
          "Click-and-drag to place these tokens on the board, or to move them around",
        ]}
      />
    ),
  },
  {
    selector: "[data-tour=floor-tray]",
    content: (
      <TourPopupContent
        title="Environment Tray"
        notes={[
          "Use icons from this tray to create your environment",
          "Left-click to select an icon, and left-click empty squares on the board to place your icon",
        ]}
      />
    ),
  },
  {
    content: (
      <TourPopupContent
        title="More Icons"
        notes={[
          <>
            Press <ShortcutText>{searchShortcut}</ShortcutText> to find more
            icons
          </>,
          "You can click-and-drag straight onto the board to create a token, or drag into either tray to reuse them easily",
        ]}
      />
    ),
  },
  {
    content: (
      <>
        <TourPopupContent
          title="More Actions"
          notes={[
            <>
              <ShortcutText>right-click</ShortcutText> to delete from the board
            </>,
            <>
              <ShortcutText>right-click</ShortcutText> icons in the trays to
              remove them
            </>,
            <>
              <ShortcutText>shift-click</ShortcutText> to ping
            </>,
          ]}
        />
      </>
    ),
  },
  {
    selector: "[data-tour=settings]",
    content: (
      <Typography variant="body1">
        Click here to share this room with others, they'll see your changes in
        real time!
      </Typography>
    ),
  },
];

export default steps;
