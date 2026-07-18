"use client";

import {
  ClockIcon,
  GaugeIcon,
  ShieldIcon,
  CheckCircleIcon,
  TrophyIcon,
  MonitorIcon,
  HexIcon,
  BankIcon,
} from "./icons";

export type FilterKey =
  | "All"
  | "Open"
  | "Resolving"
  | "Settled"
  | "Sports"
  | "Tech"
  | "Crypto"
  | "Politics";

const ITEMS: { key: FilterKey; icon: (p: { size?: number }) => JSX.Element }[] = [
  { key: "All", icon: ClockIcon },
  { key: "Open", icon: GaugeIcon },
  { key: "Resolving", icon: ShieldIcon },
  { key: "Settled", icon: CheckCircleIcon },
  { key: "Sports", icon: TrophyIcon },
  { key: "Tech", icon: MonitorIcon },
  { key: "Crypto", icon: HexIcon },
  { key: "Politics", icon: BankIcon },
];

export function CategoryRow({
  active,
  onSelect,
}: {
  active: FilterKey;
  onSelect: (k: FilterKey) => void;
}) {
  return (
    <div className="cat-row">
      {ITEMS.map(({ key, icon: Icon }) => (
        <button key={key} className={`cat ${active === key ? "active" : ""}`} onClick={() => onSelect(key)}>
          <Icon size={20} />
          <span>{key}</span>
        </button>
      ))}
    </div>
  );
}
