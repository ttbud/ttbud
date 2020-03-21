import {
  Fab,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  makeStyles,
  Popover,
  Switch,
  Typography,
} from "@material-ui/core";
import SettingsIcon from "@material-ui/icons/Settings";
import React, { memo, MouseEvent, useState } from "react";

const useStyles = makeStyles((theme) => ({
  popoverContainer: {
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
  },
  settingMainText: {
    marginRight: theme.spacing(2),
  },
  aboutLink: {
    margin: "auto",
    color: "black",
  },
}));

interface Props {
  className?: string;
}

const Settings: React.FC<Props> = memo(({ className }) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);

  const open = Boolean(anchorEl);

  const onClick = (e: MouseEvent) => {
    setAnchorEl(e.currentTarget);
  };

  const onClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Fab className={className} size="small" onClick={onClick}>
        <SettingsIcon />
      </Fab>
      <Popover
        open={open}
        onClose={onClose}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <div className={classes.popoverContainer}>
          <List subheader={<ListSubheader>Settings</ListSubheader>}>
            <ListItem dense={true}>
              <ListItemText
                primary="Initiative Tracker"
                secondary="(Coming Soon!)"
                className={classes.settingMainText}
              />
              <Switch edge="end" disabled={true} />
            </ListItem>
          </List>
          <List subheader={<ListSubheader>Keyboard Shortcuts</ListSubheader>}>
            <ListItem dense={true}>
              <ListItemText primary="Search" />
              <Typography color="textSecondary">(ctrl+f)</Typography>
            </ListItem>
            <ListItem dense={true}>
              <ListItemText primary="Delete Token" />
              <Typography color="textSecondary">(right click)</Typography>
            </ListItem>
            <ListItem dense={true}>
              <ListItemText primary="Ping" />
              <Typography color="textSecondary">(shift+click)</Typography>
            </ListItem>
          </List>
          <a
            className={classes.aboutLink}
            target="_blank"
            rel="noreferrer noopener"
            href="https://github.com/sjohnson31/ttbud"
          >
            about
          </a>
        </div>
      </Popover>
    </>
  );
});

export default Settings;
