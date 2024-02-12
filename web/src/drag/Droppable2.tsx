import { useDroppable } from "@dnd-kit/core";
import { CSSProperties } from "@material-ui/core/styles/withStyles";

interface Props {
  id: string;
  style?: CSSProperties;
}

const Droppable2: React.FC<Props> = ({ id, style, children }) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
};

export default Droppable2;
