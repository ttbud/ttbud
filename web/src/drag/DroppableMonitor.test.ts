import {
  DomDroppableMonitor,
  DroppableConfig,
  DroppableConfigApi,
  DroppableMonitor,
  LocationCollector,
} from "./DroppableMonitor";
import {
  FakeDroppable,
  FakeDroppableMonitor,
} from "./__test_util__/FakeDroppableMonitor";
import { Bounds } from "../util/shape-math";
import noop from "../util/noop";

interface FakeDroppableConfig {
  id: string;
  zIndex?: number;
  bounds?: Bounds;
  getLocation?: LocationCollector;
  onBeforeDragStart?: () => void;
}

function toFakeDroppable({
  id,
  zIndex = 0,
  bounds = { top: 0, left: 0, bottom: 50, right: 50 },
  getLocation = () => undefined,
  onBeforeDragStart = noop,
}: FakeDroppableConfig): FakeDroppable {
  return { id, zIndex, bounds, getLocation, onBeforeDragStart };
}

function toDomDroppable({
  id,
  zIndex = 0,
  bounds = { top: 0, left: 0, bottom: 50, right: 50 },
  getLocation = () => undefined,
  onBeforeDragStart = noop,
}: FakeDroppableConfig): DroppableConfig {
  const el = document.createElement("div");
  document.body.append(el);
  el.style.position = "absolute";
  el.style.top = `${bounds.top}px`;
  el.style.left = `${bounds.left}px`;
  el.style.width = `${bounds.right - bounds.left}`;
  el.style.height = `${bounds.bottom - bounds.top}`;
  el.style.zIndex = String(zIndex);

  return {
    id,
    ref: { current: el },
    getLocation,
    onBeforeDragStart,
  };
}

/**
 * Create a droppable structure that looks roughly like this:
 *
 *  +------+
 *  |      |
 *  |   +--+---+
 *  |   |      |
 *  +---+      +---+
 *      |      |   |
 *      +---+--+   |
 *          |      |
 *          +------+
 */
const droppableConfigs: FakeDroppableConfig[] = [
  { id: "top left", bounds: { top: 0, left: 0, bottom: 50, right: 50 } },
  {
    id: "middle",
    bounds: { top: 25, left: 25, bottom: 75, right: 75 },
    zIndex: 1,
  },
  {
    id: "bottom right",
    bounds: { top: 50, left: 50, bottom: 100, right: 100 },
  },
];

const domDroppableMonitor = new DomDroppableMonitor();
const domDroppables = droppableConfigs.map(toDomDroppable);
domDroppables.forEach((droppable) =>
  domDroppableMonitor.addDroppable(droppable)
);

const fakeDroppableMonitor = new FakeDroppableMonitor();
const fakeDroppables = droppableConfigs.map(toFakeDroppable);
fakeDroppableMonitor.setDroppables(fakeDroppables);

const monitors: [string, DroppableMonitor, DroppableConfigApi[]][] = [
  ["Dom", domDroppableMonitor, domDroppables],
  ["Fake", fakeDroppableMonitor, fakeDroppables],
];

describe.each(monitors)("%sDroppableMonitor", (_, monitor, droppables) => {
  it("should throw if you try to get a droppable that doesn't exist", () => {
    expect(() => monitor.getDroppable("invalid droppable id")).toThrow();
  });

  it("should find droppables by id", () => {
    const firstDroppable = droppables[0];
    expect(monitor.getDroppable(firstDroppable.id)).toEqual(firstDroppable);
  });
});

// These tests only run on the the fake for now, because jsdom does not
// support document.elementsFromPoint :(
describe("FakeDroppableMonitor", () => {
  it("should find an unobstructed droppable", () => {
    expect(fakeDroppableMonitor.findDroppableAt({ x: 10, y: 10 })?.id).toEqual(
      "top left"
    );
  });

  it("should find the highest droppable by z-index", () => {
    expect(fakeDroppableMonitor.findDroppableAt({ x: 49, y: 49 })?.id).toEqual(
      "middle"
    );
  });
});

// These tests only run on the real droppable monitor, because they involve
// registering refs
describe("DomDroppableMonitor", () => {
  it("should disallow adding droppables with duplicate ids", () => {
    const firstDroppable = domDroppables[0];
    expect(() => domDroppableMonitor.addDroppable(firstDroppable)).toThrow();
  });

  it("should disallow removing droppables that don't exist", () => {
    expect(() =>
      domDroppableMonitor.removeDroppable("invalid droppable id")
    ).toThrow();
  });

  it("should allow removing droppables", () => {
    const firstDroppableId = domDroppables[0].id;
    domDroppableMonitor.removeDroppable(firstDroppableId);
    expect(() => domDroppableMonitor.getDroppable(firstDroppableId)).toThrow();
  });
});
