import Link from "next/link";

const TABS = [
  { key: "", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "RESOLVING", label: "Resolving" },
  { key: "SETTLED", label: "Settled" },
] as const;

export function StatusTabs({ active }: { active: string }) {
  return (
    <div className="tabs">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.key ? `/?status=${t.key}` : "/"}
          className={active === t.key ? "active" : ""}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
