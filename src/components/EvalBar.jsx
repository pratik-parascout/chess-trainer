import { evalToWhitePercent, formatEval } from '../engine/moveClassifier';

export default function EvalBar({ score }) {
  if (!score) return null;
  const whitePercent = evalToWhitePercent(score);

  return (
    <div className="eval-bar" title="Position evaluation (White's perspective)">
      <div className="eval-bar-track">
        <div className="eval-bar-white" style={{ height: `${whitePercent}%` }} />
      </div>
      <span className="eval-bar-label">{formatEval(score)}</span>
    </div>
  );
}
