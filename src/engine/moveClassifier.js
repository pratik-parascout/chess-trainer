import { Chess } from 'chess.js';

// Ordered worst-to-best isn't needed here, just label + color per tier.
// Thresholds are centipawn-loss cutoffs, chess.com/lichess style.
export const MOVE_TIERS = {
  best: { label: 'Best move', color: 'var(--color-tier-best)' },
  excellent: { label: 'Excellent', color: 'var(--color-tier-excellent)' },
  good: { label: 'Good', color: 'var(--color-tier-good)' },
  inaccuracy: { label: 'Inaccuracy', color: 'var(--color-tier-inaccuracy)' },
  mistake: { label: 'Mistake', color: 'var(--color-tier-mistake)' },
  blunder: { label: 'Blunder', color: 'var(--color-tier-blunder)' },
};

const CP_LOSS_THRESHOLDS = [
  ['best', 15],
  ['excellent', 40],
  ['good', 90],
  ['inaccuracy', 180],
  ['mistake', 400],
];

/** Collapse a {cp, mate} engine score into one comparable centipawn number. */
export function scoreToCp({ cp, mate }) {
  if (mate != null) return mate > 0 ? 100000 - mate * 100 : -100000 - mate * 100;
  return cp ?? 0;
}

/** Flip a score to the other side's point of view. */
function negate({ cp, mate }) {
  return { cp: cp == null ? null : -cp, mate: mate == null ? null : -mate };
}

function uciToSan(fen, uci) {
  if (!uci) return null;
  try {
    const temp = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4) : undefined;
    const result = temp.move({ from, to, promotion });
    return result ? result.san : null;
  } catch {
    return null;
  }
}

/**
 * Grade a move the player just made.
 * @param {object} move - verbose chess.js move ({ san, from, to, promotion, color, before, after })
 * @param {{bestMove: string|null, cp: number|null, mate: number|null}} before - engine analysis of the position before the move (mover's perspective)
 * @param {{bestMove: string|null, cp: number|null, mate: number|null}} after - engine analysis of the position after the move (opponent's perspective)
 */
export function classifyMove({ move, before, after }) {
  const beforeCp = scoreToCp(before);
  const afterForMover = negate(after);
  const resultingCp = scoreToCp(afterForMover);
  const cpLoss = Math.max(0, Math.round(beforeCp - resultingCp));

  const playedUci = `${move.from}${move.to}${move.promotion ?? ''}`;
  const isBest = before.bestMove === playedUci;

  let tier = 'blunder';
  if (isBest) {
    tier = 'best';
  } else {
    for (const [name, cutoff] of CP_LOSS_THRESHOLDS) {
      if (cpLoss < cutoff) {
        tier = name;
        break;
      }
    }
  }

  // Eval of the resulting position, always from White's perspective, for
  // a simple running "who's better" readout.
  const whiteEval = move.color === 'w' ? negate(after) : after;

  return {
    san: move.san,
    tier,
    cpLoss,
    isBest,
    bestMoveSan: isBest ? null : uciToSan(move.before, before.bestMove),
    bestMoveFrom: before.bestMove ? before.bestMove.slice(0, 2) : null,
    bestMoveTo: before.bestMove ? before.bestMove.slice(2, 4) : null,
    whiteEval,
  };
}

/** Format a {cp, mate} score (White's perspective) as "+0.6" / "-1.2" / "#3" / "#-2". */
export function formatEval({ cp, mate }) {
  if (mate != null) return mate > 0 ? `#${mate}` : `#${mate}`;
  if (cp == null) return '—';
  const pawns = cp / 100;
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

/** Roughly map a White-perspective score to a 0-100 "White's share" for an eval bar. */
export function evalToWhitePercent({ cp, mate }) {
  if (mate != null) return mate > 0 ? 100 : 0;
  if (cp == null) return 50;
  // Standard-ish sigmoid squash so huge material swings don't blow past the ends.
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-clamped / 260)) - 1);
}
