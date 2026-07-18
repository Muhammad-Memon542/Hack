"use client";

// Minimal inline line icons (stroke = currentColor) for a clean light UI.
type P = { size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const PinIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
export const GlobeIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
  </svg>
);
export const SearchIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);
export const BellIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);
export const ChevronLeft = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="m15 6-6 6 6 6" /></svg>
);
export const ChevronRight = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="m9 6 6 6-6 6" /></svg>
);
export const HeartIcon = ({ size = 17, filled = false }: P & { filled?: boolean }) => (
  <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7-4.3-9.3-8.3C1.2 9 2.3 5.8 5.3 5.1 7.2 4.7 9 5.6 10 7c1-1.4 2.8-2.3 4.7-1.9 3 .7 4.1 3.9 2.6 6.6C19 15.7 12 20 12 20Z" />
  </svg>
);

// --- category icons ---
export const ClockIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const GaugeIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M3 15a9 9 0 1 1 18 0" /><path d="m12 12 4-3" /><circle cx="12" cy="15" r="1.4" fill="currentColor" /></svg>
);
export const ShieldIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M12 3 5 6v5c0 4.4 3 8 7 10 4-2 7-5.6 7-10V6l-7-3Z" /></svg>
);
export const CheckCircleIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
);
export const TrophyIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 20h6M10 16v4M14 16v4" /></svg>
);
export const MonitorIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></svg>
);
export const HexIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" /></svg>
);
export const BankIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="M4 10 12 4l8 6M5 10v8m14-8v8M9 10v8m6-8v8M3 20h18" /></svg>
);
export const LayersIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>
);
