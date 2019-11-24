import * as t from "io-ts";
import { PathReporter } from "io-ts/es6/PathReporter";

export function decode<T, O, I>(validator: t.Type<T, O, I>, input: I): T {
  const result = validator.decode(input);
  if (result._tag === "Left") {
    throw new Error(PathReporter.report(result).join("\n"));
  } else {
    return result.right;
  }
}
