import { evalToWhitePercent, formatEval } from '../engine/moveClassifier';

export default function EvalBar({ score }) {
  if (!score) return null;
  const whitePercent = evalToWhitePercent(score);
  const blackPercent = 100 - whitePercent;

  // The score coming in is from White's perspective. Black's own score is
  // just the mirror image of it (what's good for White is equally bad for
  // Black by the same amount).
  const blackScore = {
    cp: score.cp != null ? -score.cp : null,
    mate: score.mate != null ? -score.mate : null,
  };

  return (
    <div className="eval-bar" title="Position evaluation">
      <span className="eval-bar-label eval-bar-label-black">{formatEval(blackScore)}</span>
      <div className="eval-bar-track">
        <div className="eval-bar-black" style={{ height: `${blackPercent}%` }} />
        <div className="eval-bar-white" style={{ height: `${whitePercent}%` }} />
      </div>
      <span className="eval-bar-label eval-bar-label-white">{formatEval(score)}</span>
    </div>
  );
}
