"use client";

import { useMemo, useState } from "react";
import { useApp } from "./providers";
import { volume, subjectByWallet, userById, type Market } from "@/lib/mock";
import { MarketCard } from "@/components/MarketCard";
import { SearchBar } from "@/components/SearchBar";
import { CategoryRow, type FilterKey } from "@/components/CategoryRow";
import { ClockIcon, ChevronLeft, ChevronRight } from "@/components/icons";

const PAGE_SIZE = 6;
const STATUS_FILTERS: Record<string, Market["status"]> = {
  Open: "OPEN",
  Resolving: "RESOLVING",
  Settled: "SETTLED",
};
const CATEGORY_FILTERS = new Set(["Sports", "Tech", "Crypto", "Politics"]);

export default function BrowsePage() {
  const { markets } = useApp();
  const [filter, setFilter] = useState<FilterKey>("All");
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = [...markets];
    if (STATUS_FILTERS[filter]) list = list.filter((m) => m.status === STATUS_FILTERS[filter]);
    else if (CATEGORY_FILTERS.has(filter)) list = list.filter((m) => m.category === filter);

    const q = question.trim().toLowerCase();
    if (q) list = list.filter((m) => m.question.toLowerCase().includes(q));

    const s = subject.trim().toLowerCase();
    if (s)
      list = list.filter((m) => {
        const creator = userById(m.creatorId);
        const subj = subjectByWallet(m.subjectWallet);
        return (
          creator?.username.toLowerCase().includes(s) ||
          (subj?.name ?? "").toLowerCase().includes(s) ||
          (m.subjectWallet ?? "").toLowerCase().includes(s)
        );
      });

    return list.sort((a, b) => volume(b) - volume(a));
  }, [markets, filter, question, subject]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const onFilter = (k: FilterKey) => {
    setFilter(k);
    setPage(0);
  };

  return (
    <div>
      <SearchBar
        question={question}
        setQuestion={(v) => { setQuestion(v); setPage(0); }}
        subject={subject}
        setSubject={(v) => { setSubject(v); setPage(0); }}
        dateRange={dateRange}
        setDateRange={setDateRange}
      />

      <CategoryRow active={filter} onSelect={onFilter} />

      <div className="trend-head">
        <h2>
          <ClockIcon size={22} /> Trending predictions
        </h2>
        <div className="carousel-btns">
          <button aria-label="previous" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft />
          </button>
          <button aria-label="next" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
            <ChevronRight />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty">No predictions match your filters.</div>
      ) : (
        <div className="market-grid">
          {visible.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
