"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/app/providers";
import { relativeTime, userById } from "@/lib/mock";
import { Avatar } from "./primitives";
import { PinIcon, GlobeIcon, BellIcon } from "./icons";

const SECTIONS = [
  { href: "/", label: "Trending" },
  { href: "/for-you", label: "For You" },
  { href: "/markets", label: "All markets" },
  { href: "/friends", label: "Friends" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, me, authUser, logout, unreadCount, setCreateOpen, balanceUsdc, setDepositOpen } =
    useApp();
  const [openMenu, setOpenMenu] = useState<null | "bell" | "avatar">(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="logo">
          <PinIcon size={22} />
          <span>Better</span>
        </Link>

        <div className="nav-right" ref={wrapRef}>
          <button className="nav-link" onClick={() => setCreateOpen(true)} style={{ background: "none", border: "none", cursor: "pointer" }}>
            Create a market
          </button>

          {connected ? (
            <>
              <Link href="/wallet" className="balance-pill" title="View wallet">
                <span className="balance-amt">${balanceUsdc.toFixed(2)}</span>
                <span className="balance-plus">+ Add</span>
              </Link>

              <div style={{ position: "relative" }}>
                <button className="icon-round" aria-label="notifications" onClick={() => setOpenMenu(openMenu === "bell" ? null : "bell")}>
                  <BellIcon />
                  {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
                </button>
                {openMenu === "bell" && <NotificationsPanel onClose={() => setOpenMenu(null)} />}
              </div>

              <Link href="/markets" className="icon-round" aria-label="explore">
                <GlobeIcon />
              </Link>

              <div style={{ position: "relative" }}>
                <button className="avatar-pill" onClick={() => setOpenMenu(openMenu === "avatar" ? null : "avatar")} aria-label="account">
                  <span className="burger"><span /><span /><span /></span>
                  <Avatar emoji={me.avatar} color={me.color} size={30} src={me.picture} />
                </button>
                {openMenu === "avatar" && (
                  <div className="menu">
                    <div className="menu-head">
                      <div style={{ fontWeight: 800 }}>{authUser ? authUser.name : `@${me.username}`}</div>
                      <div className="faint" style={{ fontSize: "0.8rem" }}>
                        {authUser?.email ?? `Better Score ${me.echoScore}`}
                      </div>
                    </div>
                    <div className="menu-sep" />
                    {SECTIONS.map((s) => (
                      <button
                        key={s.href}
                        className={`menu-item ${pathname === s.href ? "active" : ""}`}
                        onClick={() => { router.push(s.href); setOpenMenu(null); }}
                      >
                        {s.label}
                      </button>
                    ))}
                    <div className="menu-sep" />
                    <button className="menu-item" onClick={() => { router.push(`/u/${me.username}`); setOpenMenu(null); }}>Profile</button>
                    <button className="menu-item" onClick={() => { router.push("/wallet"); setOpenMenu(null); }}>Wallet</button>
                    <button className="menu-item" onClick={() => { router.push("/trade"); setOpenMenu(null); }}>Trade</button>
                    <button className="menu-item" onClick={() => { router.push("/settings"); setOpenMenu(null); }}>Settings</button>
                    <div className="menu-sep" />
                    <button className="menu-item" onClick={() => { logout(); setOpenMenu(null); }}>Log out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login" prefetch={false} className="btn btn-primary btn-sm">Log in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markAllRead, markRead } = useApp();
  const router = useRouter();
  const go = (href: string, id: string) => { markRead(id); onClose(); router.push(href); };

  return (
    <div className="menu" style={{ minWidth: 340, maxWidth: 380, maxHeight: 440, overflowY: "auto" }}>
      <div className="between menu-head">
        <div style={{ fontWeight: 800 }}>Notifications</div>
        <button className="btn btn-sm btn-ghost" onClick={markAllRead}>Mark all read</button>
      </div>
      <div className="menu-sep" />
      {notifications.length === 0 && <div className="faint menu-head">You&apos;re all caught up.</div>}
      {notifications.map((n) => {
        const actor = n.actorIds[0] ? userById(n.actorIds[0]) : undefined;
        const extra = n.actorIds.length > 1 ? ` and ${n.actorIds.length - 1} others` : "";
        return (
          <button
            key={n.id}
            className="menu-item"
            style={{ alignItems: "flex-start", background: n.read ? "transparent" : "var(--accent-soft)", flexDirection: "column", gap: "0.2rem" }}
            onClick={() => go(n.href, n.id)}
          >
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {actor ? (
                <Avatar emoji={actor.avatar} color={actor.color} size={22} src={actor.picture} />
              ) : (
                <span style={{ width: 22, textAlign: "center" }}>
                  {n.type === "resolved" ? "R" : n.type === "yield" ? "Y" : "N"}
                </span>
              )}
              <span style={{ color: "var(--text)", fontSize: "0.86rem", lineHeight: 1.35, whiteSpace: "normal" }}>
                {n.text}{extra}
              </span>
            </div>
            <span className="faint" style={{ fontSize: "0.74rem", paddingLeft: "1.9rem" }}>{relativeTime(n.createdAt)}</span>
          </button>
        );
      })}
    </div>
  );
}
