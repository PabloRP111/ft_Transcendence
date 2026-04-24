import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Trophy, Cpu, Pencil, Crown, Zap, MessageSquare, Hash, LogOut, Search, UserPlus, ShieldCheck, UserMinus, Swords, UserCheck, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import { getCurrentUser, searchUsers, getImgById } from "../api/users";
import { getFriends, getPendingRequests, acceptFriendRequest, declineFriendRequest, sendFriendRequest, getBlockedUsers, getFriendStatus, removeFriend, unblockUser } from "../api/friends";
import { getConversations, leaveChannel, searchChannels, joinChannel } from "../api/chat";
import { useAuth } from "../context/AuthContext";
import { usePresence } from "../context/PresenceContext";
import { useSocket } from "../context/SocketContext";
import { sendGameInvite } from "../utils/gameInvite";
import { useActiveMatch } from "../hooks/useActiveMatch";
import { sanitizeSearch } from "../utils/security"

const TABS = ["Stats", "Social"];

export default function ProfilePage() {
  const { loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const onlineUsers = usePresence();
  const { socketRef } = useSocket();
  const hasActiveMatch = useActiveMatch();

  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [tab, setTab] = useState("Stats");
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [channels, setChannels] = useState([]);
  const [socialSearch, setSocialSearch] = useState("");
  const [socialResults, setSocialResults] = useState({ users: [], channels: [] });
  const [socialActions, setSocialActions] = useState({}); // tracks per-id action state: "pending" | "done"
  const [blocked, setBlocked] = useState([]); // users I have blocked
  const socialSearchTimer = useRef(null);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    let objectUrl = null;
    let isMounted = true;

    setStatus("loading");
    getCurrentUser()
      .then((data) => {
        setProfile({
          username: data.username,
          wins: Number(data.wins ?? 0),
          matches: Number(data.matches ?? 0),
          score: Number(data.score ?? 0),
          rank: Number(data.rank ?? 0),
        });
        setStatus("success");
        if (!data?.id) return null;
        return getImgById(data.id);
      })
      .then((blob) => {
        if (!blob || !isMounted) return;
        objectUrl = URL.createObjectURL(blob);
        setAvatarUrl(objectUrl);
      })
      .catch(() => setStatus("error"));

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loading, isAuthenticated]);

  // Fetch pending requests on mount so the badge shows without visiting the Social tab first
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    getPendingRequests().then(setPending).catch(() => {});
  }, [loading, isAuthenticated]);

  // Real-time friend request notifications via chat socket
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Someone sent us a friend request — add to pending immediately
    const onFriendRequestReceived = ({ fromId, fromUsername }) => {
      setPending((prev) => {
        if (prev.some((p) => p.id === fromId)) return prev;
        return [...prev, { id: fromId, username: fromUsername }];
      });
    };

    // Someone accepted our request — refresh friends list and update search results
    const onFriendRequestAccepted = ({ fromId }) => {
      getFriends().then(setFriends).catch(() => {});
      setSocialResults((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          String(u.id) === String(fromId) ? { ...u, friendStatus: 'accepted' } : u
        ),
      }));
      setSocialActions((prev) => {
        const next = { ...prev };
        delete next[`user-${fromId}`];
        return next;
      });
    };

    // Someone declined our request — reset their status in search results
    const onFriendRequestDeclined = ({ fromId }) => {
      setSocialResults((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          String(u.id) === String(fromId) ? { ...u, friendStatus: 'none' } : u
        ),
      }));
      setSocialActions((prev) => {
        const next = { ...prev };
        delete next[`user-${fromId}`];
        return next;
      });
    };

    socket.on('friendRequestReceived', onFriendRequestReceived);
    socket.on('friendRequestAccepted', onFriendRequestAccepted);
    socket.on('friendRequestDeclined', onFriendRequestDeclined);

    return () => {
      socket.off('friendRequestReceived', onFriendRequestReceived);
      socket.off('friendRequestAccepted', onFriendRequestAccepted);
      socket.off('friendRequestDeclined', onFriendRequestDeclined);
    };
  }, [socketRef.current]);

  useEffect(() => {
    if (tab !== "Social") return;
    // Use individual catches so one failing endpoint doesn't wipe all sections
    Promise.all([
      getFriends().catch(() => []),
      getPendingRequests().catch(() => []),
      getConversations().catch(() => []),
      getBlockedUsers().catch(() => []),
    ]).then(([f, p, convs, bl]) => {
      setFriends(f);
      setPending(p);
      setChannels(convs.filter((c) => c.type === "channel" && c.name?.toLowerCase() !== "arena_general"));
      setBlocked(bl);
    });
  }, [tab]);

  const handleAccept = async (requesterId) => {
    await acceptFriendRequest(requesterId);
    socketRef.current?.emit('friendRequestAccepted', { requesterId: String(requesterId) });
    setPending((prev) => prev.filter((p) => p.id !== requesterId));
    const updated = await getFriends();
    setFriends(updated);
  };

  const handleDecline = async (requesterId) => {
    await declineFriendRequest(requesterId);
    socketRef.current?.emit('friendRequestDeclined', { requesterId: String(requesterId) });
    setPending((prev) => prev.filter((p) => p.id !== requesterId));
  };

  const handleLeaveChannel = async (convId) => {
    await leaveChannel(convId);
    setChannels((prev) => prev.filter((c) => c.id !== convId));
  };

  const handleSocialSearch = (e) => {
    const raw = e.target.value;
    const q = sanitizeSearch(raw);

    setSocialSearch(q);

    clearTimeout(socialSearchTimer.current);
    if (!q.trim()) {
      setSocialResults({ users: [], channels: [] });
      return;
    }
    if (q.length < 2) 
      return;

    socialSearchTimer.current = setTimeout(async () => {
      const [users, channels] = await Promise.all([
        searchUsers(q).catch(() => []),
        searchChannels(q).catch(() => []),
      ]);

      const enriched = await Promise.all(
        users
          .filter((u) => u.username !== profile.username)
          .map(async (u) => {
            try {
              const { status } = await getFriendStatus(u.id);
              return { ...u, friendStatus: status };
            } catch {
              return { ...u, friendStatus: "none" };
            }
          })
      );

      setSocialResults({ users: enriched, channels });
    }, 300);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-cyan-400 font-mono">INITIALIZING_SESSION...</div>;
  if (!isAuthenticated) return <div className="flex min-h-screen items-center justify-center text-red-500 font-mono">ACCESS_DENIED</div>;
  if (status === "loading" || !profile) return <div className="flex min-h-screen items-center justify-center text-cyan-400 font-mono">RETRIEVING_USER_DATA...</div>;
  if (status === "error") return <div className="flex min-h-screen items-center justify-center text-red-500 font-mono">DATA_CORRUPTION_ERROR</div>;

  const winRate = profile.matches === 0 ? "0.00%" : `${((profile.wins / profile.matches) * 100).toFixed(2)}%`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-[color:var(--tron-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <LightCycles />
        <div className="scanline-overlay" />
      </div>

      <Navbar />

      <motion.main
        className="relative z-20 flex items-center justify-center px-6 py-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.section className="neon-panel relative w-full max-w-3xl p-10 text-center">

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute left-6 top-6 z-30 pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Edit button */}
          <button
            onClick={() => navigate("/edit")}
            className="absolute right-6 top-6 z-30 pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 transition-colors"
          >
            <Pencil size={18} />
          </button>

          {/* Avatar */}
          <div className="mb-6 relative flex items-center justify-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(0,247,255,0.3)] overflow-hidden bg-black">
              {avatarUrl ? (
                <img src={avatarUrl} alt="User Profile" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-y-1/2 translate-x-[4.5rem] flex-col items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-950/10 text-cyan-200">
              <span className="text-[9px] uppercase tracking-[0.2em]">Rank</span>
              <span className="text-2xl font-bold text-[color:var(--tron-text)]">#{profile.rank}</span>
            </div>
          </div>

          <h1 className="neon-title text-4xl uppercase tracking-[0.16em] text-[color:var(--tron-text)]">{profile.username}</h1>
          <p className="mt-4 text-xs uppercase tracking-[0.24em] text-cyan-100/70">Grid Competitor</p>

          {/* Tabs */}
          <div className="mt-8 flex justify-center gap-1 border-b border-cyan-500/20 pb-0">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2 text-xs uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-cyan-100/40 hover:text-cyan-300"
                }`}
              >
                {t}
                {t === "Social" && pending.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] text-white">
                    {pending.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Stats tab */}
          {tab === "Stats" && (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[
                { icon: <Trophy size={18} />, label: "Wins", value: profile.wins },
                { icon: <Cpu size={18} />, label: "Matches", value: profile.matches },
                { icon: <Zap size={18} />, label: "Score", value: profile.score },
                { icon: <Crown size={18} />, label: "Win Rate", value: winRate },
              ].map(({ icon, label, value }) => (
                <div key={label} className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
                  <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                    {icon}
                    <span className="text-xs uppercase tracking-[0.2em]">{label}</span>
                  </div>
                  <p className="text-3xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Social tab */}
          {tab === "Social" && (
            <div className="mt-8 space-y-6 text-left">

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/40" size={13} />
                <input
                  type="text"
                  value={socialSearch}
                  onChange={handleSocialSearch}
                  placeholder="Search users or channels..."
                  className="w-full bg-voidBlack/50 border border-cyan-500/20 rounded-md py-2 pl-8 pr-3 text-xs text-cyan-50 placeholder-cyan-700/50 focus:outline-none focus:border-cyan-400/50 font-mono"
                />
              </div>

              {/* Search results */}
              {socialSearch.trim() && (
                <div className="space-y-4">
                  {socialResults.users.length > 0 && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-cyan-500/50 mb-2">Users</p>
                      <div className="space-y-2">
                        {socialResults.users.map((u) => {
                          // In-session override (after sending a request this search session)
                          const sessionSent = socialActions[`user-${u.id}`] === "done";
                          const fs = sessionSent ? "pending_sent" : (u.friendStatus ?? "none");
                          return (
                            <div key={u.id} className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-2">
                              <button onClick={() => navigate(`/profile/${u.username}`)} className="text-sm text-cyan-50 hover:text-cyan-300 transition-colors">
                                {u.username}
                              </button>
                              <div className="flex gap-2">
                                {/* Friend action button — varies by relationship status */}
                                {fs === "accepted" && (
                                  <span className="flex items-center text-green-400/70" title="Friends">
                                    <UserCheck size={14} />
                                  </span>
                                )}
                                {fs === "pending_sent" && (
                                  <span className="text-[9px] uppercase tracking-widest text-yellow-400/70">Pending</span>
                                )}
                                {fs === "pending_received" && (
                                  <>
                                    <button
                                      onClick={async () => {
                                        await handleAccept(u.id);
                                        setSocialResults((prev) => ({
                                          ...prev,
                                          users: prev.users.map((x) =>
                                            x.id === u.id ? { ...x, friendStatus: "accepted" } : x
                                          ),
                                        }));
                                      }}
                                      className="text-[9px] uppercase tracking-widest border border-green-500/40 text-green-400 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={async () => {
                                        await handleDecline(u.id);
                                        setSocialResults((prev) => ({
                                          ...prev,
                                          users: prev.users.map((x) =>
                                            x.id === u.id ? { ...x, friendStatus: "none" } : x
                                          ),
                                        }));
                                      }}
                                      className="text-[9px] uppercase tracking-widest border border-red-500/40 text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                                    >
                                      Decline
                                    </button>
                                  </>
                                )}
                                {(fs === "blocked" || fs === "blocked_by") && (
                                  <span className="text-[9px] uppercase tracking-widest text-red-400/50">
                                    {fs === "blocked" ? "Blocked" : "Unavailable"}
                                  </span>
                                )}
                                {fs === "none" && (
                                  <button
                                    disabled={socialActions[`user-${u.id}`] === "pending"}
                                    onClick={async () => {
                                      setSocialActions((prev) => ({ ...prev, [`user-${u.id}`]: "pending" }));
                                      await sendFriendRequest(u.id).catch(() => {});
                                      socketRef.current?.emit('friendRequest', { targetId: String(u.id) });
                                      setSocialActions((prev) => ({ ...prev, [`user-${u.id}`]: "done" }));
                                    }}
                                    className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-cyan-500/30 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/10 transition-colors disabled:opacity-40"
                                  >
                                    <UserPlus size={11} /> Add
                                  </button>
                                )}
                                {/* DM button — only if no block in either direction */}
                                {fs !== "blocked" && fs !== "blocked_by" && (
                                  <button onClick={() => navigate(`/?dm=${u.id}`)} className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-cyan-500/30 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/10 transition-colors">
                                    <MessageSquare size={11} /> DM
                                  </button>
                                )}
                                {/* Challenge button — only if online, no block, and not in an active match */}
                                {fs !== "blocked" && fs !== "blocked_by" && onlineUsers.has(String(u.id)) && !hasActiveMatch && (
                                  <button
                                    onClick={() => sendGameInvite(socketRef, u.id, u.username)}
                                    className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-yellow-500/30 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/10 transition-colors"
                                    title="Challenge to a game"
                                  >
                                    <Swords size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {socialResults.channels.length > 0 && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-cyan-500/50 mb-2">Channels</p>
                      <div className="space-y-2">
                        {socialResults.channels.map((c) => {
                          const action = socialActions[`channel-${c.id}`];
                          const alreadyJoined = channels.some((ch) => ch.id === c.id);
                          return (
                            <div key={c.id} className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-2">
                              <button onClick={() => navigate(`/?channel=${c.id}`)} className="flex items-center gap-2 text-sm text-cyan-50 hover:text-cyan-300 transition-colors">
                                <Hash size={13} className="text-cyan-500/60" />
                                {c.name}
                              </button>
                              {alreadyJoined || action === "done" ? (
                                <span className="text-[9px] uppercase tracking-widest text-cyan-400/50">Joined</span>
                              ) : (
                                <button
                                  disabled={action === "pending"}
                                  onClick={async () => {
                                    setSocialActions((prev) => ({ ...prev, [`channel-${c.id}`]: "pending" }));
                                    await joinChannel(c.id).catch(() => {});
                                    setSocialActions((prev) => ({ ...prev, [`channel-${c.id}`]: "done" }));
                                    setChannels((prev) => [...prev, { id: c.id, name: c.name, type: "channel" }]);
                                  }}
                                  className="text-[9px] uppercase tracking-widest border border-cyan-500/30 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/10 transition-colors disabled:opacity-40"
                                >
                                  Join
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {socialResults.users.length === 0 && socialResults.channels.length === 0 && (
                    <p className="text-center text-xs text-cyan-100/30 uppercase tracking-widest">No results</p>
                  )}
                </div>
              )}

              {/* Pending requests */}
              {!socialSearch.trim() && pending.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-cyan-500/50 mb-2">Pending requests</p>
                  <div className="space-y-2">
                    {pending.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-2">
                        <button onClick={() => navigate(`/profile/${p.username}`)} className="text-sm text-cyan-50 hover:text-cyan-300 transition-colors">
                          {p.username}
                        </button>
                        <div className="flex gap-2">
                          <button onClick={() => handleAccept(p.id)} className="text-[9px] uppercase tracking-widest border border-green-500/40 text-green-400 px-2 py-1 rounded hover:bg-green-500/10 transition-colors">
                            Accept
                          </button>
                          <button onClick={() => handleDecline(p.id)} className="text-[9px] uppercase tracking-widest border border-red-500/40 text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors">
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friends list */}
              {!socialSearch.trim() && friends.length === 0 && pending.length === 0 && (
                <p className="text-center text-xs text-cyan-100/30 uppercase tracking-widest mt-8">No friends yet</p>
              )}

              {!socialSearch.trim() && friends.length > 0 && (
                <>
                  {/* Online friends */}
                  {friends.filter((f) => onlineUsers.has(String(f.id))).length > 0 && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-cyan-500/50 mb-2">Online</p>
                      <div className="space-y-2">
                        {friends.filter((f) => onlineUsers.has(String(f.id))).map((f) => (
                          <FriendRow key={f.id} friend={f} online navigate={navigate}
                            onChallenge={!hasActiveMatch ? () => sendGameInvite(socketRef, f.id, f.username) : null}
                            onRemove={async () => { await removeFriend(f.id).catch(() => {}); setFriends((prev) => prev.filter((x) => x.id !== f.id)); }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offline friends */}
                  {friends.filter((f) => !onlineUsers.has(String(f.id))).length > 0 && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-cyan-500/50 mb-2">Offline</p>
                      <div className="space-y-2">
                        {friends.filter((f) => !onlineUsers.has(String(f.id))).map((f) => (
                          <FriendRow key={f.id} friend={f} online={false} navigate={navigate} onRemove={async () => { await removeFriend(f.id).catch(() => {}); setFriends((prev) => prev.filter((x) => x.id !== f.id)); }} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Blocked users */}
              {!socialSearch.trim() && blocked.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-red-500/50 mb-2">Blocked</p>
                  <div className="space-y-2">
                    {blocked.map((u) => (
                      <div key={u.id} className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-950/10 px-4 py-2">
                        <span className="text-sm text-cyan-50/60 font-mono">{u.username}</span>
                        <button
                          onClick={async () => {
                            await unblockUser(u.id).catch(() => {});
                            setBlocked((prev) => prev.filter((b) => b.id !== u.id));
                          }}
                          className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-red-500/30 text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                        >
                          <ShieldCheck size={11} /> Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Channels */}
              {!socialSearch.trim() && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-cyan-500/50 mb-2">Channels</p>
                  {channels.length === 0 ? (
                    <p className="text-center text-xs text-cyan-100/30 uppercase tracking-widest mt-2">No channels joined</p>
                  ) : (
                    <div className="space-y-2">
                      {channels.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-2">
                          <button
                            onClick={() => navigate(`/?channel=${c.id}`)}
                            className="flex items-center gap-2 text-sm text-cyan-50 hover:text-cyan-300 transition-colors"
                          >
                            <Hash size={13} className="text-cyan-500/60" />
                            {c.name}
                          </button>
                          <button
                            onClick={() => handleLeaveChannel(c.id)}
                            className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-red-500/30 text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut size={11} /> Leave
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </motion.section>
      </motion.main>
    </div>
  );
}

function FriendRow({ friend, online, navigate, onChallenge, onRemove }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" : "bg-gray-600"}`} />
        <button onClick={() => navigate(`/profile/${friend.username}`)} className="text-sm text-cyan-50 hover:text-cyan-300 transition-colors">
          {friend.username}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/?dm=${friend.id}`)}
          className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-cyan-500/30 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/10 transition-colors"
        >
          <MessageSquare size={11} /> DM
        </button>
        {online && onChallenge && (
          <button
            onClick={onChallenge}
            className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-yellow-500/30 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/10 transition-colors"
            title="Challenge to a game"
          >
            <Swords size={11} />
          </button>
        )}
        <button
          onClick={onRemove}
          className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-red-500/20 text-red-400/50 px-2 py-1 rounded hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 transition-colors"
          title="Remove friend"
        >
          <UserMinus size={11} />
        </button>
      </div>
    </div>
  );
}
