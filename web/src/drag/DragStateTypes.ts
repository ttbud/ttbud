import Pos2d, { Bounds } from "../util/shape-math";
import { Icon } from "../ui/icons";

export enum DraggableType {
  ICON = "icon",
  TOKEN = "token"
}

export interface IconDraggable {
  type: DraggableType.ICON;
  id: string;
  icon: Icon;
}

export interface TokenDraggable {
  type: DraggableType.TOKEN;
  id: string;
  tokenId: string;
  icon: Icon;
}

export type DraggableDescriptor = IconDraggable | TokenDraggable;

export enum LocationType {
  GRID = "grid",
  LIST = "list"
}

export interface GridLocation {
  type: LocationType.GRID;
  x: number;
  y: number;
}

export interface ListLocation {
  type: LocationType.LIST;
  idx: number;
}

export type LogicalLocation = GridLocation | ListLocation;

export interface DroppableLocation {
  id?: string;
  logicalLocation?: LogicalLocation;
  bounds: Bounds;
}

export enum DragStateType {
  NOT_DRAGGING = "NOT_DRAGGING",
  DRAGGING = "DRAGGING",
  DRAG_END_ANIMATING = "DRAG_END_ANIMATING"
}

interface NotDragging {
  type: DragStateType.NOT_DRAGGING;
}

interface Dragging {
  type: DragStateType.DRAGGING;
  draggable: DraggableDescriptor;
  /**
   * Where the drag started
   */
  source: DroppableLocation;
  /**
   * Difference between the top left of the draggable bounds and mouse position at drag start
   */
  mouseOffset: Pos2d;
  bounds: Bounds;
  hoveredDroppableId?: string;
}

interface DragEndAnimating {
  type: DragStateType.DRAG_END_ANIMATING;
  draggable: DraggableDescriptor;
  source: DroppableLocation;
  destination: DroppableLocation;
}

export type DragState = NotDragging | Dragging | DragEndAnimating;
