import { Typography } from "@material-ui/core";
import React, { ReactNode } from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
  notes: {
    // Line up with the title
    paddingLeft: 17,
    // There's already a bunch of white space at the bottom,
    // don't need the default whitespace from ul
    marginBlockEnd: 0,
    // Extra padding between all of the list items
    "& :not(:last-child)": {
      padding: "0 0 0.5em",
    },
  },
});

interface Props {
  title: string;
  notes: ReactNode[];
}

const TourPopupContent: React.FC<Props> = ({ title, notes }) => {
  const classes = useStyles();

  return (
    <>
      <Typography gutterBottom variant="h5" component="h1">
        {title}
      </Typography>
      <ul className={classes.notes}>
        {notes.map((bullet, i) => (
          <li key={`tour-note-${i}`}>
            <Typography variant="body1">{bullet}</Typography>
          </li>
        ))}
      </ul>
    </>
  );
};

export default TourPopupContent;
