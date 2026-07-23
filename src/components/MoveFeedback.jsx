import { MOVE_TIERS } from '../engine/moveClassifier';

export default function MoveFeedback({ feedback }) {
  if (!feedback) return null;

  if (feedback.status === 'analyzing') {
    return (
      <div className="move-feedback analyzing">
        <span className="feedback-san">{feedback.san}</span>
        <span className="feedback-analyzing-label">Analyzing…</span>
      </div>
    );
  }

  const tier = MOVE_TIERS[feedback.tier];

  return (
    <div className="move-feedback" style={{ '--tier-color': tier.color }}>
      <div className="feedback-row">
        <span className="feedback-san">{feedback.san}</span>
        <span className="feedback-tier">{tier.label}</span>
      </div>
      {!feedback.isBest && feedback.bestMoveSan && (
        <p className="feedback-hint">
          Best was <strong>{feedback.bestMoveSan}</strong>
          {feedback.cpLoss > 0 && ` (${(feedback.cpLoss / 100).toFixed(1)} pawns lost)`}
        </p>
      )}
    </div>
  );
}
