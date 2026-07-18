"use client";

import { useMemo, useState } from "react";
import { useApp } from "../providers";
import { volume, type Market, type MarketStatus } from "@/lib/mock";
import { MarketCard } from "@/components/MarketCard";

const FILTERS = ["All", "Open", "Resolving", "Settled"] as const;
const SORTS = ["Newest", "Ending Soon", "Highest Volume", "Most Commented"] as const;

export default function MarketsPage() {
  const { markets } = useApp();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Newest");

  const shown = useMemo(() => {
    let list = [...markets];
    if (filter !== "All") {
      const map: Record<string, MarketStatus> = {
        Open: "OPEN",
        Resolving: "RESOLVING",
        Settled: "SETTLED",
      };
      // "Settled" also surfaces disputed as a resolved-ish bucket? Keep strict per label.
      list = list.filter((m) => m.status === map[filter]);
    }
    const byNewest = (a: Market, b: Market) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    switch (sort) {
      case "Newest":
        list.sort(byNewest);
        break;
      case "Ending Soon":
        list.sort((a, b) => new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime());
        break;
      case "Highest Volume":
        list.sort((a, b) => volume(b) - volume(a));
        break;
      case "Most Commented":
        list.sort((a, b) => b.commentCount - a.commentCount);
        break;
    }
    return list;
  }, [markets, filter, sort]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Markets</h1>
          <div className="page-sub">Discover what your neighborhood is betting on.</div>
        </div>
      </div>

      <div className="between" style={{ marginBottom: "1.25rem" }}>
        <div className="pills">
          {FILTERS.map((f) => (
            <button key={f} className={`pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <label className="row" style={{ gap: "0.5rem", margin: 0 }}>
          <span className="faint" style={{ fontSize: "0.82rem" }}>
            Sort
          </span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="empty">No {filter.toLowerCase()} markets right now.</div>
      ) : (
        <div className="market-grid">
          {shown.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
