// Echo — self-contained mock data layer.
// Powers the entire app with no database or wallet required. Everything a
// real Echo would keep off-chain (profiles, comments, follow graph, feeds)
// lives here so the product renders and behaves end-to-end for review.

export type MarketStatus = "OPEN" | "RESOLVING" | "SETTLED" | "DISPUTED";
export type Side = "YES" | "NO";
export type Category = "Sports" | "Tech" | "Crypto" | "Politics" | "Local";

export interface PrivacySettings {
  hidePositions: boolean;
  hidePnl: boolean;
  ghostMode: boolean;
  revealPositionOnComment: boolean;
}

export interface User {
  id: string;
  wallet: string;
  username: string;
  avatar: string; // emoji (or a single initial when a real identity is applied)
  color: string; // avatar gradient seed
  picture?: string; // real avatar image URL (e.g. from Auth0), when signed in
  bio: string;
  location: string;
  following: string[]; // user ids
  followers: string[]; // user ids
  followingMarkets: string[]; // market ids
  followingSubjects: string[]; // subject wallets
  echoScore: number;
  accuracy: number; // 0..1
  totalVolumeBet: number;
  totalVolumeCreated: number;
  totalYieldEarned: number;
  streakMultiplier: number;
  privacy: PrivacySettings;
  createdAt: string; // ISO
}

export interface Subject {
  wallet: string;
  slug: string;
  name: string;
  avatar: string;
  color: string;
  bio: string;
  verified: boolean;
  optOut: boolean;
  totalYieldEarned: number;
  marketCount: number;
  socials?: { label: string; href: string }[];
  aboutAccuracy: number; // resolution accuracy of predictions about them
}

export interface Market {
  id: string;
  question: string;
  description: string; // resolution criteria
  creatorId: string;
  subjectWallet: string | null;
  status: MarketStatus;
  closesAt: string; // ISO
  resolvedAt: string | null;
  outcome: Side | null;
  yesPool: number;
  noPool: number;
  commentCount: number;
  participants: number;
  createdAt: string;
  location: string;
  tags: string[];
  category?: Category;
  image?: string;
}

export interface Position {
  id: string;
  marketId: string;
  userId: string;
  side: Side;
  amount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  marketId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  tipsReceived: number;
}

export type NotificationType =
  | "new_market"
  | "friend_bet"
  | "resolved"
  | "yield"
  | "reply"
  | "milestone";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorIds: string[]; // for batching
  marketId?: string;
  subjectWallet?: string;
  commentId?: string;
  text: string;
  href: string;
  read: boolean;
  createdAt: string;
}

// ---------- activity (social feed) ----------
export type ActivityType = "bet" | "new_market" | "comment" | "follow" | "resolution";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  userId: string; // actor
  marketId?: string;
  targetUserId?: string;
  commentId?: string;
  side?: Side;
  amount?: number;
  content?: string;
  createdAt: string;
}

// ---------- time helpers ----------
const now = new Date("2026-07-18T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const hoursAhead = (h: number) => new Date(now + h * 3600_000).toISOString();
const daysAhead = (d: number) => new Date(now + d * 86_400_000).toISOString();

// ---------- subjects ----------
export const subjects: Subject[] = [
  {
    wallet: "Am1rXk4p9QhLandBackF1ipMeetupSo1anaW4LLet77",
    slug: "amir",
    name: "Amir",
    avatar: "🛹",
    color: "#a78bfa",
    bio: "Skater, meetup regular, occasional backflip attempter. Verified subject on Echo.",
    verified: true,
    optOut: false,
    totalYieldEarned: 45.2,
    marketCount: 3,
    socials: [
      { label: "twitter", href: "https://x.com/amir" },
      { label: "instagram", href: "https://instagram.com/amir" },
    ],
    aboutAccuracy: 0.71,
  },
  {
    wallet: "M4y0rGr33nP4rkD1str1ctLoc4lEventSo1anaW4L88",
    slug: "mayor-green",
    name: "Mayor Green",
    avatar: "🏛️",
    color: "#4ade80",
    bio: "District mayor. Markets about civic events and local promises.",
    verified: true,
    optOut: false,
    totalYieldEarned: 128.5,
    marketCount: 2,
    socials: [{ label: "website", href: "https://district.gov" }],
    aboutAccuracy: 0.58,
  },
  {
    wallet: "Un0wnDJr3ttaW4LLetUnverifiedSubjectEchoXy99",
    slug: "dj-retta",
    name: null as unknown as string,
    avatar: "🎧",
    color: "#60a5fa",
    bio: "",
    verified: false,
    optOut: false,
    totalYieldEarned: 0,
    marketCount: 1,
    aboutAccuracy: 0,
  },
];

// ---------- users ----------
export const users: User[] = [
  {
    id: "u_you",
    wallet: "Y0uLocalForecasterEchoWa11etDemoSat0shi4242",
    username: "satoshi_local",
    avatar: "🦊",
    color: "#a78bfa",
    bio: "Local forecaster. I bet on my neighborhood.",
    location: "Riverside",
    following: ["u_demo_maker", "u_park_ranger", "u_oracle_queen"],
    followers: ["u_park_ranger", "u_night_owl"],
    followingMarkets: ["m_backflip"],
    followingSubjects: ["Am1rXk4p9QhLandBackF1ipMeetupSo1anaW4LLet77"],
    echoScore: 612,
    accuracy: 0.64,
    totalVolumeBet: 340,
    totalVolumeCreated: 120,
    totalYieldEarned: 0,
    streakMultiplier: 1.1,
    privacy: {
      hidePositions: false,
      hidePnl: false,
      ghostMode: false,
      revealPositionOnComment: true,
    },
    createdAt: daysAgo(88),
  },
  {
    id: "u_demo_maker",
    wallet: "D3m0Mak3rCreat0rEchoWa11etMarketBu1lderZz11",
    username: "demo_maker",
    avatar: "🧪",
    color: "#f472b6",
    bio: "I make markets about the people who make my week interesting.",
    location: "Riverside",
    following: ["u_you", "u_oracle_queen", "u_park_ranger"],
    followers: ["u_you", "u_park_ranger", "u_night_owl", "u_coach_dee"],
    followingMarkets: [],
    followingSubjects: [],
    echoScore: 847,
    accuracy: 0.72,
    totalVolumeBet: 1240,
    totalVolumeCreated: 980,
    totalYieldEarned: 0,
    streakMultiplier: 1.4,
    privacy: {
      hidePositions: false,
      hidePnl: false,
      ghostMode: false,
      revealPositionOnComment: true,
    },
    createdAt: daysAgo(140),
  },
  {
    id: "u_park_ranger",
    wallet: "P4rkR4ng3rF0recasterEchoWa11etTr4ils0lana33",
    username: "park_ranger",
    avatar: "🌲",
    color: "#4ade80",
    bio: "If it happens outdoors, I have an opinion on it.",
    location: "Riverside",
    following: ["u_you", "u_demo_maker"],
    followers: ["u_you", "u_demo_maker", "u_oracle_queen"],
    followingMarkets: ["m_backflip", "m_bikelane"],
    followingSubjects: ["Am1rXk4p9QhLandBackF1ipMeetupSo1anaW4LLet77"],
    echoScore: 723,
    accuracy: 0.69,
    totalVolumeBet: 820,
    totalVolumeCreated: 210,
    totalYieldEarned: 0,
    streakMultiplier: 1.25,
    privacy: {
      hidePositions: false,
      hidePnl: false,
      ghostMode: false,
      revealPositionOnComment: true,
    },
    createdAt: daysAgo(110),
  },
  {
    id: "u_oracle_queen",
    wallet: "0racl3Qu33nT0pForecasterEchoWa11etAcc99Xy00",
    username: "oracle_queen",
    avatar: "👑",
    color: "#fbbf24",
    bio: "Top forecaster three seasons running. I don't bet, I know.",
    location: "Downtown",
    following: ["u_demo_maker", "u_park_ranger"],
    followers: ["u_you", "u_demo_maker", "u_park_ranger", "u_night_owl", "u_coach_dee"],
    followingMarkets: [],
    followingSubjects: [],
    echoScore: 981,
    accuracy: 0.81,
    totalVolumeBet: 2400,
    totalVolumeCreated: 60,
    totalYieldEarned: 0,
    streakMultiplier: 1.6,
    privacy: {
      hidePositions: true,
      hidePnl: true,
      ghostMode: false,
      revealPositionOnComment: false,
    },
    createdAt: daysAgo(200),
  },
  {
    id: "u_night_owl",
    wallet: "N1ght0w1L4teN1ghtBett0rEchoWa11etM00nXy4242",
    username: "night_owl",
    avatar: "🦉",
    color: "#60a5fa",
    bio: "High roller. Big positions, no sleep.",
    location: "Downtown",
    following: ["u_oracle_queen"],
    followers: ["u_you"],
    followingMarkets: [],
    followingSubjects: [],
    echoScore: 705,
    accuracy: 0.6,
    totalVolumeBet: 3100,
    totalVolumeCreated: 0,
    totalYieldEarned: 0,
    streakMultiplier: 1.2,
    privacy: {
      hidePositions: false,
      hidePnl: false,
      ghostMode: false,
      revealPositionOnComment: true,
    },
    createdAt: daysAgo(75),
  },
  {
    id: "u_coach_dee",
    wallet: "C04chD33Comm4nderEchoWa11etF1e1dHouse0lana7",
    username: "coach_dee",
    avatar: "📣",
    color: "#f87171",
    bio: "Coach. I call games before they happen.",
    location: "Eastside",
    following: ["u_oracle_queen", "u_demo_maker"],
    followers: ["u_demo_maker"],
    followingMarkets: [],
    followingSubjects: [],
    echoScore: 540,
    accuracy: 0.55,
    totalVolumeBet: 460,
    totalVolumeCreated: 300,
    totalYieldEarned: 0,
    streakMultiplier: 1.05,
    privacy: {
      hidePositions: false,
      hidePnl: false,
      ghostMode: false,
      revealPositionOnComment: true,
    },
    createdAt: daysAgo(50),
  },
  makerUser("u_bikes_maker", "bikes_maker", "🚴", "#16a34a", "Cycling club organizer. Miles don't lie."),
  makerUser("u_tacos_maker", "tacos_maker", "🌮", "#f59e0b", "Following the food trucks so you don't have to."),
  makerUser("u_crypto_maker", "crypto_maker", "🪙", "#6366f1", "On-chain degen. Markets about the market."),
  makerUser("u_run_maker", "run_maker", "🏃", "#0ea5e9", "Race-day recaps and split-time bets."),
];

function makerUser(id: string, username: string, avatar: string, color: string, bio: string): User {
  return {
    id,
    wallet: `${username.replace(/_/g, "").slice(0, 8)}EchoWa11etMakerXyDemo00000000000000`.slice(0, 44),
    username,
    avatar,
    color,
    bio,
    location: "Riverside",
    following: ["u_you"],
    followers: ["u_you"],
    followingMarkets: [],
    followingSubjects: [],
    echoScore: 480 + (id.length * 37) % 200,
    accuracy: 0.55 + ((id.charCodeAt(2) % 20) / 100),
    totalVolumeBet: 200 + (id.length * 53) % 600,
    totalVolumeCreated: 300,
    totalYieldEarned: 0,
    streakMultiplier: 1.1,
    privacy: { hidePositions: false, hidePnl: false, ghostMode: false, revealPositionOnComment: true },
    createdAt: daysAgo(35),
  };
}

// ---------- markets ----------
export const markets: Market[] = [
  {
    id: "m_backflip",
    question: "Will Amir land the backflip at Saturday's meetup?",
    description:
      "Resolves YES if Amir completes a standing backflip and lands on his feet without touching hands to the ground, verified by two attendees on video. Otherwise NO.",
    creatorId: "u_demo_maker",
    subjectWallet: "Am1rXk4p9QhLandBackF1ipMeetupSo1anaW4LLet77",
    status: "OPEN",
    closesAt: daysAhead(3),
    resolvedAt: null,
    outcome: null,
    yesPool: 81.7,
    noPool: 42.05,
    commentCount: 8,
    participants: 12,
    createdAt: hoursAgo(2),
    location: "Riverside",
    tags: ["sports", "meetup"],
  },
  {
    id: "m_bikelane",
    question: "Will Mayor Green open the new bike lane before August?",
    description:
      "Resolves YES if the Elm St protected bike lane is officially opened to the public on or before July 31, 2026, per the district's public calendar. Otherwise NO.",
    creatorId: "u_park_ranger",
    subjectWallet: "M4y0rGr33nP4rkD1str1ctLoc4lEventSo1anaW4L88",
    status: "OPEN",
    closesAt: daysAhead(10),
    resolvedAt: null,
    outcome: null,
    yesPool: 210,
    noPool: 340,
    commentCount: 14,
    participants: 23,
    createdAt: hoursAgo(9),
    location: "Riverside",
    tags: ["civic", "local"],
  },
  {
    id: "m_dj_set",
    question: "Will the mystery DJ actually show up to Friday's block party?",
    description:
      "Resolves YES if the booked DJ performs a set of at least 30 minutes at the Elm St block party on Friday. Otherwise NO.",
    creatorId: "u_coach_dee",
    subjectWallet: "Un0wnDJr3ttaW4LLetUnverifiedSubjectEchoXy99",
    status: "OPEN",
    closesAt: daysAhead(2),
    resolvedAt: null,
    outcome: null,
    yesPool: 55,
    noPool: 60,
    commentCount: 3,
    participants: 9,
    createdAt: hoursAgo(20),
    location: "Riverside",
    tags: ["music", "nightlife"],
  },
  {
    id: "m_coach_win",
    question: "Will Coach Dee's team win the Eastside final?",
    description:
      "Resolves YES if the Eastside team wins the league final outright (no ties). Overtime counts. Otherwise NO.",
    creatorId: "u_demo_maker",
    subjectWallet: "C04chD33Comm4nderEchoWa11etF1e1dHouse0lana7",
    status: "RESOLVING",
    closesAt: hoursAgo(4),
    resolvedAt: null,
    outcome: null,
    yesPool: 430,
    noPool: 180,
    commentCount: 21,
    participants: 34,
    createdAt: daysAgo(4),
    location: "Eastside",
    tags: ["sports"],
  },
  {
    id: "m_farmers",
    question: "Will the farmers market hit 50 stalls this weekend?",
    description:
      "Resolves YES if the Saturday farmers market has 50 or more registered stalls, per the organizer's count. Otherwise NO.",
    creatorId: "u_park_ranger",
    subjectWallet: null,
    status: "DISPUTED",
    closesAt: daysAgo(1),
    resolvedAt: null,
    outcome: null,
    yesPool: 140,
    noPool: 155,
    commentCount: 30,
    participants: 41,
    createdAt: daysAgo(6),
    location: "Downtown",
    tags: ["local", "market"],
  },
  {
    id: "m_marathon",
    question: "Did Oracle Queen finish the river 10k under 50 minutes?",
    description:
      "Resolved YES: official chip time was 48:31, verified on the race results page.",
    creatorId: "u_coach_dee",
    subjectWallet: "0racl3Qu33nT0pForecasterEchoWa11etAcc99Xy00",
    status: "SETTLED",
    closesAt: daysAgo(8),
    resolvedAt: daysAgo(7),
    outcome: "YES",
    yesPool: 260,
    noPool: 90,
    commentCount: 11,
    participants: 19,
    createdAt: daysAgo(14),
    location: "Riverside",
    tags: ["sports"],
  },
  {
    id: "m_amir_kickflip",
    question: "Will Amir clean the 5-stair kickflip by end of month?",
    description:
      "Resolves YES if Amir lands a clean kickflip down the library 5-stair, filmed, before July 31. Otherwise NO.",
    creatorId: "u_demo_maker",
    subjectWallet: "Am1rXk4p9QhLandBackF1ipMeetupSo1anaW4LLet77",
    status: "OPEN",
    closesAt: daysAhead(13),
    resolvedAt: null,
    outcome: null,
    yesPool: 33,
    noPool: 71,
    commentCount: 5,
    participants: 8,
    createdAt: hoursAgo(30),
    location: "Riverside",
    tags: ["sports", "skate"],
  },
  {
    id: "m_mayor_promise",
    question: "Will Mayor Green keep the Tuesday street-sweeping promise?",
    description:
      "Resolves YES if street sweeping runs on Elm St every Tuesday in July with no missed weeks, per resident reports. Otherwise NO.",
    creatorId: "u_park_ranger",
    subjectWallet: "M4y0rGr33nP4rkD1str1ctLoc4lEventSo1anaW4L88",
    status: "SETTLED",
    closesAt: daysAgo(3),
    resolvedAt: daysAgo(2),
    outcome: "NO",
    yesPool: 90,
    noPool: 175,
    commentCount: 9,
    participants: 15,
    createdAt: daysAgo(20),
    location: "Riverside",
    tags: ["civic"],
  },
  {
    id: "m_cycling",
    question: "Will the group hit 500 miles in the cycling challenge?",
    description: "Resolves YES if the club's combined logged mileage reaches 500 miles by Sunday night, per Strava.",
    creatorId: "u_bikes_maker",
    subjectWallet: null,
    status: "OPEN",
    closesAt: "2026-07-24T20:00:00Z",
    resolvedAt: null,
    outcome: null,
    yesPool: 50.75,
    noPool: 76.13,
    commentCount: 4,
    participants: 11,
    createdAt: hoursAgo(14),
    location: "Riverside",
    tags: ["cycling"],
    category: "Sports",
    image: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=800&q=60",
  },
  {
    id: "m_foodtruck",
    question: "Does the food truck return to Dolores Park this week?",
    description: "Resolves YES if the taco truck is parked at Dolores Park on any day this week, verified by a photo.",
    creatorId: "u_tacos_maker",
    subjectWallet: null,
    status: "RESOLVING",
    closesAt: "2026-07-17T18:00:00Z",
    resolvedAt: null,
    outcome: null,
    yesPool: 10.38,
    noPool: 31.12,
    commentCount: 6,
    participants: 13,
    createdAt: daysAgo(3),
    location: "Downtown",
    tags: ["food"],
    category: "Local",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=60",
  },
  {
    id: "m_startup",
    question: "Did the startup actually crash on stage?",
    description: "Resolves YES if the demo visibly failed during the live pitch, per two attendee accounts.",
    creatorId: "u_demo_maker",
    subjectWallet: null,
    status: "RESOLVING",
    closesAt: "2026-07-19T22:00:00Z",
    resolvedAt: null,
    outcome: null,
    yesPool: 35.1,
    noPool: 23.4,
    commentCount: 9,
    participants: 16,
    createdAt: daysAgo(2),
    location: "Downtown",
    tags: ["startup"],
    category: "Tech",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=60",
  },
  {
    id: "m_sol",
    question: "Will SOL break $200 before August?",
    description: "Resolves YES if SOL/USD trades at or above $200 on a major exchange before Aug 1, 2026.",
    creatorId: "u_crypto_maker",
    subjectWallet: null,
    status: "OPEN",
    closesAt: "2026-07-31T23:59:00Z",
    resolvedAt: null,
    outcome: null,
    yesPool: 1016.8,
    noPool: 223.2,
    commentCount: 27,
    participants: 58,
    createdAt: daysAgo(1),
    location: "Downtown",
    tags: ["crypto", "sol"],
    category: "Crypto",
    image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=60",
  },
  {
    id: "m_priya",
    question: "Did Priya finish the marathon under 4 hours?",
    description: "Resolved YES: official chip time was 3:52:10 on the race results page.",
    creatorId: "u_run_maker",
    subjectWallet: null,
    status: "SETTLED",
    closesAt: "2026-07-13T14:00:00Z",
    resolvedAt: "2026-07-13T16:00:00Z",
    outcome: "YES",
    yesPool: 210,
    noPool: 70,
    commentCount: 8,
    participants: 22,
    createdAt: daysAgo(12),
    location: "Riverside",
    tags: ["running"],
    category: "Sports",
    image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=60",
  },
];

// Category + image metadata for the original local markets.
const MARKET_META: Record<string, { category: Category; image: string }> = {
  m_backflip: { category: "Sports", image: "https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?auto=format&fit=crop&w=800&q=60" },
  m_bikelane: { category: "Politics", image: "https://images.unsplash.com/photo-1502744688674-c619d1586c9e?auto=format&fit=crop&w=800&q=60" },
  m_dj_set: { category: "Local", image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=800&q=60" },
  m_coach_win: { category: "Sports", image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=60" },
  m_farmers: { category: "Local", image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=60" },
  m_marathon: { category: "Sports", image: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=60" },
  m_amir_kickflip: { category: "Sports", image: "https://images.unsplash.com/photo-1531565637446-32307b194362?auto=format&fit=crop&w=800&q=60" },
  m_mayor_promise: { category: "Politics", image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=800&q=60" },
};
for (const m of markets) {
  if (!m.category && MARKET_META[m.id]) {
    m.category = MARKET_META[m.id].category;
    m.image = MARKET_META[m.id].image;
  }
  if (!m.category) m.category = "Local";
}

// ---------- positions ----------
export const positions: Position[] = [
  { id: "p1", marketId: "m_backflip", userId: "u_park_ranger", side: "YES", amount: 37, createdAt: hoursAgo(1) },
  { id: "p2", marketId: "m_backflip", userId: "u_you", side: "YES", amount: 20, createdAt: hoursAgo(1.5) },
  { id: "p3", marketId: "m_backflip", userId: "u_night_owl", side: "NO", amount: 42, createdAt: hoursAgo(1.2) },
  { id: "p4", marketId: "m_bikelane", userId: "u_oracle_queen", side: "NO", amount: 120, createdAt: hoursAgo(6) },
  { id: "p5", marketId: "m_bikelane", userId: "u_you", side: "YES", amount: 40, createdAt: hoursAgo(5) },
  { id: "p6", marketId: "m_coach_win", userId: "u_night_owl", side: "YES", amount: 200, createdAt: daysAgo(1) },
  { id: "p7", marketId: "m_marathon", userId: "u_you", side: "YES", amount: 30, createdAt: daysAgo(10) },
  { id: "p8", marketId: "m_marathon", userId: "u_park_ranger", side: "YES", amount: 55, createdAt: daysAgo(10) },
  { id: "p9", marketId: "m_farmers", userId: "u_demo_maker", side: "NO", amount: 60, createdAt: daysAgo(2) },
  { id: "p10", marketId: "m_amir_kickflip", userId: "u_park_ranger", side: "NO", amount: 25, createdAt: hoursAgo(12) },
];

// ---------- comments ----------
export const comments: Comment[] = [
  { id: "c1", marketId: "m_backflip", userId: "u_park_ranger", parentId: null, content: "He landed it twice at practice on Tuesday. YES all day.", createdAt: hoursAgo(1), tipsReceived: 2.5 },
  { id: "c2", marketId: "m_backflip", userId: "u_night_owl", parentId: "c1", content: "Practice ≠ crowd pressure. He always bails when people film.", createdAt: hoursAgo(0.8), tipsReceived: 0 },
  { id: "c3", marketId: "m_backflip", userId: "u_demo_maker", parentId: "c2", content: "Counterpoint: the crowd is what hypes him up. He feeds off it.", createdAt: hoursAgo(0.5), tipsReceived: 1 },
  { id: "c4", marketId: "m_backflip", userId: "u_you", parentId: null, content: "Weather looks dry Saturday, so at least conditions won't be the excuse.", createdAt: hoursAgo(0.3), tipsReceived: 0 },
  { id: "c5", marketId: "m_bikelane", userId: "u_oracle_queen", parentId: null, content: "The permits haven't cleared. No way it opens before August.", createdAt: hoursAgo(5), tipsReceived: 4 },
];

// ---------- notifications ----------
export const notifications: AppNotification[] = [
  {
    id: "n1",
    type: "new_market",
    actorIds: ["u_demo_maker"],
    marketId: "m_amir_kickflip",
    text: "@demo_maker created: Will Amir clean the 5-stair kickflip by end of month?",
    href: "/market/m_amir_kickflip",
    read: false,
    createdAt: hoursAgo(30),
  },
  {
    id: "n2",
    type: "friend_bet",
    actorIds: ["u_park_ranger"],
    marketId: "m_backflip",
    text: "@park_ranger bet YES on Will Amir land the backflip at Saturday's meetup?",
    href: "/market/m_backflip?highlight=friend",
    read: false,
    createdAt: hoursAgo(1),
  },
  {
    id: "n3",
    type: "resolved",
    actorIds: [],
    marketId: "m_marathon",
    text: "Resolved YES: Did Oracle Queen finish the river 10k under 50 minutes? Claim your winnings.",
    href: "/market/m_marathon?claim=true",
    read: false,
    createdAt: daysAgo(7),
  },
  {
    id: "n4",
    type: "reply",
    actorIds: ["u_demo_maker"],
    marketId: "m_backflip",
    commentId: "c3",
    text: "@demo_maker replied to your thread on the backflip market",
    href: "/market/m_backflip?comment=c3",
    read: true,
    createdAt: hoursAgo(0.5),
  },
  {
    id: "n5",
    type: "milestone",
    actorIds: [],
    text: "You crossed an Echo Score milestone: 612 — Top 20%",
    href: "/u/satoshi_local",
    read: true,
    createdAt: daysAgo(2),
  },
];

// ================= server hydration =================
// The app's pure helpers below read these module-level arrays. On the client we
// replace their contents in place with the live server snapshot so every helper
// (positionsFor, buildFeed, marketsByCreator, …) reflects real state without
// rewriting each call site. Providers triggers re-renders via React state.
export function hydrateFromServer(snap: {
  users?: User[];
  markets?: Market[];
  positions?: Position[];
  comments?: Comment[];
}) {
  if (snap.users) {
    users.length = 0;
    users.push(...snap.users);
  }
  if (snap.markets) {
    markets.length = 0;
    markets.push(...snap.markets);
  }
  if (snap.positions) {
    positions.length = 0;
    positions.push(...snap.positions);
  }
  if (snap.comments) {
    comments.length = 0;
    comments.push(...snap.comments);
  }
  // Re-apply the signed-in identity overlay after the server snapshot rebuilds
  // the users array, so a refresh doesn't revert "you" back to the demo user.
  applyCurrentUserOverride();
}

// ================= helpers =================

export const NOW = now;

export function relativeTime(iso: string): string {
  const diff = now - new Date(iso).getTime();
  const future = diff < 0;
  const a = Math.abs(diff);
  const m = Math.round(a / 60000);
  const h = Math.round(a / 3600000);
  const d = Math.round(a / 86400000);
  let core: string;
  if (a < 60000) core = "just now";
  else if (m < 60) core = `${m}m`;
  else if (h < 24) core = `${h}h`;
  else if (d < 30) core = `${d}d`;
  else core = `${Math.round(d / 30)}mo`;
  if (core === "just now") return core;
  return future ? `in ${core}` : `${core} ago`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function truncateWallet(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

export const CATEGORIES: Category[] = ["Sports", "Tech", "Crypto", "Politics", "Local"];

// Gradient + emoji used as an image fallback (and behind slow-loading photos).
export function categoryVisual(cat: Category | undefined): { grad: string; emoji: string } {
  switch (cat) {
    case "Sports":
      return { grad: "linear-gradient(135deg,#f5325b,#ff8a5c)", emoji: "🏅" };
    case "Tech":
      return { grad: "linear-gradient(135deg,#6366f1,#22d3ee)", emoji: "💻" };
    case "Crypto":
      return { grad: "linear-gradient(135deg,#f59e0b,#f5325b)", emoji: "🪙" };
    case "Politics":
      return { grad: "linear-gradient(135deg,#0ea5e9,#6366f1)", emoji: "🏛️" };
    default:
      return { grad: "linear-gradient(135deg,#16a34a,#84cc16)", emoji: "📍" };
  }
}

export function volume(m: Market): number {
  return m.yesPool + m.noPool;
}

export function yesPct(m: Market): number {
  const v = volume(m);
  if (v === 0) return 50;
  return Math.round((m.yesPool / v) * 100);
}

export function estimatedReturn(m: Market, side: Side, amount: number): number {
  // Parimutuel: winners split the total pool proportional to stake.
  if (amount <= 0) return 0;
  const sidePool = side === "YES" ? m.yesPool : m.noPool;
  const total = volume(m) + amount;
  const share = amount / (sidePool + amount);
  return share * total;
}

// Echo Score = accuracy × ln(volume + 1) × streakMultiplier, scaled.
export function computeEchoScore(u: User): number {
  return Math.round(u.accuracy * Math.log(u.totalVolumeBet + 1) * u.streakMultiplier * 100);
}

export function echoPercentile(score: number): string {
  if (score >= 900) return "Top 1%";
  if (score >= 800) return "Top 5%";
  if (score >= 700) return "Top 10%";
  if (score >= 600) return "Top 20%";
  if (score >= 450) return "Top 40%";
  return "Rising";
}

// ---------- lookups ----------
export const userById = (id: string) => users.find((u) => u.id === id);
export const userByName = (name: string) => users.find((u) => u.username === name);
export const marketById = (id: string) => markets.find((m) => m.id === id);
export const subjectByWallet = (w: string | null) =>
  w ? subjects.find((s) => s.wallet === w) : undefined;
export const subjectBySlug = (slug: string) => subjects.find((s) => s.slug === slug);
export const commentsFor = (marketId: string) => comments.filter((c) => c.marketId === marketId);
export const positionsFor = (marketId: string) => positions.filter((p) => p.marketId === marketId);
export const positionsByUser = (userId: string) => positions.filter((p) => p.userId === userId);
export const marketsByCreator = (userId: string) => markets.filter((m) => m.creatorId === userId);
export const marketsBySubject = (wallet: string) =>
  markets.filter((m) => m.subjectWallet === wallet);

export const CURRENT_USER_ID = "u_you";

// ---------- signed-in identity overlay (Auth0) ----------
// The demo hard-codes the current user as @satoshi_local. When a real user
// signs in via Auth0 we patch that same record (keeping its id, so demo
// positions / follows / score stay attached) to show their name + avatar.
export interface CurrentUserIdentity {
  username: string;
  picture: string | null;
  bio?: string;
}

let currentUserOverride: CurrentUserIdentity | null = null;

function applyCurrentUserOverride() {
  const u = users.find((x) => x.id === CURRENT_USER_ID);
  if (!u) return;
  if (currentUserOverride) {
    const initial =
      currentUserOverride.username.replace(/[^a-z0-9]/gi, "").charAt(0).toUpperCase() || "U";
    u.username = currentUserOverride.username;
    u.picture = currentUserOverride.picture ?? undefined;
    // With a real photo we show the image; otherwise render an initial.
    u.avatar = currentUserOverride.picture ? u.avatar : initial;
    if (currentUserOverride.bio) u.bio = currentUserOverride.bio;
  } else {
    // Revert to the demo identity on logout.
    u.username = "satoshi_local";
    u.avatar = "🦊";
    u.picture = undefined;
  }
}

/** Overlay (or clear) the current user's display identity from Auth0. */
export function setCurrentUserIdentity(identity: CurrentUserIdentity | null) {
  currentUserOverride = identity;
  applyCurrentUserOverride();
}

/** Derive a stable @handle from an Auth0 profile (email local-part or name). */
export function deriveHandle(source: { email?: string | null; name?: string | null }): string {
  const base = (source.email?.split("@")[0] || source.name || "member").toLowerCase();
  const clean = base.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return clean || "member";
}

// ---------- feed scoring ----------
export type FeedCardType =
  | "new_market"
  | "friend_bet"
  | "price_alert"
  | "resolution"
  | "comment"
  | "yield_milestone";

export interface FeedItem {
  id: string;
  type: FeedCardType;
  score: number;
  marketId?: string;
  actorId?: string;
  subjectWallet?: string;
  createdAt: string;
  data: Record<string, unknown>;
}

const WEIGHTS = {
  friendActivity: 3.0,
  followedCreatorNewMarket: 2.5,
  trendingLocation: 2.0,
  similarToBets: 1.5,
  highVolumeHot: 1.0,
  newCreatorEarlyEngagement: 0.8,
};

// Build a personalized feed for a given user id using the documented
// composition score. Returns items sorted by score, highest first.
export function buildFeed(userId: string): FeedItem[] {
  const me = userById(userId);
  if (!me) return [];
  const items: FeedItem[] = [];
  const myBetMarketIds = new Set(positionsByUser(userId).map((p) => p.marketId));
  const myBetTags = new Set(
    positionsByUser(userId)
      .map((p) => marketById(p.marketId)?.tags ?? [])
      .flat()
  );

  // New markets from followed creators
  for (const m of markets) {
    if (m.status !== "OPEN") continue;
    let score = 0;
    if (me.following.includes(m.creatorId)) score += WEIGHTS.followedCreatorNewMarket;
    if (m.location === me.location) score += WEIGHTS.trendingLocation;
    if (m.tags.some((t) => myBetTags.has(t))) score += WEIGHTS.similarToBets;
    if (volume(m) > 200) score += WEIGHTS.highVolumeHot;
    const creator = userById(m.creatorId);
    const isNewCreator = creator ? new Date(creator.createdAt).getTime() > now - 60 * 86400000 : false;
    if (isNewCreator && m.participants >= 8) score += WEIGHTS.newCreatorEarlyEngagement;
    if (score > 0 && new Date(m.createdAt).getTime() > now - 3 * 86400000) {
      items.push({
        id: `feed_nm_${m.id}`,
        type: "new_market",
        score,
        marketId: m.id,
        actorId: m.creatorId,
        createdAt: m.createdAt,
        data: {},
      });
    }
  }

  // Friend bets (positions by people I follow)
  for (const p of positions) {
    if (!me.following.includes(p.userId)) continue;
    const m = marketById(p.marketId);
    if (!m) continue;
    let score = WEIGHTS.friendActivity;
    if (m.location === me.location) score += WEIGHTS.trendingLocation;
    items.push({
      id: `feed_fb_${p.id}`,
      type: "friend_bet",
      score,
      marketId: p.marketId,
      actorId: p.userId,
      createdAt: p.createdAt,
      data: { side: p.side, amount: p.amount },
    });
  }

  // Price alert (hot markets I follow or bet on)
  for (const m of markets) {
    if (m.status !== "OPEN") continue;
    if (!me.followingMarkets.includes(m.id) && !myBetMarketIds.has(m.id)) continue;
    const score = WEIGHTS.highVolumeHot + (myBetMarketIds.has(m.id) ? WEIGHTS.similarToBets : 0);
    items.push({
      id: `feed_pa_${m.id}`,
      type: "price_alert",
      score,
      marketId: m.id,
      createdAt: hoursAgo(4),
      data: { from: 40, to: yesPct(m) },
    });
  }

  // Resolutions on markets I'm in
  for (const m of markets) {
    if (m.status !== "SETTLED" || !m.outcome) continue;
    const iAmIn = myBetMarketIds.has(m.id);
    if (!iAmIn && !me.following.includes(m.creatorId)) continue;
    const myPos = positionsByUser(userId).find((p) => p.marketId === m.id);
    const iWon = myPos?.side === m.outcome;
    items.push({
      id: `feed_res_${m.id}`,
      type: "resolution",
      score: WEIGHTS.friendActivity - 0.5,
      marketId: m.id,
      createdAt: m.resolvedAt ?? m.closesAt,
      data: { outcome: m.outcome, canClaim: iWon },
    });
  }

  // Comment from followed users
  for (const c of comments) {
    if (!me.following.includes(c.userId)) continue;
    if (c.parentId) continue; // top-level only in feed
    items.push({
      id: `feed_cm_${c.id}`,
      type: "comment",
      score: WEIGHTS.friendActivity - 1,
      marketId: c.marketId,
      actorId: c.userId,
      createdAt: c.createdAt,
      data: { content: c.content },
    });
  }

  // Yield milestone for subjects I follow
  for (const s of subjects) {
    if (!me.followingSubjects.includes(s.wallet)) continue;
    if (s.totalYieldEarned <= 0) continue;
    items.push({
      id: `feed_ym_${s.wallet}`,
      type: "yield_milestone",
      score: WEIGHTS.trendingLocation,
      subjectWallet: s.wallet,
      createdAt: hoursAgo(8),
      data: { amount: s.totalYieldEarned, name: s.name },
    });
  }

  return items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// Suggested creators for empty-state / onboarding: highest score/volume,
// not already followed.
export function suggestedCreators(userId: string, limit = 4): User[] {
  const me = userById(userId);
  return users
    .filter((u) => u.id !== userId && !(me?.following ?? []).includes(u.id))
    .sort((a, b) => b.echoScore - a.echoScore || b.totalVolumeBet - a.totalVolumeBet)
    .slice(0, limit);
}
