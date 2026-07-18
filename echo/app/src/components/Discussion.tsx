"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/app/providers";
import {
  relativeTime,
  userById,
  type Comment,
  type Market,
} from "@/lib/mock";
import { Avatar } from "./primitives";
import { UserName } from "./UserName";

type SortMode = "Top" | "Newest" | "Controversial";
const MAX_DEPTH = 3;
const COLLAPSE_AFTER = 5;

interface Node {
  comment: Comment;
  children: Node[];
}

export function Discussion({ market }: { market: Market }) {
  const { connected, connect, comments, addComment } = useApp();
  const [sort, setSort] = useState<SortMode>("Top");
  const [draft, setDraft] = useState("");

  const marketComments = useMemo(
    () => comments.filter((c) => c.marketId === market.id),
    [comments, market.id]
  );

  const tree = useMemo(() => buildTree(marketComments, sort), [marketComments, sort]);

  return (
    <div className="panel">
      <div className="between" style={{ marginBottom: "0.9rem" }}>
        <h2 style={{ margin: 0 }}>Discussion · {marketComments.length}</h2>
        <div className="pills">
          {(["Top", "Newest", "Controversial"] as SortMode[]).map((s) => (
            <button key={s} className={`pill ${sort === s ? "active" : ""}`} onClick={() => setSort(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Connected: compose box. Not connected: sticky prompt ABOVE list, comments below. */}
      {connected ? (
        <div style={{ marginBottom: "0.5rem" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share your analysis…"
            style={{ minHeight: 64 }}
          />
          <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={draft.trim().length === 0}
              onClick={() => {
                addComment(market.id, draft.trim(), null);
                setDraft("");
              }}
            >
              Comment
            </button>
          </div>
        </div>
      ) : (
        <div className="sticky-prompt">
          <span className="dim">Connect and sign in to join the discussion</span>
          <button className="btn btn-primary btn-sm" onClick={connect}>
            Connect
          </button>
        </div>
      )}

      {tree.length === 0 ? (
        <div className="faint" style={{ padding: "0.8rem 0" }}>
          No comments yet. Be the first to make your case.
        </div>
      ) : (
        tree.map((node) => <CommentNode key={node.comment.id} node={node} market={market} depth={0} />)
      )}
    </div>
  );
}

function buildTree(list: Comment[], sort: SortMode): Node[] {
  const byId = new Map<string, Node>();
  list.forEach((c) => byId.set(c.id, { comment: c, children: [] }));
  const roots: Node[] = [];
  list.forEach((c) => {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.children.push(node);
    else roots.push(node);
  });

  const score = (n: Node): number => {
    if (sort === "Newest") return new Date(n.comment.createdAt).getTime();
    if (sort === "Top") return n.comment.tipsReceived * 10 + n.children.length;
    // Controversial: most replies relative to tips
    return n.children.length * 5 - n.comment.tipsReceived;
  };
  const sortRec = (nodes: Node[]) => {
    nodes.sort((a, b) => score(b) - score(a));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function CommentNode({ node, market, depth }: { node: Node; market: Market; depth: number }) {
  const { connected, addComment, me, positions, likesFor, hasLiked, toggleLike } = useApp();
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [tips, setTips] = useState(node.comment.tipsReceived);

  const author = userById(node.comment.userId);
  if (!author) return null;

  // Position tag with privacy check.
  const authorPos = positions.find((p) => p.marketId === market.id && p.userId === author.id);
  const canReveal =
    authorPos &&
    !author.privacy.hidePositions &&
    (author.privacy.revealPositionOnComment || author.id === me.id);

  const children = node.children;
  const atMaxDepth = depth >= MAX_DEPTH - 1;
  const visibleChildren = showAll ? children : children.slice(0, COLLAPSE_AFTER);
  const hidden = children.length - visibleChildren.length;

  return (
    <div className="comment">
      <div className="comment-head">
        <Avatar emoji={author.avatar} color={author.color} size={22} />
        <UserName username={author.username} />
        {canReveal && (
          <span className={`pos-tag ${authorPos!.side.toLowerCase()}`}>
            bet {authorPos!.side}, {authorPos!.amount} USDC
          </span>
        )}
        <span>·</span>
        <span>{relativeTime(node.comment.createdAt)}</span>
      </div>

      <div className="comment-body">{node.comment.content}</div>

      <div className="comment-actions">
        <button
          onClick={() => connected && toggleLike(node.comment.id)}
          style={hasLiked(node.comment.id) ? { color: "var(--accent)" } : undefined}
        >
          {hasLiked(node.comment.id) ? "♥" : "♡"} Like
          {likesFor(node.comment.id) > 0 && (
            <span className="tip-badge">· {likesFor(node.comment.id)}</span>
          )}
        </button>
        {!atMaxDepth && connected && (
          <button onClick={() => setReplying((v) => !v)}>Reply</button>
        )}
        <button onClick={() => setTips((t) => Math.round((t + 0.5) * 100) / 100)}>
          💸 Tip {tips > 0 && <span className="tip-badge">· {tips} USDC</span>}
        </button>
      </div>

      {replying && (
        <div style={{ marginTop: "0.5rem" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Reply to @${author.username}…`}
            style={{ minHeight: 56 }}
          />
          <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.4rem" }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setReplying(false)}>
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              disabled={draft.trim().length === 0}
              onClick={() => {
                addComment(market.id, draft.trim(), node.comment.id);
                setDraft("");
                setReplying(false);
                setShowAll(true);
              }}
            >
              Reply
            </button>
          </div>
        </div>
      )}

      {children.length > 0 && (
        <div className="replies">
          {visibleChildren.map((c) => (
            <CommentNode key={c.comment.id} node={c} market={market} depth={depth + 1} />
          ))}
          {hidden > 0 && (
            <button
              className="comment-actions"
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: "0.4rem 0" }}
              onClick={() => setShowAll(true)}
            >
              Show {hidden} more repl{hidden === 1 ? "y" : "ies"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
