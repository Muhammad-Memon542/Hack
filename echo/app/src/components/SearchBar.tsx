"use client";

import { SearchIcon } from "./icons";

export function SearchBar({
  query,
  setQuery,
  onSubmit,
}: {
  query: string;
  setQuery: (v: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <div className="searchbar">
      <span className="search-lead">
        <SearchIcon size={20} />
      </span>
      <input
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        placeholder="Search predictions by keyword, creator, or subject"
        aria-label="Search predictions"
      />
      {query && (
        <button className="search-clear" aria-label="clear search" onClick={() => setQuery("")}>
          ✕
        </button>
      )}
      <button className="search-go" aria-label="search" onClick={onSubmit}>
        <SearchIcon size={20} />
      </button>
    </div>
  );
}
