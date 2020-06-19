import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import MailIcon from "@material-ui/icons/Mail";

interface Props {
  open: boolean;
  onClose: () => void;
}

const useStyles = makeStyles((theme) => ({
  title: {
    paddingBottom: 0,
  },
  sectionDetails: {
    marginBottom: theme.spacing(2),
  },
  logo: {
    height: 24,
  },
  supportUsLink: {
    textDecoration: "none",
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  supportUsButton: {
    textTransform: "none",
  },
  socialButtons: {
    margin: theme.spacing(1),
    position: "absolute",
    right: "0",
    top: "0",
  },
}));

const About: React.FC<Props> = ({ open, onClose }) => {
  const classes = useStyles();
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle className={classes.title}>
        <Typography variant="h4" color="primary" component="div">
          TTBud
        </Typography>
        <DialogContentText>Your virtual table friend</DialogContentText>
        <div className={classes.socialButtons}>
          <a
            href="https://twitter.com/officialttbud"
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconButton>
              <img
                className={classes.logo}
                src="/image/twitter-logo.svg"
                alt="Follow us on twitter"
              />
            </IconButton>
          </a>
          <a
            href="https://github.com/ttbud/ttbud"
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconButton>
              <img
                className={classes.logo}
                src="/image/github-logo.svg"
                alt="Github"
              />
            </IconButton>
          </a>
          <a href="mailto: media@ttbud.app">
            <IconButton>
              <MailIcon htmlColor="black" />
            </IconButton>
          </a>
        </div>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h6">What is TTBud?</Typography>
        <Typography variant="body1" className={classes.sectionDetails}>
          TTBud is an online replacement for a physical map or game board. Any
          players that have been invited you your table can edit the game board,
          and all players will see the changes instantly.
        </Typography>
        <Typography variant="h6">About us</Typography>
        <Typography variant="body1" className={classes.sectionDetails}>
          TTBud was created by a group of casual DnD players who lived in three
          different timezones. We wanted a streamlined and intuitive tool that
          would allow us to create maps and track character movements.
        </Typography>
        <Typography variant="subtitle2">
          Thanks to <a href="https://game-icons.net">game-icons.net</a> for
          their gorgeous icons
        </Typography>
      </DialogContent>
      <DialogActions>
        <a
          className={classes.supportUsLink}
          href="https://ko-fi.com/ttbud"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            className={classes.supportUsButton}
            color="primary"
            variant="contained"
          >
            Buy us a coffee
          </Button>
        </a>
      </DialogActions>
    </Dialog>
  );
};

export default About;
