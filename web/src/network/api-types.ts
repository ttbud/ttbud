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

const ApiEntityDecoder = t.union([TokenDecoder, PingDecoder]);

const BoardStateDecoder = t.type({
  type: t.literal("state"),
  request_id: t.string,
  data: t.array(ApiEntityDecoder),
});

const ErrorMessageDecoder = t.type({
  type: t.literal("error"),
  request_id: t.string,
  data: t.string,
});

const ConnectionResultDecoder = t.type({
  type: t.literal("connected"),
  data: t.array(ApiEntityDecoder),
});

export const MessageDecoder = t.union([
  BoardStateDecoder,
  ErrorMessageDecoder,
  ConnectionResultDecoder,
]);

export type ApiPingToken = t.TypeOf<typeof PingDecoder>;
type ApiToken = t.TypeOf<typeof TokenDecoder>;

interface PingApiUpdate {
  action: "ping";
  data: ApiPingToken;
}

interface TokenApiUpdate {
  action: "update";
  data: ApiToken;
}

interface TokenDelete {
  action: "delete";
  data: string;
}

export type ApiUpdate = PingApiUpdate | TokenApiUpdate | TokenDelete;
export type ApiEntity = t.TypeOf<typeof ApiEntityDecoder>;
export type ApiTextContent = t.TypeOf<typeof TextContentsDecoder>;
export type ApiTokenContents = t.TypeOf<typeof TokenContentsDecoder>;

export function isTextContents(
  contents: ApiTokenContents
): contents is ApiTextContent {
  return contents.hasOwnProperty("text");
}
