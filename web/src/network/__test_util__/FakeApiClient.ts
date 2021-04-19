import { assert } from "../../util/invariants";
import BoardStateApiClient, {
  Action,
  ApiEventHandler,
} from "../BoardStateApiClient";

export default class FakeApiClient implements BoardStateApiClient {
  private isConnected: boolean = false;
  private requestIds: string[] = [];

  public setEventHandler(handler: ApiEventHandler) {}

  public connect(roomId: string) {
    this.isConnected = true;
  }

  public reconnect() {
    assert(
      this.isConnected,
      "Cannot reconnect when no connection has been made"
    );
  }

  public connected(): boolean {
    return this.isConnected;
  }

  public close() {
    this.isConnected = false;
  }

  public send(requestId: string, actions: Action[]) {
    if (this.isConnected) {
      this.requestIds.push(requestId);
    } else {
      throw new Error("Cannot send message to disconnected host");
    }
  }

  public sentRequestIds(): string[] {
    return this.requestIds;
  }
}
