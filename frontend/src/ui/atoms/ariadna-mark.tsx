/**
 * Ariadna's mark: a square labyrinth with the thread leaving it.
 * Decorative only (the wordmark beside it carries the name), so it is hidden from assistive tech.
 * Drawn with `currentColor`, so each surface sets its colour in CSS.
 */
export function AriadnaMark() {
  return (
    <svg
      className="ariadna-mark"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24 24H28V28H20V20H32V32H16V16H36V36H12V12H40V8H44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
