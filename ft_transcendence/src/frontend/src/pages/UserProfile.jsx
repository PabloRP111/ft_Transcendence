import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Cpu, Crown, Zap, ArrowLeft, MessageSquare, UserPlus, UserCheck, Clock, UserMinus, ShieldOff, ShieldCheck, Swords } from "lucide-react";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import { getImgById, getUserById, getUserByUsername } from "../api/users";
import { getFriendStatus, sendFriendRequest, acceptFriendRequest, removeFriend, blockUser, unblockUser } from "../api/friends";
import { usePresence } from "../context/PresenceContext";
import { getStoredToken, decodeToken } from "../utils/auth";
import { useSocket } from "../context/SocketContext";
import { sendGameInvite } from "../utils/gameInvite";
import { useActiveMatch } from "../hooks/useActiveMatch";
import userimage from "../assets/userimage.png";

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const onlineUsers = usePresence();
  const { socketRef } = useSocket();

  const hasActiveMatch = useActiveMatch();
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState("loading");
  const [friendStatus, setFriendStatus] = useState("none"); // none | pending_sent | pending_received | accepted | blocked | blocked_by
  const [friendLoading, setFriendLoading] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let isMounted = true;
    const currentUserId = decodeToken(getStoredToken())?.id;
    const fetchFn = /^\d+$/.test(id) ? getUserById(id) : getUserByUsername(id);
    fetchFn
      .then((data) => {
        // If viewing your own profile, redirect to /profile
        if (currentUserId && String(data.id) === String(currentUserId)) {
          navigate("/profile", { replace: true });
          return Promise.reject("self");
        }
        setProfile({
          id: data.id,
          username: data.username,
          wins: Number(data.wins ?? 0),
          matches: Number(data.matches ?? 0),
          score: Number(data.score ?? 0),
          rank: Number(data.rank ?? 0),
        });
        setStatus("success");
        return Promise.all([
          getFriendStatus(data.id),
          getImgById(data.id).catch(() => null)
        ]);
      })
      .then(([rel, avatarBlob]) => {
        setFriendStatus(rel.status);
        if (avatarBlob && isMounted) {
          objectUrl = URL.createObjectURL(avatarBlob);
          setAvatarUrl(objectUrl);
        } else if (isMounted) {
          setAvatarUrl("");
        }
      })
      .catch((err) => { if (err !== "self") setStatus("error"); });
    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  const handleFriendAction = async () => {
    if (!profile || friendLoading) return;
    setFriendLoading(true);
    try {
      if (friendStatus === "none") {
        await sendFriendRequest(profile.id);
        socketRef.current?.emit("friendRequest", { targetId: String(profile.id) });
        setFriendStatus("pending_sent");
      } else if (friendStatus === "pending_received") {
        await acceptFriendRequest(profile.id);
        socketRef.current?.emit("friendRequestAccepted", { requesterId: String(profile.id) });
        setFriendStatus("accepted");
      } else if (friendStatus === "accepted") {
        await removeFriend(profile.id);
        socketRef.current?.emit("friendRemoved", { targetId: String(profile.id) });
        setFriendStatus("none");
      }
    } finally {
      setFriendLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!profile || friendLoading) return;
    setFriendLoading(true);
    try {
      await blockUser(profile.id);
      socketRef.current?.emit("userBlocked", { targetId: String(profile.id) });
      setFriendStatus("blocked");
    } finally {
      setFriendLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!profile || friendLoading) return;
    setFriendLoading(true);
    try {
      await unblockUser(profile.id);
      socketRef.current?.emit("userUnblocked", { targetId: String(profile.id) });
      setFriendStatus("none");
    } finally {
      setFriendLoading(false);
    }
  };

  // Listen for real-time relationship changes initiated by the other user
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !profile) return;

    const onFriendRequest = ({ fromId }) => {
      if (String(fromId) === String(profile.id)) setFriendStatus("pending_received");
    };
    const onFriendAccepted = ({ fromId }) => {
      if (String(fromId) === String(profile.id)) setFriendStatus("accepted");
    };
    const onFriendDeclined = ({ fromId }) => {
      if (String(fromId) === String(profile.id)) setFriendStatus("none");
    };
    const onFriendRemoved = ({ fromId }) => {
      if (String(fromId) === String(profile.id)) setFriendStatus("none");
    };
    const onBlocked = ({ fromId }) => {
      if (String(fromId) === String(profile.id)) setFriendStatus("blocked_by");
    };
    const onUnblocked = ({ fromId }) => {
      if (String(fromId) === String(profile.id)) setFriendStatus("none");
    };

    socket.on("friendRequestReceived", onFriendRequest);
    socket.on("friendRequestAccepted", onFriendAccepted);
    socket.on("friendRequestDeclined", onFriendDeclined);
    socket.on("friendRemoved", onFriendRemoved);
    socket.on("userBlocked", onBlocked);
    socket.on("userUnblocked", onUnblocked);

    return () => {
      socket.off("friendRequestReceived", onFriendRequest);
      socket.off("friendRequestAccepted", onFriendAccepted);
      socket.off("friendRequestDeclined", onFriendDeclined);
      socket.off("friendRemoved", onFriendRemoved);
      socket.off("userBlocked", onBlocked);
      socket.off("userUnblocked", onUnblocked);
    };
  }, [socketRef.current, profile]);

  const friendButton = () => {
    if (friendStatus === "accepted")
      return { icon: <UserMinus size={14} />, label: "Friends", style: "border-green-500/40 bg-green-500/10 text-green-300 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-300" };
    if (friendStatus === "pending_sent")
      return { icon: <Clock size={14} />, label: "Pending", style: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300 cursor-default" };
    if (friendStatus === "pending_received")
      return { icon: <UserCheck size={14} />, label: "Accept", style: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20" };
    return { icon: <UserPlus size={14} />, label: "Add Friend", style: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20" };
  };

  const isOnline = profile ? onlineUsers.has(String(profile.id)) : false;

  if (status === "loading")
    return <div className="flex min-h-screen items-center justify-center text-cyan-400 font-mono">RETRIEVING_USER_DATA...</div>;

  if (status === "error")
    return <div className="flex min-h-screen items-center justify-center text-red-500 font-mono">USER_NOT_FOUND</div>;

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

          {/* Avatar */}
          <div className="mb-6 relative flex items-center justify-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(0,247,255,0.3)] overflow-hidden bg-black">
              <img src={avatarUrl || userimage} alt="User Profile" className="h-full w-full object-cover" />
            </div>
            <div className="absolute left-1/2 top-1/2 flex h-16 w-16 min-[350px]:h-20 min-[350px]:w-20 -translate-y-1/2 translate-x-14 min-[350px]:translate-x-[4.5rem] flex-col items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-950/10 text-cyan-200">
              <span className="text-[9px] uppercase tracking-[0.2em]">Rank</span>
              <span className="text-lg min-[350px]:text-2xl font-bold text-[color:var(--tron-text)]">#{profile.rank}</span>
            </div>
          </div>

          <h1 className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue">
            {profile.username}
          </h1>

          {/* Online indicator */}
          <p className={`mt-2 text-xs flex items-center justify-center gap-1.5 ${isOnline ? "text-green-400" : "text-cyan-100/40"}`}>
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${isOnline ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" : "bg-gray-600"}`} />
            {isOnline ? "online" : "offline"}
          </p>

          <p className="mt-2 text-xs uppercase tracking-[0.24em] text-cyan-100/70">
            Grid Competitor
          </p>

          {/* Action buttons */}
          <div className="mt-6 flex justify-center gap-3">
            {friendStatus === "blocked" ? (
              // I blocked this user — show Unblock only
              <button
                onClick={handleUnblock}
                disabled={friendLoading}
                className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-widest text-red-300 hover:bg-red-500/20 transition-colors"
              >
                <ShieldCheck size={14} /> Unblock
              </button>
            ) : friendStatus !== "blocked_by" && (
              // Normal state — show DM, friend action, and block button
              <div className="grid grid-cols-2 min-[464px]:flex min-[464px]:flex-row gap-3">
                <button
                  onClick={() => navigate(`/?dm=${profile.id}`)}
                  className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  <MessageSquare size={14} /> DM
                </button>
                {/* Challenge button — only shown when target is online and neither player is in an active match */}
                {isOnline && !hasActiveMatch && (
                  <button
                    onClick={() => {
                      sendGameInvite(socketRef, profile.id, profile.username);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs uppercase tracking-widest text-yellow-300 hover:bg-yellow-500/20 transition-colors"
                    title="Challenge to a game"
                  >
                    <Swords size={14} /> Challenge
                  </button>
                )}
                {(() => { const btn = friendButton(); return (
                  <button
                    onClick={handleFriendAction}
                    disabled={friendLoading || friendStatus === "pending_sent"}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${btn.style}`}
                  >
                    {btn.icon} {btn.label}
                  </button>
                ); })()}
                <button
                  onClick={handleBlock}
                  disabled={friendLoading}
                  className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-transparent px-4 py-2 text-xs uppercase tracking-widest text-red-400/60 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 transition-colors"
                  title="Block user"
                >
                  <ShieldOff size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Blocked-by message — shown instead of stats when this user has blocked me */}
          {friendStatus === "blocked_by" && (
            <p className="mt-10 text-xs uppercase tracking-[0.2em] text-red-400/60 font-mono">
              This user has blocked you
            </p>
          )}

          {/* Stats — hidden if I am blocked by this user */}
          {friendStatus !== "blocked_by" && (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
              <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                <Trophy size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Wins</span>
              </div>
              <p className="text-3xl font-bold">{profile.wins}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
              <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                <Cpu size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Matches</span>
              </div>
              <p className="text-3xl font-bold">{profile.matches}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
              <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                <Zap size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Score</span>
              </div>
              <p className="text-3xl font-bold">{profile.score}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
              <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                <Crown size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Win Rate</span>
              </div>
              <p className="text-3xl font-bold">{winRate}</p>
            </div>
          </div>
          )}

        </motion.section>
      </motion.main>
    </div>
  );
}
