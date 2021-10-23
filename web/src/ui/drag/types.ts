import { TokenContents } from "../../types";

export type DragSourceId =
  | "character tray"
  | "board"
  | "floor tray"
  | "search tray";

export type DroppableId = "character tray" | "board" | "floor tray";

export interface TtbudDragData {
  type: "character" | "floor";
  contents: TokenContents;
  source: DragSourceId;
}
export type DragDescriptor = TtbudDragData & SortableData;

interface SortableData {
  sortable?: {
    containerId: string;
    index: number;
  };
}

export function isDragDescriptor(obj: any): obj is DragDescriptor {
  return "type" in obj && "contents" in obj;
}

export function isSortableData(obj: any): obj is SortableData {
  return (
    obj &&
    "sortable" in obj &&
    "containerId" in obj.sortable &&
    "index" in obj.sortable
  );
}
