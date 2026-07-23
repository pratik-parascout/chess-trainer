import { MOVE_TIERS } from '../engine/moveClassifier';

export default function MoveList({ history, feedbackHistory = {} }) {
  const rows = history.map((move, idx) => {
    const ply = idx + 1;
    return { ply, move, moveNumber: Math.floor(idx / 2) + 1 };
  });
  const latestFirst = [...rows].reverse();

  return (
    <div className="move-list">
      <h3>Moves</h3>
      {history.length === 0 ? (
        <p className="empty-state">No moves yet — make the first move on the board.</p>
      ) : (
        <div className="move-table-wrap">
          <table className="move-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Move</th>
                <th>Quality</th>
                <th>Best move</th>
              </tr>
            </thead>
            <tbody>
              {latestFirst.map(({ ply, move, moveNumber }) => {
                const feedback = feedbackHistory[ply];
                const isAnalyzing = feedback?.status === 'analyzing';
                const tier = feedback && !isAnalyzing ? MOVE_TIERS[feedback.tier] : null;

                return (
                  <tr key={ply} className={move.color === 'w' ? 'row-white' : 'row-black'}>
                    <td className="move-number">
                      {moveNumber}
                      {move.color === 'w' ? '.' : '…'}
                    </td>
                    <td className="move-san">{move.san}</td>
                    <td className="move-quality">
                      {isAnalyzing ? (
                        <span className="quality-analyzing">Analyzing…</span>
                      ) : tier ? (
                        <span className="quality-chip" style={{ '--tier-color': tier.color }}>
                          {tier.label}
                        </span>
                      ) : (
                        <span className="quality-none">—</span>
                      )}
                    </td>
                    <td className="move-best">
                      {isAnalyzing ? (
                        '…'
                      ) : feedback?.isBest ? (
                        <span className="best-is-played">✓ played</span>
                      ) : (
                        feedback?.bestMoveSan ?? '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
