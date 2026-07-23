import { useEffect, useState } from 'react';
import { Chessboard, defaultPieces } from 'react-chessboard';

const PROMOTION_CHOICES = ['q', 'r', 'b', 'n'];

/** True if a piece of type `pieceType` (e.g. "wP") moving to `toSquare` is a pawn reaching the back rank. */
function isPromotionMove(pieceType, toSquare) {
  if (!pieceType || !toSquare) return false;
  const isPawn = pieceType[1]?.toUpperCase() === 'P';
  const rank = toSquare[1];
  return isPawn && (rank === '8' || rank === '1');
}

/**
 * Presentational wrapper around react-chessboard (v5 "options" API).
 * Chess logic lives in useChessGame — this component translates drag/drop
 * and click-to-move interactions into onUserMove calls, and renders legal
 * destination squares for whichever piece is selected.
 */
export default function Board({
  fen,
  orientation,
  onUserMove,
  lastMove,
  legalMoves,
  interactive = true,
}) {
  const [selected, setSelected] = useState(null); // square string, e.g. "e2"
  const [selectedPiece, setSelectedPiece] = useState(null); // { pieceType } of `selected`
  const [targets, setTargets] = useState([]); // verbose chess.js moves from `selected`
  const [pendingPromotion, setPendingPromotion] = useState(null); // { from, to, color } awaiting piece choice

  // Clear any in-progress selection whenever the position changes or the
  // board stops being interactive (engine thinking, game over, etc).
  useEffect(() => {
    setSelected(null);
    setSelectedPiece(null);
    setTargets([]);
    setPendingPromotion(null);
  }, [fen, interactive]);

  const sideToMove = fen.split(' ')[1]; // 'w' | 'b'

  const selectSquare = (square, piece) => {
    if (!piece || piece.pieceType[0] !== sideToMove) {
      setSelected(null);
      setSelectedPiece(null);
      setTargets([]);
      return;
    }
    setSelected(square);
    setSelectedPiece(piece);
    setTargets(legalMoves ? legalMoves(square) : []);
  };

  const handleSquareClick = ({ square, piece }) => {
    if (!interactive || pendingPromotion) return;

    if (selected === square) {
      setSelected(null);
      setSelectedPiece(null);
      setTargets([]);
      return;
    }

    if (selected) {
      const target = targets.find((m) => m.to === square);
      if (target) {
        if (isPromotionMove(selectedPiece?.pieceType, square)) {
          setPendingPromotion({ from: selected, to: square, color: sideToMove });
          setSelected(null);
          setSelectedPiece(null);
          setTargets([]);
          return;
        }
        const moved = onUserMove({ from: selected, to: square, promotion: 'q' });
        setSelected(null);
        setSelectedPiece(null);
        setTargets([]);
        if (moved) return;
      }
    }

    selectSquare(square, piece);
  };

  const choosePromotion = (piece) => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    onUserMove({ from, to, promotion: piece });
  };

  const cancelPromotion = () => setPendingPromotion(null);

  const squareStyles = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: 'var(--color-highlight)' };
    squareStyles[lastMove.to] = { backgroundColor: 'var(--color-highlight)' };
  }
  if (selected) {
    squareStyles[selected] = { ...squareStyles[selected], backgroundColor: 'var(--color-selected)' };
  }
  for (const move of targets) {
    const isCapture = move.flags.includes('c') || move.flags.includes('e');
    squareStyles[move.to] = {
      ...squareStyles[move.to],
      backgroundImage: isCapture
        ? 'radial-gradient(circle, transparent 58%, var(--color-move-dot) 60%, var(--color-move-dot) 68%, transparent 70%)'
        : 'radial-gradient(circle, var(--color-move-dot) 22%, transparent 24%)',
      cursor: 'pointer',
    };
  }

  const options = {
    position: fen,
    boardOrientation: orientation,
    animationDurationInMs: 150,
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)' },
    squareStyles,
    allowDragging: interactive,
    onSquareClick: handleSquareClick,
    onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
      if (!targetSquare || pendingPromotion) return false;
      setSelected(null);
      setSelectedPiece(null);
      setTargets([]);

      if (isPromotionMove(piece?.pieceType, targetSquare)) {
        // Make sure this is actually a legal move before opening the picker —
        // an illegal drag shouldn't pop up a promotion dialog.
        const candidates = legalMoves ? legalMoves(sourceSquare) : [];
        const isLegal = candidates.some((m) => m.to === targetSquare);
        if (!isLegal) return false;
        setPendingPromotion({ from: sourceSquare, to: targetSquare, color: sideToMove });
        return false; // snap back for now; the move commits once a piece is chosen
      }

      const result = onUserMove({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      return Boolean(result);
    },
  };

  return (
    <div className="board-wrap">
      <Chessboard options={options} />
      {pendingPromotion && (
        <div className="promotion-overlay" onClick={cancelPromotion}>
          <div className="promotion-picker" onClick={(e) => e.stopPropagation()}>
            <p className="promotion-title">Promote to</p>
            <div className="promotion-options">
              {PROMOTION_CHOICES.map((piece) => {
                const key = `${pendingPromotion.color}${piece.toUpperCase()}`;
                const PieceIcon = defaultPieces[key];
                return (
                  <button
                    key={piece}
                    type="button"
                    className="promotion-option"
                    aria-label={`Promote to ${piece.toUpperCase()}`}
                    onClick={() => choosePromotion(piece)}
                  >
                    {PieceIcon ? PieceIcon({ svgStyle: { width: '100%', height: '100%' } }) : piece.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
