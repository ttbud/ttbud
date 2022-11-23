import CloseIcon from "@mui/icons-material/Close";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  IconButton,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";

interface Props {
  /**
   * The current step number
   */
  current: number;

  /**
   * The total number of steps
   */
  totalSteps: number;

  /**
   * Callback to jump to a specific step number
   */
  gotoStep: (step: number) => void;

  /**
   * Callback to close the tutorial
   */
  close: () => void;

  /**
   * The content for the step
   */
  content: string;
}

const useStyles = makeStyles({
  root: {
    maxWidth: "400px",
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    top: 0,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
});

const TourPopup: React.FC<Props> = ({
  content,
  current,
  totalSteps,
  gotoStep,
  close,
}) => {
  const classes = useStyles();

  const onNextClicked = () => {
    if (current < totalSteps - 1) {
      gotoStep(current + 1);
    } else {
      close();
    }
  };

  const onPrevClicked = () => {
    gotoStep(current - 1);
  };

  const isFirstPopup = current <= 0;
  const isLastPopup = current >= totalSteps - 1;

  return (
    <Card className={classes.root}>
      <IconButton className={classes.closeBtn} onClick={close} size="large">
        <CloseIcon />
      </IconButton>
      <CardContent>{content}</CardContent>
      <CardActions className={classes.actions}>
        {!isFirstPopup && (
          <Button variant="text" onClick={onPrevClicked} color={"primary"}>
            Previous
          </Button>
        )}
        <Button onClick={onNextClicked} color={"primary"}>
          {isLastPopup ? "Done" : "Next"}
        </Button>
      </CardActions>
    </Card>
  );
};

export default TourPopup;
