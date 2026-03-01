/**
 * Inline SVG icons — stroke-based, Lucide-style.
 * All icons use currentColor so they inherit the parent's color.
 * Default size 16 px; pass `size` or `className` to override.
 */

const defaults = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

function icon(size, className, style) {
  return { ...defaults, width: size, height: size, className, style };
}

export function BookOpen({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function FileText({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

export function Shuffle({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}

/* ── Metric icons ── */

export function Zap({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function Shapes({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="3.5" />
      <polygon points="17 4 20.5 11 13.5 11" />
      <rect x="4" y="14" width="7" height="7" rx="1" />
      <polygon points="17 13.5 20.5 17.5 17 21.5 13.5 17.5" />
    </svg>
  );
}

export function Link({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function Target({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/* ── UI icons ── */

export function Search({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function CircleCheck({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function SmileFace({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function FrownFace({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function CloudUpload({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}

export function Download({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/* ── Formatting icons ── */

export function Italic({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

export function AlignCenter({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="17" y1="12" x2="7" y2="12" />
      <line x1="19" y1="18" x2="5" y2="18" />
    </svg>
  );
}

export function IndentIncrease({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <polyline points="3 8 7 12 3 16" />
      <line x1="21" y1="12" x2="11" y2="12" />
      <line x1="21" y1="6" x2="11" y2="6" />
      <line x1="21" y1="18" x2="11" y2="18" />
    </svg>
  );
}

export function Undo({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function Bold({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

export function Underline({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  );
}

export function XCircle({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function Clock({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function StarIcon({ size = 16, className, style }) {
  return (
    <svg {...icon(size, className, style)} aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
