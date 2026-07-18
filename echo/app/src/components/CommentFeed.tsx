"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEchoStore } from "@/store/useEchoStore";

interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  user: { username: string; reputationScore: number };
}

/** High-frequency social state — served from PostgreSQL, not the chain. */
export function CommentFeed({ marketId }: { marketId: string }) {
  const session = useEchoStore((s) => s.session);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const commentsQuery = useQuery<CommentRow[]>({
    queryKey: ["comments", marketId],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${marketId}/comments`);
      if (!res.ok) throw new Error("failed to load comments");
      return (await res.json()).comments;
    },
  });

  const post = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/markets/${marketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed to post");
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
    },
  });

  return (
    <div className="panel">
      <h2>Discussion</h2>
      {session ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) post.mutate(draft);
          }}
        >
          <input
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Add your read on this market…"
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn-primary" disabled={post.isPending || !draft.trim()}>
            Post
          </button>
        </form>
      ) : (
        <p className="dim">Connect and sign in to join the discussion.</p>
      )}
      {post.isError && (
        <p className="error-text" style={{ marginTop: "0.4rem" }}>
          {post.error instanceof Error ? post.error.message : "failed to post"}
        </p>
      )}

      <div style={{ marginTop: "0.8rem" }}>
        {commentsQuery.isLoading && <p className="dim">Loading…</p>}
        {commentsQuery.isError && <p className="dim">Comments unavailable (database offline?).</p>}
        {commentsQuery.data?.length === 0 && <p className="dim">No comments yet.</p>}
        {commentsQuery.data?.map((c) => (
          <div className="comment" key={c.id}>
            <div className="meta">
              <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>@{c.user.username}</span>
              <span className="rep-pill">⬡ {c.user.reputationScore}</span>
              <span>· {new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <div>{c.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
