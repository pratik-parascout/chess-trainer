import { localStorageAdapter } from './storage/localStorageAdapter';

// --- THE SWAP POINT ---
// Today: localStorageAdapter. Later, when the Express + Mongo/Postgres
// backend exists, this becomes `import { apiAdapter } from './storage/apiAdapter'`
// and nothing outside this file changes — every component below already
// calls gameService, not the adapter.
const adapter = localStorageAdapter;

export const gameService = {
  listGames: () => adapter.listGames(),
  getGame: (id) => adapter.getGame(id),
  saveGame: (game) => adapter.saveGame(game),
  deleteGame: (id) => adapter.deleteGame(id),
  getPrefs: () => adapter.getPrefs(),
  savePrefs: (prefs) => adapter.savePrefs(prefs),
};
