import * as t from "io-ts";

export function decode<T, O, I>(validator: t.Type<T, O, I>, input: I): T {
  const result = validator.decode(input);
  if (result._tag === "Left") {
    throw result.left;
  } else {
    return result.right;
  }
}
