"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import {
  users as seedUsers,
  markets as seedMarkets,
  positions as seedPositions,
  comments as seedComments,
  notifications as seedNotifications,
  CURRENT_USER_ID,
  hydrateFromServer,
  setCurrentUserIdentity,
  deriveHandle,
  type Market,
  type Position,
  type Comment,
  type AppNotification,
  type ActivityEvent,
  type Side,
  type User,
} from "@/lib/mock";

interface CreateMarketInput {
  question: string;
  description: string;
  closesAt: string;
  subjectWallet: string | null;
}

interface MutationResult {
  ok: boolean;
  error?: string;
}

export interface AuthIdentity {
  name: string;
  email: string | null;
  picture: string | null;
}

interface AppState {
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  /** Real Auth0 identity when logged in via Auth0 (null in demo mode). */
  authUser: AuthIdentity | null;
  /** Whether Auth0 is configured (NEXT_PUBLIC_AUTH0_ENABLED=true). */
  authEnabled: boolean;
  /** Log out of Auth0 (or exit demo mode when Auth0 is off). */
  logout: () => void;
  me: User;
  users: User[];

  following: string[];
  followingMarkets: string[];
  followingSubjects: string[];
  isFollowing: (userId: string) => boolean;
  toggleFollow: (userId: string) => void;
  isFollowingMarket: (id: string) => boolean;
  toggleFollowMarket: (id: string) => void;
  isFollowingSubject: (wallet: string) => boolean;
  toggleFollowSubject: (wallet: string) => void;

  markets: Market[];
  positions: Position[];
  comments: Comment[];
  activity: ActivityEvent[];
  createMarket: (input: CreateMarketInput) => Promise<string | null>;
  placeBet: (marketId: string, side: Side, amount: number) => Promise<MutationResult>;
  addComment: (marketId: string, content: string, parentId: string | null) => Promise<void>;

  // comment reactions
  likesFor: (commentId: string) => number;
  hasLiked: (commentId: string) => boolean;
  toggleLike: (commentId: string) => void;

  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;

  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;

  // Unifold-funded USDC balance (server ledger).
  balanceUsdc: number;
  refreshState: () => Promise<void>;
  depositOpen: boolean;
  setDepositOpen: (v: boolean) => void;
  loading: boolean;
}

const AppContext = createContext<AppState | null>(null);

const LS_KEY = "echo_app_state_v2";

interface Persisted {
  connected: boolean;
  followingMarkets: string[];
  followingSubjects: string[];
  read: string[];
}

interface Snapshot {
  users: User[];
  markets: Market[];
  positions: Position[];
  comments: Comment[];
  activity: ActivityEvent[];
  commentLikes: Record<string, string[]>;
  balanceUsdc: number;
}

const seedUser = seedUsers.find((u) => u.id === CURRENT_USER_ID)!;

const AUTH0_ENABLED = process.env.NEXT_PUBLIC_AUTH0_ENABLED === "true";

export function Providers({ children }: { children: React.ReactNode }) {
  // Server-backed world state (seeded locally for first paint / SSR parity).
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [markets, setMarkets] = useState<Market[]>(seedMarkets);
  const [positions, setPositions] = useState<Position[]>(seedPositions);
  const [comments, setComments] = useState<Comment[]>(seedComments);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [commentLikes, setCommentLikes] = useState<Record<string, string[]>>({});
  const [balanceUsdc, setBalanceUsdc] = useState(0);
  const [loading, setLoading] = useState(true);

  // Client-only personalization slice (persisted to localStorage).
  const [connected, setConnected] = useState(false);
  const [followingMarkets, setFollowingMarkets] = useState<string[]>(seedUser.followingMarkets);
  const [followingSubjects, setFollowingSubjects] = useState<string[]>(seedUser.followingSubjects);
  const [readIds, setReadIds] = useState<string[]>(
    seedNotifications.filter((n) => n.read).map((n) => n.id)
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Auth0 session (v4). When Auth0 is enabled it is the source of truth for
  // whether the user is signed in; otherwise the demo `connected` flag is.
  const { user: auth0User } = useUser();
  const authUser = useMemo<AuthIdentity | null>(
    () =>
      auth0User
        ? {
            name: (auth0User.name as string) ?? (auth0User.email as string) ?? "Member",
            email: (auth0User.email as string) ?? null,
            picture: (auth0User.picture as string) ?? null,
          }
        : null,
    [auth0User]
  );

  const applySnapshot = useCallback((snap: Snapshot) => {
    hydrateFromServer(snap); // keep mock helpers (buildFeed, positionsFor, …) in sync
    setUsers(snap.users);
    setMarkets(snap.markets);
    setPositions(snap.positions);
    setComments(snap.comments);
    setActivity(snap.activity ?? []);
    setCommentLikes(snap.commentLikes ?? {});
    if (typeof snap.balanceUsdc === "number") setBalanceUsdc(snap.balanceUsdc);
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?userId=${CURRENT_USER_ID}`);
      if (!res.ok) return;
      applySnapshot((await res.json()) as Snapshot);
    } catch {
      /* offline — keep seed data */
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  // hydrate persisted personalization slice
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p: Persisted = JSON.parse(raw);
        setConnected(p.connected);
        setFollowingMarkets(p.followingMarkets ?? seedUser.followingMarkets);
        setFollowingSubjects(p.followingSubjects ?? seedUser.followingSubjects);
        setReadIds(p.read ?? []);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // load server state on mount
  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // When Auth0 is enabled, mirror its session into the app's `connected` gate
  // and overlay the signed-in identity onto the current-user record so the
  // whole app shows "you" (name, @handle, avatar) instead of the demo user.
  useEffect(() => {
    if (!AUTH0_ENABLED) return;
    setConnected(!!authUser);
    if (authUser) {
      setCurrentUserIdentity({
        username: deriveHandle({ email: authUser.email, name: authUser.name }),
        picture: authUser.picture,
        bio: authUser.email ?? undefined,
      });
    } else {
      setCurrentUserIdentity(null);
    }
    // Re-clone the current-user object so context consumers re-render with the
    // freshly-mutated identity fields.
    setUsers((prev) => prev.map((u) => (u.id === CURRENT_USER_ID ? { ...u } : u)));
  }, [authUser]);

  const logout = useCallback(() => {
    if (AUTH0_ENABLED) {
      window.location.href = "/auth/logout";
    } else {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const p: Persisted = { connected, followingMarkets, followingSubjects, read: readIds };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, [hydrated, connected, followingMarkets, followingSubjects, readIds]);

  const me = useMemo<User>(
    () => users.find((u) => u.id === CURRENT_USER_ID) ?? seedUser,
    [users]
  );
  const following = me.following;

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // -------- mutations (server-backed) --------

  const createMarket = useCallback(
    async (input: CreateMarketInput): Promise<string | null> => {
      try {
        const res = await fetch("/api/markets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: CURRENT_USER_ID,
            question: input.question,
            description: input.description,
            closesAt: input.closesAt,
            subjectWallet: input.subjectWallet,
          }),
        });
        const data = await res.json();
        if (!res.ok) return null;
        await refreshState();
        setFollowingMarkets((prev) =>
          data.market?.id && !prev.includes(data.market.id) ? [...prev, data.market.id] : prev
        );
        return data.market?.id ?? null;
      } catch {
        return null;
      }
    },
    [refreshState]
  );

  const placeBet = useCallback(
    async (marketId: string, side: Side, amount: number): Promise<MutationResult> => {
      try {
        const res = await fetch("/api/bets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: CURRENT_USER_ID, marketId, side, amountUsdc: amount }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data?.error ?? "bet failed" };
        if (typeof data.balanceUsdc === "number") setBalanceUsdc(data.balanceUsdc);
        await refreshState();
        setFollowingMarkets((prev) => (prev.includes(marketId) ? prev : [...prev, marketId]));
        return { ok: true };
      } catch {
        return { ok: false, error: "network error" };
      }
    },
    [refreshState]
  );

  const addComment = useCallback(
    async (marketId: string, content: string, parentId: string | null): Promise<void> => {
      try {
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: CURRENT_USER_ID, marketId, content, parentId }),
        });
        if (res.ok) {
          await refreshState();
          setFollowingMarkets((prev) => (prev.includes(marketId) ? prev : [...prev, marketId]));
        }
      } catch {
        /* ignore */
      }
    },
    [refreshState]
  );

  const toggleFollow = useCallback(
    async (userId: string) => {
      // optimistic
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === CURRENT_USER_ID) {
            const has = u.following.includes(userId);
            return {
              ...u,
              following: has
                ? u.following.filter((id) => id !== userId)
                : [...u.following, userId],
            };
          }
          if (u.id === userId) {
            const has = u.followers.includes(CURRENT_USER_ID);
            return {
              ...u,
              followers: has
                ? u.followers.filter((id) => id !== CURRENT_USER_ID)
                : [...u.followers, CURRENT_USER_ID],
            };
          }
          return u;
        })
      );
      try {
        await fetch("/api/follow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: CURRENT_USER_ID, targetUserId: userId }),
        });
        await refreshState();
      } catch {
        /* revert on next refresh */
      }
    },
    [refreshState]
  );

  const toggleLike = useCallback(
    async (commentId: string) => {
      // optimistic
      setCommentLikes((prev) => {
        const list = prev[commentId] ?? [];
        const has = list.includes(CURRENT_USER_ID);
        return {
          ...prev,
          [commentId]: has
            ? list.filter((id) => id !== CURRENT_USER_ID)
            : [...list, CURRENT_USER_ID],
        };
      });
      try {
        await fetch("/api/likes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: CURRENT_USER_ID, commentId }),
        });
      } catch {
        /* ignore */
      }
    },
    []
  );

  const notifications = useMemo<AppNotification[]>(
    () =>
      seedNotifications
        .map((n) => ({ ...n, read: readIds.includes(n.id) }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [readIds]
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  const value: AppState = {
    connected,
    connect: () => setConnected(true),
    disconnect: () => setConnected(false),
    authUser,
    authEnabled: AUTH0_ENABLED,
    logout,
    me,
    users,
    following,
    followingMarkets,
    followingSubjects,
    isFollowing: (id) => following.includes(id),
    toggleFollow,
    isFollowingMarket: (id) => followingMarkets.includes(id),
    toggleFollowMarket: (id) => toggle(setFollowingMarkets, id),
    isFollowingSubject: (w) => followingSubjects.includes(w),
    toggleFollowSubject: (w) => toggle(setFollowingSubjects, w),
    markets,
    positions,
    comments,
    activity,
    createMarket,
    placeBet,
    addComment,
    likesFor: (id) => (commentLikes[id] ?? []).length,
    hasLiked: (id) => (commentLikes[id] ?? []).includes(CURRENT_USER_ID),
    toggleLike,
    notifications,
    unreadCount,
    markAllRead: () => setReadIds(seedNotifications.map((n) => n.id)),
    markRead: (id) => setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id])),
    createOpen,
    setCreateOpen,
    balanceUsdc,
    refreshState,
    depositOpen,
    setDepositOpen,
    loading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within Providers");
  return ctx;
}
