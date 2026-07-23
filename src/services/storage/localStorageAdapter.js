// Every adapter (localStorage now, API later) implements this same shape:
//   listGames() -> Promise<GameSummary[]>
//   getGame(id) -> Promise<Game|null>
//   saveGame(game) -> Promise<Game>   (assigns id + createdAt if missing)
//   deleteGame(id) -> Promise<void>
//   getPrefs() -> Promise<Prefs>
//   savePrefs(prefs) -> Promise<Prefs>
//
// gameService.js depends only on this shape, never on localStorage directly.

const GAMES_KEY = 'chess-trainer:games';
const PREFS_KEY = 'chess-trainer:prefs';

function readGames() {
  try {
    const raw = localStorage.getItem(GAMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeGames(games) {
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

export const localStorageAdapter = {
  async listGames() {
    return readGames()
      .map(({ id, date, result, botRating, playerColor }) => ({
        id,
        date,
        result,
        botRating,
        playerColor,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async getGame(id) {
    const games = readGames();
    return games.find((g) => g.id === id) ?? null;
  },

  async saveGame(game) {
    const games = readGames();
    const record = {
      id: game.id ?? crypto.randomUUID(),
      date: game.date ?? new Date().toISOString(),
      ...game,
    };
    const idx = games.findIndex((g) => g.id === record.id);
    if (idx >= 0) {
      games[idx] = record;
    } else {
      games.push(record);
    }
    writeGames(games);
    return record;
  },

  async deleteGame(id) {
    writeGames(readGames().filter((g) => g.id !== id));
  },

  async getPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  async savePrefs(prefs) {
    const current = await this.getPrefs();
    const merged = { ...current, ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
    return merged;
  },
};
