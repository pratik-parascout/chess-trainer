const RATING_MARKS = [400, 800, 1200, 1600, 2000, 2400, 2800];

function ratingLabel(rating) {
  if (rating < 800) return 'Beginner';
  if (rating < 1200) return 'Casual';
  if (rating < 1600) return 'Club player';
  if (rating < 2000) return 'Strong club';
  if (rating < 2400) return 'Expert';
  if (rating < 2800) return 'Master';
  return 'Superhuman';
}

export default function GameControls({
  rating,
  onRatingChange,
  playerColor,
  onColorChange,
  onNewGame,
  onUndo,
  onResign,
  canUndo,
  gameInProgress,
  engineThinking,
  analyzeMoves,
  onAnalyzeMovesChange,
}) {
  return (
    <div className="game-controls">
      <div className="control-group">
        <label htmlFor="rating-slider">
          Bot rating <span className="rating-value">{rating}</span>
          <span className="rating-label">{ratingLabel(rating)}</span>
        </label>
        <input
          id="rating-slider"
          type="range"
          min={400}
          max={2800}
          step={25}
          value={rating}
          disabled={gameInProgress}
          onChange={(e) => onRatingChange(Number(e.target.value))}
        />
        <div className="rating-marks">
          {RATING_MARKS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Play as</span>
        <div className="color-choice">
          {['white', 'black', 'random'].map((c) => (
            <button
              key={c}
              className={playerColor === c ? 'active' : ''}
              disabled={gameInProgress}
              onClick={() => onColorChange(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group button-row">
        <button className="primary" onClick={onNewGame}>
          New game
        </button>
        <button onClick={onUndo} disabled={!canUndo || engineThinking}>
          Undo
        </button>
        <button onClick={onResign} disabled={!gameInProgress}>
          Resign
        </button>
      </div>

      <div className="control-group">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={analyzeMoves}
            onChange={(e) => onAnalyzeMovesChange(e.target.checked)}
          />
          <span>Move feedback (grade my moves, suggest the best move)</span>
        </label>
      </div>

      {engineThinking && <p className="engine-status">Engine is thinking…</p>}
    </div>
  );
}
