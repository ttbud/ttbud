import {
  Fab,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  makeStyles,
  Popover,
  Snackbar,
  Switch,
  Typography,
} from "@material-ui/core";
import SettingsIcon from "@material-ui/icons/Settings";
import React, { memo, MouseEvent, useState } from "react";
import ConfirmationDialog from "../confirm/ConfirmationDialog";
import isMac from "../../util/isMac";

const FIVE_SECONDS_MS = 5000;

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
  debugEnabled: boolean;
  onDebugToggled: () => void;
  onClearMap: () => void;
}

const searchShortcut = isMac() ? "command+f" : "control+f";

const Settings: React.FC<Props> = memo(
  ({ className, debugEnabled, onClearMap, onDebugToggled }) => {
    const classes = useStyles();
    const [anchorEl, setAnchorEl] = useState<Element | null>(null);
    const [isConfirming, setConfirming] = useState(false);
    const [isShowingCopyNotification, setShowingCopyNotification] = useState(
      false
    );

    const open = Boolean(anchorEl);

    const onClick = (e: MouseEvent) => setAnchorEl(e.currentTarget);

    const onClose = () => setAnchorEl(null);

    const openConfirmationDialog = () => setConfirming(true);
    const closeConfirmationDialog = () => setConfirming(false);

    const onClearMapClicked = () => {
      closeConfirmationDialog();
      onClearMap();
    };

    const onShareRoom = async () => {
      const url = window.location.href;
      setAnchorEl(null);

      await navigator.clipboard.writeText(url);
      setShowingCopyNotification(true);
    };

    const onHideCopyNotification = () => setShowingCopyNotification(false);

    return (
      <>
        <Fab
          className={className}
          size="small"
          onClick={onClick}
          aria-label={"Settings"}
        >
          <SettingsIcon />
        </Fab>
        <ConfirmationDialog
          open={isConfirming}
          title="Are you sure you want to clear the map"
          description="This action cannot be undone"
          confirmAction="Clear"
          onCancel={closeConfirmationDialog}
          onConfirm={onClearMapClicked}
        />
        <Snackbar
          open={isShowingCopyNotification}
          onClose={onHideCopyNotification}
          message={"URL copied to clipboard"}
          autoHideDuration={FIVE_SECONDS_MS}
          anchorOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
        />
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
              <ListItem dense={true}>
                <ListItemText
                  id="settings-debug-logs-label"
                  primary="Enable Debug Logs"
                  className={classes.settingMainText}
                />
                <Switch
                  edge="end"
                  inputProps={{
                    "aria-labelledby": "settings-debug-logs-label",
                  }}
                  checked={debugEnabled}
                  onChange={onDebugToggled}
                />
              </ListItem>
            </List>
            <List subheader={<ListSubheader>Actions</ListSubheader>}>
              <ListItem
                button
                component="button"
                dense={true}
                className={classes.settingMainText}
                onClick={openConfirmationDialog}
              >
                <ListItemText primary="Clear Map" />
              </ListItem>
              <ListItem button dense={true} component="a" href={"/"}>
                <ListItemText>New Room</ListItemText>
              </ListItem>
              <ListItem
                button
                dense={true}
                component="button"
                onClick={onShareRoom}
              >
                <ListItemText>Share Room</ListItemText>
              </ListItem>
            </List>
            <List subheader={<ListSubheader>Keyboard Shortcuts</ListSubheader>}>
              <ListItem dense={true}>
                <ListItemText primary="Search" />
                <Typography color="textSecondary">
                  ({searchShortcut})
                </Typography>
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
  }
);

export default Settings;
