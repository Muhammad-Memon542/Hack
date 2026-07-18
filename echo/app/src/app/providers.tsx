"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  markets as seedMarkets,
  positions as seedPositions,
  comments as seedComments,
  notifications as seedNotifications,
  CURRENT_USER_ID,
  userById,
  type Market,
  type Position,
  type Comment,
  type AppNotification,
  type Side,
  type User,
} from "@/lib/mock";

interface CreateMarketInput {
  question: string;
  description: string;
  closesAt: string;
  subjectWallet: string | null;
}

interface AppState {
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  me: User;

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
  createMarket: (input: CreateMarketInput) => string;
  placeBet: (marketId: string, side: Side, amount: number) => void;
  addComment: (marketId: string, content: string, parentId: string | null) => void;

  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;

  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

const LS_KEY = "echo_app_state_v1";

interface Persisted {
  connected: boolean;
  following: string[];
  followingMarkets: string[];
  followingSubjects: string[];
  read: string[];
}

export function Providers({ children }: { children: React.ReactNode }) {
  const seedUser = userById(CURRENT_USER_ID)!;

  const [connected, setConnected] = useState(false);
  const [following, setFollowing] = useState<string[]>(seedUser.following);
  const [followingMarkets, setFollowingMarkets] = useState<string[]>(seedUser.followingMarkets);
  const [followingSubjects, setFollowingSubjects] = useState<string[]>(seedUser.followingSubjects);
  const [readIds, setReadIds] = useState<string[]>(
    seedNotifications.filter((n) => n.read).map((n) => n.id)
  );

  const [dynMarkets, setDynMarkets] = useState<Market[]>([]);
  const [dynPositions, setDynPositions] = useState<Position[]>([]);
  const [dynComments, setDynComments] = useState<Comment[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // hydrate persisted slice
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p: Persisted = JSON.parse(raw);
        setConnected(p.connected);
        setFollowing(p.following);
        setFollowingMarkets(p.followingMarkets);
        setFollowingSubjects(p.followingSubjects);
        setReadIds(p.read);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const p: Persisted = { connected, following, followingMarkets, followingSubjects, read: readIds };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, [hydrated, connected, following, followingMarkets, followingSubjects, readIds]);

  const me = useMemo<User>(
    () => ({ ...seedUser, following, followingMarkets, followingSubjects }),
    [seedUser, following, followingMarkets, followingSubjects]
  );

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const markets = useMemo(() => [...dynMarkets, ...seedMarkets], [dynMarkets]);
  const positions = useMemo(() => [...dynPositions, ...seedPositions], [dynPositions]);
  const comments = useMemo(() => [...dynComments, ...seedComments], [dynComments]);

  const createMarket = useCallback(
    (input: CreateMarketInput): string => {
      const id = `m_new_${Date.now()}`;
      const market: Market = {
        id,
        question: input.question,
        description: input.description,
        creatorId: CURRENT_USER_ID,
        subjectWallet: input.subjectWallet,
        status: "OPEN",
        closesAt: input.closesAt,
        resolvedAt: null,
        outcome: null,
        yesPool: 0,
        noPool: 0,
        commentCount: 0,
        participants: 0,
        createdAt: new Date().toISOString(),
        location: seedUser.location,
        tags: [],
      };
      setDynMarkets((prev) => [market, ...prev]);
      setFollowingMarkets((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return id;
    },
    [seedUser.location]
  );

  const placeBet = useCallback((marketId: string, side: Side, amount: number) => {
    setDynPositions((prev) => [
      {
        id: `p_new_${Date.now()}`,
        marketId,
        userId: CURRENT_USER_ID,
        side,
        amount,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setDynMarkets((prev) =>
      prev.map((m) =>
        m.id === marketId
          ? {
              ...m,
              yesPool: side === "YES" ? m.yesPool + amount : m.yesPool,
              noPool: side === "NO" ? m.noPool + amount : m.noPool,
              participants: m.participants + 1,
            }
          : m
      )
    );
    setFollowingMarkets((prev) => (prev.includes(marketId) ? prev : [...prev, marketId]));
  }, []);

  const addComment = useCallback((marketId: string, content: string, parentId: string | null) => {
    setDynComments((prev) => [
      ...prev,
      {
        id: `c_new_${Date.now()}`,
        marketId,
        userId: CURRENT_USER_ID,
        parentId,
        content,
        createdAt: new Date().toISOString(),
        tipsReceived: 0,
      },
    ]);
    setFollowingMarkets((prev) => (prev.includes(marketId) ? prev : [...prev, marketId]));
  }, []);

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
    me,
    following,
    followingMarkets,
    followingSubjects,
    isFollowing: (id) => following.includes(id),
    toggleFollow: (id) => toggle(setFollowing, id),
    isFollowingMarket: (id) => followingMarkets.includes(id),
    toggleFollowMarket: (id) => toggle(setFollowingMarkets, id),
    isFollowingSubject: (w) => followingSubjects.includes(w),
    toggleFollowSubject: (w) => toggle(setFollowingSubjects, w),
    markets,
    positions,
    comments,
    createMarket,
    placeBet,
    addComment,
    notifications,
    unreadCount,
    markAllRead: () => setReadIds(seedNotifications.map((n) => n.id)),
    markRead: (id) => setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id])),
    createOpen,
    setCreateOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within Providers");
  return ctx;
}
