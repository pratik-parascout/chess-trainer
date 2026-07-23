import { useCallback, useRef, useState } from 'react';
import { Chess } from 'chess.js';

/**
 * Wraps a chess.js instance and exposes React-friendly state + actions.
 * The chess.js instance itself is mutable, so we keep it in a ref and
 * bump a version counter to trigger re-renders whenever it changes.
 */
export function useChessGame() {
  const gameRef = useRef(new Chess());
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);

  const game = gameRef.current;

  const status = useCallback(() => {
    if (game.isCheckmate()) return 'checkmate';
    if (game.isStalemate()) return 'stalemate';
    if (game.isThreefoldRepetition()) return 'repetition';
    if (game.isInsufficientMaterial()) return 'insufficient-material';
    if (game.isDraw()) return 'draw';
    if (game.isCheck()) return 'check';
    return 'in-progress';
  }, [game]);

  /** Attempt a move. Accepts either a SAN string or a {from,to,promotion} object. */
  const makeMove = useCallback(
    (move) => {
      try {
        const result = game.move(move);
        if (result) rerender();
        return result; // null if illegal
      } catch {
        return null; // chess.js throws on some malformed input — treat as illegal
      }
    },
    [game]
  );

  /** Apply a move already known to be legal, e.g. a UCI string like "e2e4" or "e7e8q" from the engine. */
  const makeUciMove = useCallback(
    (uci) => {
      if (!uci) return null;
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci.slice(4) : undefined;
      return makeMove({ from, to, promotion });
    },
    [makeMove]
  );

  const undo = useCallback(() => {
    const result = game.undo();
    if (result) rerender();
    return result;
  }, [game]);

  const reset = useCallback(
    (fen) => {
      if (fen) {
        game.load(fen);
      } else {
        game.reset();
      }
      rerender();
    },
    [game]
  );

  return {
    fen: game.fen(),
    pgn: game.pgn(),
    turn: game.turn(), // 'w' | 'b'
    history: game.history({ verbose: true }),
    status: status(),
    isGameOver: game.isGameOver(),
    makeMove,
    makeUciMove,
    undo,
    reset,
    legalMoves: (square) => game.moves({ square, verbose: true }),
  };
}
