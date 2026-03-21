import * as t from "io-ts";

const PingDecoder = t.type({
  id: t.string,
  type: t.literal("ping"),
  x: t.number,
  y: t.number,
});

const IconContentsDecoder = t.type({ icon_id: t.string });

const TextContentsDecoder = t.type({ text: t.string });

const TokenContentsDecoder = t.union([
  IconContentsDecoder,
  TextContentsDecoder,
]);

const ColorDecoder = t.type({
  red: t.number,
  green: t.number,
  blue: t.number,
});

const TokenDecoder = t.type({
  id: t.string,
  type: t.union([t.literal("character"), t.literal("floor")]),
  contents: TokenContentsDecoder,
  start_x: t.number,
  start_y: t.number,
  start_z: t.number,
  end_x: t.number,
  end_y: t.number,
  end_z: t.number,
  color_rgb: t.union([ColorDecoder, t.undefined]),
});

const UpsertActionDecoder = t.type({
  data: TokenDecoder,
  action: t.literal("upsert"),
});

const DeleteActionDecoder = t.type({
  data: t.string,
  action: t.literal("delete"),
});

const PingActionDecoder = t.type({
  data: PingDecoder,
  action: t.literal("ping"),
});

const SetGridTypeActionDecoder = t.type({
  data: t.union([t.literal("hex"), t.literal("square")]),
  action: t.literal("set-grid-type"),
});

const ActionDecoder = t.union([
  PingActionDecoder,
  UpsertActionDecoder,
  DeleteActionDecoder,
  SetGridTypeActionDecoder,
]);

const ErrorMessageDecoder = t.type({
  type: t.literal("error"),
  request_id: t.string,
  data: t.string,
});

const ConnectionResultDecoder = t.type({
  type: t.literal("connected"),
  data: t.array(TokenDecoder),
  grid_type: t.union([t.literal("hex"), t.literal("square")]),
});

const UpdateDecoder = t.type({
  request_id: t.string,
  type: t.literal("update"),
  actions: t.array(ActionDecoder),
});

export const MessageDecoder = t.union([
  UpdateDecoder,
  ErrorMessageDecoder,
  ConnectionResultDecoder,
]);

export type ApiPingToken = t.TypeOf<typeof PingDecoder>;
export type ApiToken = t.TypeOf<typeof TokenDecoder>;

interface PingApiAction {
  action: "ping";
  data: ApiPingToken;
}

interface TokenApiAction {
  action: "upsert";
  data: ApiToken;
}

interface TokenDeleteAction {
  action: "delete";
  data: string;
}

interface SetGridTypeApiAction {
  action: "set-grid-type";
  data: "hex" | "square";
}

export type ApiAction =
  | PingApiAction
  | TokenApiAction
  | TokenDeleteAction
  | SetGridTypeApiAction;
export type ApiTextContent = t.TypeOf<typeof TextContentsDecoder>;
export type ApiTokenContents = t.TypeOf<typeof TokenContentsDecoder>;

export function isTextContents(
  contents: ApiTokenContents
): contents is ApiTextContent {
  return contents.hasOwnProperty("text");
}
