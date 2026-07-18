"use client";

import { SearchIcon } from "./icons";

export function SearchBar({
  question,
  setQuestion,
  subject,
  setSubject,
  dateRange,
  setDateRange,
  onSubmit,
}: {
  question: string;
  setQuestion: (v: string) => void;
  subject: string;
  setSubject: (v: string) => void;
  dateRange: string;
  setDateRange: (v: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <div className="searchbar">
      <div className="search-seg">
        <label>Question</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
          placeholder="Search predictions"
        />
      </div>
      <div className="search-seg">
        <label>Resolution</label>
        <input value={dateRange} onChange={(e) => setDateRange(e.target.value)} placeholder="Add date range" />
      </div>
      <div className="search-seg">
        <label>Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
          placeholder="Add wallet or user"
        />
      </div>
      <button className="search-go" aria-label="search" onClick={onSubmit}>
        <SearchIcon size={20} />
      </button>
    </div>
  );
}
