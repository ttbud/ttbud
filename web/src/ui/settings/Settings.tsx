import {
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  makeStyles,
  Popover,
  Snackbar,
  Switch,
  Tooltip,
  Typography,
} from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import React, { memo, MouseEvent, useState } from "react";
import ConfirmationDialog from "../confirm/ConfirmationDialog";
import isMac from "../../util/isMac";
import { connect } from "react-redux";
import { RootState } from "../../store/rootReducer";
import { toggleDebug, dismissTourPrompt } from "./settings-slice";

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
  tourPrompt: {
    display: "flex",
    alignItems: "center",
  },
  tourPromptText: {
    marginLeft: "5px",
  },
  tourPromptCloseBtn: {
    marginLeft: "5px",
  },
}));

interface Props {
  className?: string;
  debugEnabled: boolean;
  showTourPrompt: boolean;
  onDebugToggled: () => void;
  onClearMap: () => void;
  onTourClicked: () => void;
  onTourPromptDismissed: () => void;
}

const searchShortcut = isMac() ? "command+f" : "control+f";

const PureSettings: React.FC<Props> = memo(
  ({
    className,
    showTourPrompt,
    debugEnabled,
    onClearMap,
    onDebugToggled,
    onTourClicked,
    onTourPromptDismissed,
  }) => {
    const classes = useStyles();
    const [anchorEl, setAnchorEl] = useState<Element | null>(null);
    const [isConfirming, setConfirming] = useState(false);
    const [isShowingCopyNotification, setShowingCopyNotification] = useState(
      false
    );

    const open = Boolean(anchorEl);
    const onClick = (e: MouseEvent) => {
      onTourPromptDismissed();
      setAnchorEl(e.currentTarget);
    };

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

    const onStartTour = () => {
      setAnchorEl(null);
      onTourClicked();
    };

    return (
      <>
        <Tooltip
          open={showTourPrompt}
          title={
            <div className={classes.tourPrompt}>
              <Typography
                className={classes.tourPromptText}
                color="inherit"
                variant="body1"
              >
                Click here for a tour
              </Typography>
              <IconButton
                className={classes.tourPromptCloseBtn}
                onClick={onTourPromptDismissed}
                color={"inherit"}
                size={"small"}
                aria-label={"dismiss"}
              >
                <CloseIcon />
              </IconButton>
            </div>
          }
          arrow
          interactive
          placement={"top-end"}
        >
          <Fab
            data-tour={"settings"}
            className={className}
            size="small"
            onClick={onClick}
            aria-label={"Settings"}
            color={"primary"}
          >
            <MoreVertIcon />
          </Fab>
        </Tooltip>
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
                  color={"primary"}
                  edge="end"
                  inputProps={{
                    "aria-labelledby": "settings-debug-logs-label",
                  }}
                  checked={debugEnabled}
                  onChange={onDebugToggled}
                />
              </ListItem>
            </List>
            <List subheader={<ListSubheader>Tour</ListSubheader>}>
              <ListItem
                button
                dense={true}
                component="button"
                onClick={onStartTour}
              >
                <ListItemText>Start Tour</ListItemText>
              </ListItem>
            </List>
            <List subheader={<ListSubheader>Room Actions</ListSubheader>}>
              <ListItem
                button
                component="button"
                dense={true}
                className={classes.settingMainText}
                onClick={openConfirmationDialog}
              >
                <ListItemText primary="Clear Room" />
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
            <List subheader={<ListSubheader>Commands</ListSubheader>}>
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

const mapStateToProps = (state: RootState) => ({
  showTourPrompt: state.settings.showTourPrompt,
  debugEnabled: state.settings.debug,
});

const dispatchProps = {
  onDebugToggled: toggleDebug,
  onTourPromptDismissed: dismissTourPrompt,
};

const Settings = connect(mapStateToProps, dispatchProps)(PureSettings);
export default Settings;
export { PureSettings };
