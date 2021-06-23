import { Transition } from "react-transition-group";
interface Props {
  in?: boolean;
}

const NoopTransition: React.FC<Props> = ({ in: inProp, children }) => (
  <Transition
    in={inProp}
    // Immediately call done so we don't wait for a frame to hide
    addEndListener={(node, done) => done()}
    unmountOnExit={true}
  >
    {children}
  </Transition>
);

export default NoopTransition;
