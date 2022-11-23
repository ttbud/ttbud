export default {};
// import {
//   configureStore,
//   EnhancedStore,
//   getDefaultMiddleware,
// } from "@reduxjs/toolkit";
// import boardReducer, {
//   addFloor,
//   addPing,
//   batchUnqueuedActions,
//   clear,
//   receiveInitialState,
//   receiveNetworkUpdate,
//   removeEntity,
// } from "./board-slice";
// import { dragEnded } from "../../drag/drag-slice";
// import { DraggableType, LocationType } from "../../drag/DragStateTypes";
// import { WALL_ICON } from "../icons";
// import { DROPPABLE_IDS } from "../DroppableIds";
// import { ContentType, Entity, EntityType, Token } from "../../types";
// import { MergeState } from "./action-reconciliation";
// import flushPromises from "../../util/flushPromises";
//
// function createTestStore(
//   tokens: Token[] = []
// ): EnhancedStore<{ board: MergeState }, any> {
//   const store = configureStore({
//     reducer: { board: boardReducer },
//     preloadedState: { board: EMPTY_BOARD },
//     middleware: getDefaultMiddleware(),
//   });
//
//   store.dispatch(receiveInitialState(tokens));
//   return store;
// }
//
// const EMPTY_BOARD: MergeState = {
//   network: {
//     entityById: {},
//     tokenIdsByPosStr: {},
//     charIdsByContentId: {},
//   },
//   local: {
//     entityById: {},
//     tokenIdsByPosStr: {},
//     charIdsByContentId: {},
//   },
//   queuedUpdates: [],
//   unqueuedActions: [],
// };
//
// const FLOOR_1: Entity = {
//   id: "floor-1",
//   type: EntityType.Floor,
//   contents: { type: ContentType.Icon, iconId: "icon-id" },
//   pos: { x: 0, y: 0, z: 0 },
// };
//
// const TOKEN_1: Entity = {
//   id: "token-1",
//   type: EntityType.Character,
//   contents: { type: ContentType.Icon, iconId: "icon-id" },
//   pos: { x: 0, y: 0, z: 1 },
// };
//
// const TOKEN_2: Entity = {
//   id: "token-2",
//   type: EntityType.Character,
//   contents: { type: ContentType.Icon, iconId: "icon-id" },
//   pos: { x: 1, y: 1, z: 1 },
// };
//
// function getEntities(store: EnhancedStore<{ board: MergeState }>) {
//   return Object.values(store.getState().board.local.entityById);
// }
//
// it("adds floors", () => {
//   const store = createTestStore();
//   store.dispatch(
//     addFloor({ type: ContentType.Icon, iconId: "icon-id" }, { x: 0, y: 0 })
//   );
//   expect(getEntities(store)).toMatchObject([
//     {
//       contents: { type: ContentType.Icon, iconId: "icon-id" },
//       type: EntityType.Floor,
//       pos: { x: 0, y: 0, z: 0 },
//     },
//   ]);
// });
//
// it("can clear the board", () => {
//   const store = createTestStore([TOKEN_1, TOKEN_2]);
//   store.dispatch(clear());
//   expect(getEntities(store)).toEqual([]);
// });
//
// it("batches unqueued actions", () => {
//   const store = createTestStore();
//   store.dispatch(
//     addFloor({ type: ContentType.Icon, iconId: "icon-id" }, { x: 0, y: 0 })
//   );
//
//   store.dispatch(batchUnqueuedActions({ updateId: "update-id" }));
//   expect(store.getState().board.queuedUpdates).toMatchObject([
//     {
//       updateId: "update-id",
//       actions: [
//         {
//           type: "upsert",
//           token: {
//             contents: { type: ContentType.Icon, iconId: "icon-id" },
//             pos: { x: 0, y: 0, z: 0 },
//           },
//         },
//       ],
//     },
//   ]);
// });
//
// it("applies network updates when there are unqueued actions", () => {
//   const store = createTestStore();
//   store.dispatch(addPing({ x: 1, y: 1 }));
//   store.dispatch(
//     receiveNetworkUpdate({
//       actions: [{ type: "upsert", token: TOKEN_1 }],
//       updateId: "update-id",
//     })
//   );
//
//   expect(getEntities(store)).toMatchObject([
//     TOKEN_1,
//     {
//       type: EntityType.Ping,
//       pos: { x: 1, y: 1 },
//     },
//   ]);
// });
//
// it("applies network updates when confirming a pending update", () => {
//   const store = createTestStore();
//   store.dispatch(addPing({ x: 1, y: 1 }));
//   store.dispatch(batchUnqueuedActions({ updateId: "update-id" }));
//   store.dispatch(
//     receiveNetworkUpdate({
//       actions: [
//         {
//           type: "ping",
//           ping: { type: EntityType.Ping, id: "ping-id", pos: { x: 1, y: 1 } },
//         },
//       ],
//       updateId: "update-id",
//     })
//   );
//
//   expect(getEntities(store)).toMatchObject([
//     {
//       type: EntityType.Ping,
//       pos: { x: 1, y: 1 },
//     },
//   ]);
// });
//
// it("gives precedence to network updates when unqueued local updates conflict", () => {
//   const store = createTestStore();
//   // Create a floor locally that will conflict with FLOOR_1 coming from the server
//   store.dispatch(
//     addFloor(
//       { type: ContentType.Icon, iconId: "conflicting-icon-id" },
//       FLOOR_1.pos
//     )
//   );
//   store.dispatch(
//     receiveNetworkUpdate({
//       actions: [
//         {
//           type: "upsert",
//           token: FLOOR_1,
//         },
//       ],
//       updateId: "update-id",
//     })
//   );
//
//   expect(getEntities(store)).toMatchObject([FLOOR_1]);
// });
//
// it("applies network updates when there are pending updates", () => {
//   const store = createTestStore();
//   store.dispatch(addPing({ x: 1, y: 1 }));
//   store.dispatch(batchUnqueuedActions({ updateId: "request-id-1" }));
//   store.dispatch(
//     receiveNetworkUpdate({
//       actions: [{ type: "upsert", token: TOKEN_1 }],
//       updateId: "request-id-2",
//     })
//   );
//
//   expect(getEntities(store)).toMatchObject([
//     TOKEN_1,
//     {
//       type: EntityType.Ping,
//       pos: { x: 1, y: 1 },
//     },
//   ]);
// });
//
// it("adds and automatically removes pings", async () => {
//   const store = createTestStore();
//   store.dispatch(addPing({ x: 1, y: 1 }));
//   expect(getEntities(store)).toMatchObject([
//     {
//       type: EntityType.Ping,
//       pos: { x: 1, y: 1 },
//     },
//   ]);
//
//   jest.runAllTimers();
//   // After the timer elapses, the promise hasn't run yet, just been scheduled
//   // So we have to make sure the promise completes
//   await flushPromises();
//   expect(getEntities(store)).toMatchObject([]);
// });
//
// it("removes tokens", () => {
//   const store = createTestStore([TOKEN_1, TOKEN_2]);
//   store.dispatch(removeEntity(TOKEN_1.id));
//   expect(getEntities(store)).toMatchObject([TOKEN_2]);
// });
//
// it("leaves tokens in the board when they are dragged from the board into something else", () => {
//   const store = createTestStore([TOKEN_1, TOKEN_2]);
//   store.dispatch(
//     dragEnded({
//       draggable: {
//         id: "draggable-id",
//         type: DraggableType.Token,
//         contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
//         tokenId: TOKEN_1.id,
//       },
//       source: {
//         id: DROPPABLE_IDS.BOARD,
//         bounds: { top: 0, left: 0, bottom: 10, right: 10 },
//       },
//       destination: {
//         bounds: { top: 100, left: 100, bottom: 110, right: 110 },
//       },
//     })
//   );
//
//   expect(getEntities(store)).toEqual([TOKEN_1, TOKEN_2]);
// });
//
// it("adds tokens to the board when they are dragged in", () => {
//   const store = createTestStore([TOKEN_1]);
//   store.dispatch(
//     dragEnded({
//       draggable: {
//         id: "draggable-id",
//         type: DraggableType.TokenBlueprint,
//         contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
//       },
//       source: {
//         bounds: { top: 100, left: 100, bottom: 110, right: 110 },
//       },
//       destination: {
//         id: DROPPABLE_IDS.BOARD,
//         bounds: { top: 0, left: 0, bottom: 40, right: 40 },
//         logicalLocation: {
//           type: LocationType.Grid,
//           x: 1,
//           y: 1,
//         },
//       },
//     })
//   );
//
//   expect(getEntities(store)).toMatchObject([
//     TOKEN_1,
//     {
//       contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
//       pos: { x: 1, y: 1 },
//       type: EntityType.Character,
//     },
//   ]);
// });
//
// it("moves tokens when they are dragged around inside the board", () => {
//   const store = createTestStore([TOKEN_1, TOKEN_2]);
//   store.dispatch(
//     dragEnded({
//       draggable: {
//         id: "draggable-id",
//         type: DraggableType.Token,
//         contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
//         tokenId: TOKEN_1.id,
//       },
//       source: {
//         id: DROPPABLE_IDS.BOARD,
//         bounds: { top: 0, left: 0, bottom: 0, right: 0 },
//         logicalLocation: { type: LocationType.Grid, x: 0, y: 0 },
//       },
//       destination: {
//         id: DROPPABLE_IDS.BOARD,
//         bounds: { top: 50, left: 50, bottom: 60, right: 60 },
//         logicalLocation: { type: LocationType.Grid, x: 5, y: 5 },
//       },
//     })
//   );
//
//   const token1Id = TOKEN_1.id;
//   const token2Id = TOKEN_2.id;
//   expect(store.getState().board.local.entityById).toEqual({
//     [token2Id]: TOKEN_2,
//     [token1Id]: {
//       ...TOKEN_1,
//       pos: {
//         x: 5,
//         y: 5,
//         z: 1,
//       },
//     },
//   });
// });
//
// it("ignores drags that don't involve the board", () => {
//   const store = createTestStore([TOKEN_1, TOKEN_2]);
//   store.dispatch(
//     dragEnded({
//       draggable: {
//         id: "draggable-id",
//         type: DraggableType.TokenBlueprint,
//         contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
//       },
//       source: {
//         id: DROPPABLE_IDS.CHARACTER_TRAY,
//         bounds: { top: 0, left: 0, bottom: 10, right: 10 },
//       },
//       destination: {
//         id: DROPPABLE_IDS.CHARACTER_TRAY,
//         bounds: { top: 100, left: 100, bottom: 110, right: 110 },
//       },
//     })
//   );
//
//   expect(getEntities(store)).toEqual([TOKEN_1, TOKEN_2]);
// });
//
// it("ignores drags on deleted tokens", () => {
//   const store = createTestStore([TOKEN_1, TOKEN_2]);
//   // Simulate getting a network update where token 2 is deleted
//   store.dispatch(
//     receiveNetworkUpdate({
//       updateId: "test-id",
//       actions: [{ type: "delete", entityId: TOKEN_2.id }],
//     })
//   );
//   // And now the user stopped dragging
//   store.dispatch(
//     dragEnded({
//       draggable: {
//         id: "draggable-id",
//         type: DraggableType.Token,
//         contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
//         tokenId: TOKEN_2.id,
//       },
//       source: {
//         id: DROPPABLE_IDS.BOARD,
//         bounds: { top: 0, left: 0, bottom: 10, right: 10 },
//         logicalLocation: {
//           type: LocationType.Grid,
//           x: 0,
//           y: 0,
//         },
//       },
//       destination: {
//         id: DROPPABLE_IDS.BOARD,
//         bounds: { top: 50, left: 50, bottom: 60, right: 60 },
//         logicalLocation: {
//           type: LocationType.Grid,
//           x: 5,
//           y: 5,
//         },
//       },
//     })
//   );
//
//   expect(getEntities(store)).toEqual([TOKEN_1]);
// });
