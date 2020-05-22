import { PersistedState } from "redux-persist/es/types";
import storage from "redux-persist/lib/storage";

const CURRENT_VERSION = 1;

/**
 * Migrator that just drops any state that doesn't match the current version of the code
 *
 * @param state
 */
const dropOldStateMigrator = (
  state: PersistedState
): Promise<PersistedState | undefined> => {
  if (state?._persist.version !== CURRENT_VERSION) {
    // No persisted state or state is from an older version, just start fresh
    return Promise.resolve(undefined);
  } else {
    // State is the same version, so just return it
    return Promise.resolve(state);
  }
};

export const persistConfig = {
  key: "settings",
  storage,
  whitelist: ["characterTray", "floorTray"],
  version: CURRENT_VERSION,
  migrate: dropOldStateMigrator,
};
