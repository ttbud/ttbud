import Pos2d, { Bounds } from "../util/shape-math";
import { Icon } from "../ui/icons";

export enum DraggableType {
  Icon = "icon",
  Token = "token"
}

export interface IconDraggable {
  type: DraggableType.Icon;
  id: string;
  icon: Icon;
}

export interface TokenDraggable {
  type: DraggableType.Token;
  id: string;
  tokenId: string;
  icon: Icon;
}

export type DraggableDescriptor = IconDraggable | TokenDraggable;

export enum LocationType {
  Grid = "grid",
  List = "list"
}

export interface GridLocation {
  type: LocationType.Grid;
  x: number;
  y: number;
}

export interface ListLocation {
  type: LocationType.List;
  idx: number;
}

export type LogicalLocation = GridLocation | ListLocation;

export interface DroppableLocation {
  id?: string;
  logicalLocation?: LogicalLocation;
  bounds: Bounds;
}

export enum DragStateType {
  NotDragging = "NotDragging",
  Dragging = "Dragging",
  DragEndAnimating = "DragEndAnimating"
}

interface NotDragging {
  type: DragStateType.NotDragging;
}

interface Dragging {
  type: DragStateType.Dragging;
  draggable: DraggableDescriptor;
  /**
   * Where the drag started
   */
  source: DroppableLocation;
  /**
   * Difference between the top left of the draggable bounds and mouse position at drag start
   */
  mouseOffset: Pos2d;
  /**
   * Client bounds of the element being dragged
   */
  bounds: Bounds;
  hoveredDroppableId?: string;
}

interface DragEndAnimating {
  type: DragStateType.DragEndAnimating;
  draggable: DraggableDescriptor;
  source: DroppableLocation;
  destination: DroppableLocation;
}

export type DragState = NotDragging | Dragging | DragEndAnimating;
