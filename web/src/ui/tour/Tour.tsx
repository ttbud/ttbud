import Reactour from "reactour";
import steps from "./steps";
import TourPopup from "./TourPopup";

interface Props {
  isOpen: boolean;
  onCloseClicked: () => void;
}

const Tour: React.FC<Props> = ({ isOpen, onCloseClicked }) => {
  return (
    <Reactour
      startAt={0}
      steps={steps}
      isOpen={isOpen}
      onRequestClose={onCloseClicked}
      // The @types type definition doesn't include this property, and it's also not documented
      // so it's questionable as to whether it should be added
      // @ts-ignore
      CustomHelper={TourPopup}
      disableInteraction={true}
    />
  );
};

export default Tour;
