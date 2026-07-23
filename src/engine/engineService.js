// Thin promise-based wrapper around the Stockfish WASM Web Worker.
// The rest of the app never speaks raw UCI — it calls setRating() and
// getBestMove() and gets back a move, or analyze() to get a move + a
// score. Swap the engine build/worker here without touching any component.

// Stockfish's own UCI_Elo range for this build. Values are clamped into
// this range before being sent, so the UI can offer a wider rating slider
// (e.g. down to 400) without breaking the engine.
const MIN_ENGINE_ELO = 1320;
const MAX_ENGINE_ELO = 3190;

class EngineService {
  constructor() {
    this.worker = null;
    this.ready = null;
    this.currentRating = 1500;
    // Stockfish can only run one "go" at a time. Every call to _search
    // (whether it's the bot picking its move or us grading a position for
    // feedback) is chained onto this promise so requests never overlap.
    this._queue = Promise.resolve();
  }

  init() {
    if (this.ready) return this.ready;

    this.ready = new Promise((resolve) => {
      // No URL hash here on purpose: this build's own self-detection only
      // reaches its worker-setup branch when the hash does NOT contain
      // ",worker" (that flag is for a different embedding case and
      // short-circuits past the setup code if present). With no hash, it
      // correctly detects "I'm in a Worker" and defaults to loading the
      // .wasm file sitting next to this .js file — exactly our layout.
      this.worker = new Worker('/engine/stockfish-18-lite-single.js');

      const onFirstReady = (e) => {
        if (e.data === 'uciok') {
          this.worker.removeEventListener('message', onFirstReady);
          resolve();
        }
      };

      this.worker.addEventListener('message', onFirstReady);
      this.worker.addEventListener('error', (e) => {
        console.error('Stockfish worker failed to load:', e.message, e);
      });

      this.worker.postMessage('uci');
    });

    return this.ready;
  }

  async setRating(rating) {
    await this.ready;
    this.currentRating = rating;
    const clamped = Math.min(MAX_ENGINE_ELO, Math.max(MIN_ENGINE_ELO, rating));

    this.worker.postMessage('setoption name UCI_LimitStrength value true');
    this.worker.postMessage(`setoption name UCI_Elo value ${clamped}`);
  }

  /** Run `task` only after every previously-queued search has finished. */
  _enqueue(task) {
    const run = this._queue.then(task, task);
    // Swallow errors here so one failed search doesn't jam the queue for
    // everything after it — the caller's own promise still rejects.
    this._queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  /**
   * Run a single search and resolve with both the best move and the final
   * evaluation the engine reported for the position (from the perspective
   * of whoever is to move in that position).
   */
  _search(fen, movetimeMs) {
    return new Promise((resolve) => {
      let score = null; // { cp } or { mate }

      const onMessage = (e) => {
        const line = e.data;
        if (typeof line !== 'string') return;

        if (line.startsWith('info') && line.includes(' score ')) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (mateMatch) score = { cp: null, mate: Number(mateMatch[1]) };
          else if (cpMatch) score = { cp: Number(cpMatch[1]), mate: null };
        } else if (line.startsWith('bestmove')) {
          this.worker.removeEventListener('message', onMessage);
          const [, bestMove] = line.split(' ');
          resolve({
            bestMove: bestMove === '(none)' ? null : bestMove,
            cp: score?.cp ?? null,
            mate: score?.mate ?? null,
          });
        }
      };

      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go movetime ${movetimeMs}`);
    });
  }

  /**
   * Ask the engine for its move in the given position.
   * @param {string} fen - FEN string of the current position
   * @param {object} opts - { movetimeMs } how long the engine may think
   * @returns {Promise<string|null>} UCI move string, e.g. "e2e4", or null if no legal move
   */
  async getBestMove(fen, { movetimeMs = 800 } = {}) {
    await this.ready;
    return this._enqueue(() => this._search(fen, movetimeMs)).then((r) => r.bestMove);
  }

  /**
   * Evaluate a position without playing anything — used to grade moves and
   * to show what the engine thinks the best move was.
   *
   * IMPORTANT: this must run at full engine strength, not at whatever
   * UCI_LimitStrength/UCI_Elo setRating() last configured. analyze() shares
   * the same worker/engine instance as getBestMove() (the bot's own move
   * picker), so without this the "best move" and move grading were being
   * produced by an artificially weakened, near-random-strength Stockfish —
   * e.g. Bot rating 400 — instead of a real best move.
   * @param {string} fen
   * @param {object} opts - { movetimeMs }
   * @returns {Promise<{bestMove: string|null, cp: number|null, mate: number|null}>}
   *   cp/mate are from the perspective of the side to move in `fen`.
   */
  async analyze(fen, { movetimeMs = 500 } = {}) {
    await this.ready;
    return this._enqueue(async () => {
      this.worker.postMessage('setoption name UCI_LimitStrength value false');
      const result = await this._search(fen, movetimeMs);
      // Restore the bot's configured strength before it moves again.
      const clamped = Math.min(MAX_ENGINE_ELO, Math.max(MIN_ENGINE_ELO, this.currentRating));
      this.worker.postMessage('setoption name UCI_LimitStrength value true');
      this.worker.postMessage(`setoption name UCI_Elo value ${clamped}`);
      return result;
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
      this.ready = null;
      this._queue = Promise.resolve();
    }
  }
}

// Singleton — one engine instance per tab is all we need.
export const engineService = new EngineService();
