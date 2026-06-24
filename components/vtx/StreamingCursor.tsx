'use client';

/**
 * StreamingCursor — gradient block cursor that pulses while the
 * server is streaming SSE tokens. Sits inline with the last
 * assistant message during the stream + disappears the moment the
 * 'done' event lands.
 *
 * Audit §B.5 P1 streaming caret.
 */

export function StreamingCursor() {
  return (
    <>
      <span aria-hidden className="naka-stream-cursor" />
      <style jsx>{`
        .naka-stream-cursor {
          display: inline-block;
          width: 8px;
          height: 14px;
          margin-left: 2px;
          vertical-align: -2px;
          background: linear-gradient(135deg, #0066FF, #7C3AED);
          border-radius: 2px;
          animation: naka-stream-blink 1.05s ease-in-out infinite;
        }
        @keyframes naka-stream-blink {
          0%,   100% { opacity: 1; transform: scaleY(1); }
          50%       { opacity: 0.35; transform: scaleY(0.85); }
        }
        @media (prefers-reduced-motion: reduce) {
          .naka-stream-cursor { animation: none; opacity: 0.9; }
        }
      `}</style>
    </>
  );
}
