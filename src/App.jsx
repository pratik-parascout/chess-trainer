import { useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import GameControls from './components/GameControls';
import MoveList from './components/MoveList';
import MoveFeedback from './components/MoveFeedback';
import EvalBar from './components/EvalBar';
import { useChessGame } from './hooks/useChessGame';
import { engineService } from './engine/engineService';
import { classifyMove } from './engine/moveClassifier';
import { gameService } from './services/gameService';
import './styles/app.css';

const STATUS_MESSAGES = {
  checkmate: 'Checkmate.',
  stalemate: 'Draw by stalemate.',
  repetition: 'Draw by threefold repetition.',
  'insufficient-material': 'Draw — insufficient material.',
  draw: 'Draw.',
  check: 'Check!',
  'in-progress': null,
};

function resultFromStatus(status, turnAfterGameOver) {
  // turnAfterGameOver is whoever was TO MOVE when the game ended, i.e. the loser on checkmate.
  if (status === 'checkmate') return turnAfterGameOver === 'w' ? 'black-wins' : 'white-wins';
  if (['stalemate', 'repetition', 'insufficient-material', 'draw'].includes(status)) return 'draw';
  return null;
}

export default function App() {
  const game = useChessGame();
  const [rating, setRating] = useState(1200);
  const [playerColor, setPlayerColor] = useState('white');
  const [gameInProgress, setGameInProgress] = useState(false);
  const [engineThinking, setEngineThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [analyzeMoves, setAnalyzeMoves] = useState(true);
  const [moveFeedback, setMoveFeedback] = useState(null);
  // Feedback for every graded ply, keyed by ply number (1-indexed), so the
  // Moves table can show a quality + best-move column per move instead of
  // only the most recent one.
  const [feedbackHistory, setFeedbackHistory] = useState({});
  const savedRef = useRef(false); // guards against double-saving a finished game
  const gradingPlyRef = useRef(0); // ply number of the move currently being graded

  // Load saved prefs + warm up the engine once on mount.
  useEffect(() => {
    gameService.getPrefs().then((prefs) => {
      if (prefs.rating) setRating(prefs.rating);
      if (prefs.playerColor) setPlayerColor(prefs.playerColor);
    });

    engineService.init().then(() => setEngineReady(true));
    return () => engineService.terminate();
  }, []);

  const engineColor = playerColor === 'white' ? 'b' : 'w';

  // Ask the engine to move whenever it's the engine's turn.
  useEffect(() => {
    if (!gameInProgress || !engineReady) return;
    if (game.isGameOver) return;
    if (game.turn !== engineColor) return;

    let cancelled = false;
    setEngineThinking(true);
    engineService.getBestMove(game.fen, { movetimeMs: 700 }).then((uci) => {
      if (cancelled) return;
      setEngineThinking(false);
      if (uci) game.makeUciMove(uci);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen, gameInProgress, engineReady]);

  // Grade the player's own moves against the engine and surface a best-move
  // suggestion. Runs after any move (player or engine) but only produces
  // feedback for moves the player made.
  //
  // Note: this effect's deps include game.fen, which also changes when the
  // bot replies right after us. We must NOT let that later fen change cancel
  // grading that's still in flight for our move — so instead of an
  // effect-cleanup "cancelled" flag, we track the ply we're grading in a ref
  // and only apply a result if nothing newer has superseded it.
  useEffect(() => {
    if (!analyzeMoves || !engineReady || !gameInProgress) return;
    const last = game.history[game.history.length - 1];
    if (!last) return;

    const moverIsPlayer = (last.color === 'w') === (playerColor === 'white');
    if (!moverIsPlayer) return;

    const ply = game.history.length;
    gradingPlyRef.current = ply;
    const analyzing = { status: 'analyzing', san: last.san };
    setMoveFeedback(analyzing);
    setFeedbackHistory((prev) => ({ ...prev, [ply]: analyzing }));

    Promise.all([
      engineService.analyze(last.before, { movetimeMs: 500 }),
      engineService.analyze(last.after, { movetimeMs: 500 }),
    ]).then(([before, after]) => {
      if (gradingPlyRef.current !== ply) return; // a newer move superseded this grading
      const result = classifyMove({ move: last, before, after });
      setMoveFeedback(result);
      setFeedbackHistory((prev) => ({ ...prev, [ply]: result }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen, analyzeMoves, engineReady, gameInProgress]);

  // Drop any feedback entries for plies that no longer exist (e.g. after an undo).
  useEffect(() => {
    setFeedbackHistory((prev) => {
      const maxPly = game.history.length;
      let changed = false;
      const pruned = {};
      for (const [ply, value] of Object.entries(prev)) {
        if (Number(ply) <= maxPly) {
          pruned[ply] = value;
        } else {
          changed = true;
        }
      }
      return changed ? pruned : prev;
    });
  }, [game.history.length]);

  // Persist finished games exactly once.
  useEffect(() => {
    if (!gameInProgress || !game.isGameOver || savedRef.current) return;
    savedRef.current = true;
    const result = resultFromStatus(game.status, game.turn);
    gameService.saveGame({
      pgn: game.pgn,
      result,
      botRating: rating,
      playerColor,
    });
    setGameInProgress(false);
  }, [game.isGameOver, gameInProgress, game.status, game.turn, game.pgn, rating, playerColor]);

  const startNewGame = () => {
    const resolvedColor = playerColor === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : playerColor;
    setPlayerColor(resolvedColor);
    game.reset();
    savedRef.current = false;
    gradingPlyRef.current = 0;
    setMoveFeedback(null);
    setFeedbackHistory({});
    setGameInProgress(true);
    gameService.savePrefs({ rating, playerColor: resolvedColor });
    if (engineReady) engineService.setRating(rating);
  };

  const handleUserMove = (move) => {
    if (!gameInProgress || engineThinking) return null;
    if (game.turn === engineColor) return null; // not the player's turn
    return game.makeMove(move);
  };

  const handleUndo = () => {
    // Undo both the player's move and the engine's reply so it's the player's turn again.
    game.undo();
    game.undo();
    gradingPlyRef.current = 0;
    setMoveFeedback(null);
  };

  const handleResign = () => {
    savedRef.current = true;
    gameService.saveGame({
      pgn: game.pgn,
      result: playerColor === 'white' ? 'black-wins' : 'white-wins',
      botRating: rating,
      playerColor,
      resigned: true,
    });
    setGameInProgress(false);
  };

  const lastMove = game.history[game.history.length - 1];
  const statusMessage = STATUS_MESSAGES[game.status];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Chess Trainer</h1>
        <p className="tagline">Play. Analyze. Improve.</p>
      </header>

      <main className="app-main">
        <div className="board-row">
          <EvalBar score={moveFeedback?.whiteEval} />

          <div className="board-column">
            <Board
              fen={game.fen}
              orientation={playerColor === 'black' ? 'black' : 'white'}
              onUserMove={handleUserMove}
              lastMove={lastMove}
              legalMoves={game.legalMoves}
              interactive={gameInProgress && !engineThinking && game.turn !== engineColor}
            />
            {statusMessage && <p className="status-banner">{statusMessage}</p>}
            {!engineReady && <p className="status-banner">Loading engine…</p>}
            <MoveFeedback feedback={moveFeedback} />
          </div>
        </div>

        <aside className="side-column">
          <GameControls
            rating={rating}
            onRatingChange={setRating}
            playerColor={playerColor}
            onColorChange={setPlayerColor}
            onNewGame={startNewGame}
            onUndo={handleUndo}
            onResign={handleResign}
            canUndo={game.history.length >= 2}
            gameInProgress={gameInProgress}
            engineThinking={engineThinking}
            analyzeMoves={analyzeMoves}
            onAnalyzeMovesChange={setAnalyzeMoves}
          />
          <MoveList history={game.history} feedbackHistory={feedbackHistory} />
        </aside>
      </main>
    </div>
  );
}
