import {
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  Popover,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import React, { memo, MouseEvent, useState } from "react";
import ConfirmationDialog from "../confirm/ConfirmationDialog";
import isMac from "../../util/isMac";
import { connect } from "react-redux";
import { RootState } from "../../store/rootReducer";
import { dismissTourPrompt } from "./settings-slice";
import AboutDialog from "../about/About";

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
    background: "none",
    border: "none",
    padding: 0,
    textDecoration: "underline",
    cursor: "pointer",
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
  showTourPrompt: boolean;
  onClearMap: () => void;
  onTourClicked: () => void;
  onTourPromptDismissed: () => void;
}

const searchShortcut = isMac() ? "command+f" : "control+f";

const PureSettings: React.FC<Props> = memo(
  ({
    className,
    showTourPrompt,
    onClearMap,
    onTourClicked,
    onTourPromptDismissed,
  }) => {
    const classes = useStyles();
    const [anchorEl, setAnchorEl] = useState<Element | null>(null);
    const [isConfirming, setConfirming] = useState(false);
    const [isShowingCopyNotification, setShowingCopyNotification] =
      useState(false);
    const [isShowingAboutDialog, setIsShowingAboutDialog] = useState(false);

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

    const onAboutClicked = () => {
      setAnchorEl(null);
      setIsShowingAboutDialog(true);
    };

    const onAboutClosed = () => setIsShowingAboutDialog(false);

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
        <AboutDialog open={isShowingAboutDialog} onClose={onAboutClosed} />
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
          disableScrollLock={true}
        >
          <div className={classes.popoverContainer}>
            <List
              subheader={<ListSubheader color="primary">Tour</ListSubheader>}
            >
              <ListItem
                button
                dense={true}
                component="button"
                onClick={onStartTour}
              >
                <ListItemText>Start Tour</ListItemText>
              </ListItem>
            </List>
            <List
              subheader={
                <ListSubheader color="primary">Board Actions</ListSubheader>
              }
            >
              <ListItem
                button
                component="button"
                dense={true}
                className={classes.settingMainText}
                onClick={openConfirmationDialog}
              >
                <ListItemText primary="Clear Board" />
              </ListItem>
              <ListItem button dense={true} component="a" href={"/"}>
                <ListItemText>Open New Board</ListItemText>
              </ListItem>
              <ListItem
                button
                dense={true}
                component="button"
                onClick={onShareRoom}
              >
                <ListItemText>Invite Players</ListItemText>
              </ListItem>
            </List>
            <List
              subheader={
                <ListSubheader color="primary">Commands</ListSubheader>
              }
            >
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
            <button className={classes.aboutLink} onClick={onAboutClicked}>
              about
            </button>
          </div>
        </Popover>
      </>
    );
  }
);

const mapStateToProps = (state: RootState) => ({
  showTourPrompt: state.settings.showTourPrompt,
});

const dispatchProps = {
  onTourPromptDismissed: dismissTourPrompt,
};

const Settings = connect(mapStateToProps, dispatchProps)(PureSettings);
export default Settings;
export { PureSettings };
