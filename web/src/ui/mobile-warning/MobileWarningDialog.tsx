import React, { useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

// Stupid hack until we support touchscreen-only devices
const isMobile = Boolean(
  navigator.userAgent.match(
    /Android|webOS|iPhone|iPad|iPod|Blackberry|Windows Phone/i
  )
);

const email = "media@ttbud.app";
const subject = "TTBud mobile";
const body = "Let me know when TTBud works well on mobile!";
const emailLink = `mailto: ${email}?subject=${encodeURIComponent(
  subject
)}&body=${encodeURIComponent(body)}`;

const useStyles = makeStyles({
  actionList: {
    width: "100%",
  },
});

const MobileWarningDialog: React.FC = () => {
  const classes = useStyles();
  const [open, setOpen] = useState(isMobile);

  const closeDialog = () => setOpen(false);
  return (
    <Dialog open={open} onClose={closeDialog}>
      <DialogTitle>Warning</DialogTitle>
      <DialogContent>
        <DialogContentText variant="body1">
          TTBud doesn't work perfectly on mobile yet, we're working on it.
          <br />
          <br />
          If you want to try it out:
          <ul>
            <li>Double tap to draw/delete</li>
            <li>Long tap to ping</li>
            <li>Search doesn't work, sorry :(</li>
          </ul>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <List className={classes.actionList}>
          <Divider />
          <ListItem
            button
            component="a"
            href={emailLink}
            onClick={closeDialog}
            color="primary"
          >
            <ListItemText>Email me when it works well on mobile</ListItemText>
          </ListItem>
          <Divider />
          <ListItem button onClick={closeDialog}>
            <ListItemText>Try it out</ListItemText>
          </ListItem>
        </List>
      </DialogActions>
    </Dialog>
  );
};

export default MobileWarningDialog;
