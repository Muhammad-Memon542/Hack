"use client";

import { useState } from "react";
import { useApp } from "../providers";
import { truncateWallet } from "@/lib/mock";

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="between" style={{ padding: "0.7rem 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{label}</div>
        {hint && <div className="faint" style={{ fontSize: "0.8rem" }}>{hint}</div>}
      </div>
      <button
        className={`btn btn-sm ${value ? "btn-primary" : "btn-ghost"}`}
        onClick={() => onChange(!value)}
      >
        {value ? "On" : "Off"}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { connected, connect, me, disconnect } = useApp();
  const [privacy, setPrivacy] = useState(me.privacy);
  const [notif, setNotif] = useState({ newMarket: true, friendBet: true, resolved: true, yield: true, replies: true });

  if (!connected) {
    return (
      <div className="empty" style={{ marginTop: "2rem" }}>
        <strong>Connect to manage settings.</strong>
        <div style={{ marginTop: "0.9rem" }}>
          <button className="btn btn-primary" onClick={connect}>👛 Connect wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "1.5rem", maxWidth: 620 }}>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <div className="panel">
        <h3>Wallet</h3>
        <div className="between">
          <span className="mono faint">{truncateWallet(me.wallet)}</span>
          <button className="btn btn-sm btn-ghost" onClick={disconnect}>Disconnect</button>
        </div>
      </div>

      <div className="panel">
        <h3>Privacy</h3>
        <Toggle label="Hide positions" hint="Others can't see what you've bet." value={privacy.hidePositions} onChange={(v) => setPrivacy({ ...privacy, hidePositions: v })} />
        <Toggle label="Hide PnL" hint="Keep your profit/loss off leaderboards." value={privacy.hidePnl} onChange={(v) => setPrivacy({ ...privacy, hidePnl: v })} />
        <Toggle label="Reveal position on comment" hint="Show your side next to your comments." value={privacy.revealPositionOnComment} onChange={(v) => setPrivacy({ ...privacy, revealPositionOnComment: v })} />
        <Toggle label="Ghost mode" hint="Browse without appearing in friends' activity." value={privacy.ghostMode} onChange={(v) => setPrivacy({ ...privacy, ghostMode: v })} />
      </div>

      <div className="panel">
        <h3>Notifications</h3>
        <Toggle label="New market from a follow" value={notif.newMarket} onChange={(v) => setNotif({ ...notif, newMarket: v })} />
        <Toggle label="Friend bets" value={notif.friendBet} onChange={(v) => setNotif({ ...notif, friendBet: v })} />
        <Toggle label="Market resolved" value={notif.resolved} onChange={(v) => setNotif({ ...notif, resolved: v })} />
        <Toggle label="Yield received" value={notif.yield} onChange={(v) => setNotif({ ...notif, yield: v })} />
        <Toggle label="Comment replies" value={notif.replies} onChange={(v) => setNotif({ ...notif, replies: v })} />
      </div>
    </div>
  );
}
