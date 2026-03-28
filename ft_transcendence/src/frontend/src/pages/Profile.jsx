import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Cpu, Pencil, Crown, Zap, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import { getCurrentUser } from "../api/users";
import { getFriends, getPendingRequests, acceptFriendRequest, declineFriendRequest } from "../api/friends";
import { useAuth } from "../context/AuthContext";
import { usePresence } from "../context/PresenceContext";
import userimage from "../assets/userimage.png";

const TABS = ["Stats", "Friends"];

export default function ProfilePage() {
  const { loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const onlineUsers = usePresence();

  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [tab, setTab] = useState("Stats");
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

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
      })
      .catch(() => setStatus("error"));
  }, [loading, isAuthenticated]);

  useEffect(() => {
    if (tab !== "Friends") return;
    Promise.all([getFriends(), getPendingRequests()])
      .then(([f, p]) => { setFriends(f); setPending(p); })
      .catch(() => {});
  }, [tab]);

  const handleAccept = async (requesterId) => {
    await acceptFriendRequest(requesterId);
    setPending((prev) => prev.filter((p) => p.id !== requesterId));
    const updated = await getFriends();
    setFriends(updated);
  };

  const handleDecline = async (requesterId) => {
    await declineFriendRequest(requesterId);
    setPending((prev) => prev.filter((p) => p.id !== requesterId));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-cyan-400 font-mono">INITIALIZING_SESSION...</div>;
  if (!isAuthenticated) return <div className="flex min-h-screen items-center justify-center text-red-500 font-mono">ACCESS_DENIED</div>;
  if (status === "loading" || !profile) return <div className="flex min-h-screen items-center justify-center text-cyan-400 font-mono">RETRIEVING_USER_DATA...</div>;
  if (status === "error") return <div className="flex min-h-screen items-center justify-center text-red-500 font-mono">DATA_CORRUPTION_ERROR</div>;

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

          {/* Edit button */}
          <button
            onClick={() => navigate("/edit")}
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 transition-colors"
          >
            <Pencil size={18} />
          </button>

          {/* Avatar */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(0,247,255,0.3)] overflow-hidden bg-black">
              <img src={userimage} alt="User Profile" className="h-full w-full object-cover" />
            </div>
          </div>

          <h1 className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue">{profile.username}</h1>
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
                {t === "Friends" && pending.length > 0 && (
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
                { icon: <Crown size={18} />, label: "Rank", value: `#${profile.rank}` },
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

          {/* Friends tab */}
          {tab === "Friends" && (
            <div className="mt-8 space-y-6 text-left">

              {/* Pending requests */}
              {pending.length > 0 && (
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
              {friends.length === 0 && pending.length === 0 && (
                <p className="text-center text-xs text-cyan-100/30 uppercase tracking-widest mt-8">No friends yet</p>
              )}

              {friends.length > 0 && (
                <>
                  {/* Online friends */}
                  {friends.filter((f) => onlineUsers.has(String(f.id))).length > 0 && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-cyan-500/50 mb-2">Online</p>
                      <div className="space-y-2">
                        {friends.filter((f) => onlineUsers.has(String(f.id))).map((f) => (
                          <FriendRow key={f.id} friend={f} online navigate={navigate} />
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
                          <FriendRow key={f.id} friend={f} online={false} navigate={navigate} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </motion.section>
      </motion.main>
    </div>
  );
}

function FriendRow({ friend, online, navigate }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" : "bg-gray-600"}`} />
        <button onClick={() => navigate(`/profile/${friend.username}`)} className="text-sm text-cyan-50 hover:text-cyan-300 transition-colors">
          {friend.username}
        </button>
      </div>
      <button
        onClick={() => navigate(`/?dm=${friend.id}`)}
        className="flex items-center gap-1 text-[9px] uppercase tracking-widest border border-cyan-500/30 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/10 transition-colors"
      >
        <MessageSquare size={11} /> DM
      </button>
    </div>
  );
}
