"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "./providers";
import { volume, subjectByWallet, userById, type Market } from "@/lib/mock";
import { MarketCard } from "@/components/MarketCard";
import { SearchBar } from "@/components/SearchBar";
import { CategoryRow, type FilterKey } from "@/components/CategoryRow";
import { NowTradingStrip } from "@/components/NowTradingStrip";
import { ClockIcon, ChevronLeft, ChevronRight } from "@/components/icons";

const PAGE_SIZE = 6;
const STATUS_FILTERS: Record<string, Market["status"]> = {
  Open: "OPEN",
  Resolving: "RESOLVING",
  Settled: "SETTLED",
};
const CATEGORY_FILTERS = new Set(["Sports", "Tech", "Crypto", "Politics"]);

export default function BrowsePage() {
  const { markets, me, positions } = useApp();
  const [filter, setFilter] = useState<FilterKey>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // Base list after filter/search — used by all sections below.
  const filtered = useMemo(() => {
    let list = [...markets];
    if (STATUS_FILTERS[filter]) list = list.filter((m) => m.status === STATUS_FILTERS[filter]);
    else if (CATEGORY_FILTERS.has(filter)) list = list.filter((m) => m.category === filter);

    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length) {
      list = list.filter((m) => {
        const creator = userById(m.creatorId);
        const subj = subjectByWallet(m.subjectWallet);
        const haystack = [
          m.question, m.description, creator?.username, subj?.name,
          m.subjectWallet, m.category, ...(m.tags ?? []),
        ].filter(Boolean).join(" ").toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });
    }
    return list;
  }, [markets, filter, query]);

  // Social-first sections.
  const followingSet = useMemo(() => new Set(me.following), [me.following]);

  const fromFriends = useMemo(
    () => filtered
      .filter((m) => followingSet.has(m.creatorId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [filtered, followingSet]
  );

  const friendsAreTrading = useMemo(() => {
    const marketIds = new Set<string>();
    for (const p of positions) if (followingSet.has(p.userId)) marketIds.add(p.marketId);
    return filtered
      .filter((m) => marketIds.has(m.id) && !fromFriends.some((f) => f.id === m.id))
      .sort((a, b) => volume(b) - volume(a))
      .slice(0, 6);
  }, [filtered, positions, followingSet, fromFriends]);

  // Trending = the rest, sorted by volume.
  const excluded = new Set([...fromFriends.map((m) => m.id), ...friendsAreTrading.map((m) => m.id)]);
  const trending = useMemo(
    () => filtered.filter((m) => !excluded.has(m.id)).sort((a, b) => volume(b) - volume(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, fromFriends, friendsAreTrading]
  );

  const pageCount = Math.max(1, Math.ceil(trending.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = trending.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const onFilter = (k: FilterKey) => { setFilter(k); setPage(0); };

  return (
    <div>
      <NowTradingStrip />

      <SearchBar query={query} setQuery={(v) => { setQuery(v); setPage(0); }} />

      <CategoryRow active={filter} onSelect={onFilter} />

      {filtered.length === 0 && (
        <div className="empty">No predictions match your filters.</div>
      )}

      {fromFriends.length > 0 && (
        <section className="feed-section">
          <div className="feed-section-head">
            <h2>
              <span className="feed-section-emoji">✨</span> From your friends
            </h2>
            <Link href="/for-you" className="feed-section-more">
              See all →
            </Link>
          </div>
          <div className="market-grid">
            {fromFriends.map((m) => <MarketCard key={m.id} market={m} />)}
          </div>
        </section>
      )}

      {friendsAreTrading.length > 0 && (
        <section className="feed-section">
          <div className="feed-section-head">
            <h2>
              <span className="feed-section-emoji">🔥</span> Your friends are trading
            </h2>
            <Link href="/friends" className="feed-section-more">
              Friends →
            </Link>
          </div>
          <div className="market-grid">
            {friendsAreTrading.map((m) => <MarketCard key={m.id} market={m} />)}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="feed-section">
          <div className="feed-section-head">
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
          <div className="market-grid">
            {visible.map((m) => <MarketCard key={m.id} market={m} />)}
          </div>
        </section>
      )}
    </div>
  );
}
