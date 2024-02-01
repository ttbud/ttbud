import React from "react";
import { ContentType, TokenContents } from "../../../types";
import { ICONS_BY_ID } from "../../icons";
import UnreachableCaseError from "../../../util/UnreachableCaseError";
import { CardMedia, makeStyles, Theme } from "@material-ui/core";

interface Props {
  contents: TokenContents;
}

const useStyles = makeStyles<Theme>({
  media: {
    width: "70%",
    height: "70%",
  },
});

const CharacterContents: React.FC<Props> = ({ contents }: Props) => {
  const classes = useStyles();
  switch (contents.type) {
    case ContentType.Icon:
      const icon = ICONS_BY_ID.get(contents.iconId);
      if (icon) {
        return (
          <CardMedia
            className={classes.media}
            image={icon.img}
            aria-label={`Character: ${icon.desc}`}
            draggable={false}
          />
        );
      } else {
        console.warn(`Invalid icon id ${contents.iconId}`);
        return <>?</>;
      }
    case ContentType.Text:
      return <>{contents.text.toLocaleUpperCase()}</>;
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(contents);
  }
};

export default CharacterContents;
