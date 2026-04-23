import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { createPvpMatch } from "../api/game";

const INVITE_TTL = 30; // seconds — must match server-side timer

// ─── Inviter-side helper ──────────────────────────────────────────────────────
// ChatModule and UserProfile call this after emitting gameInviteSend so the
// modal can show the "waiting" banner without needing shared React state.
export function notifyInviteSent(targetUsername) {
  window.dispatchEvent(new CustomEvent("gameInviteSent", { detail: { targetUsername } }));
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function InviteModal() {
  const { socketRef } = useSocket();
  const navigate = useNavigate();

  // Incoming invite from another user
  const [incoming, setIncoming] = useState(null); // { inviterId, inviterUsername }
  const incomingRef = useRef(null); // mirrors incoming for use inside socket closures
  const [countdown, setCountdown] = useState(INVITE_TTL);
  const [accepting, setAccepting] = useState(false);
  const countdownRef = useRef(null);

  // Outgoing invite this user sent
  const [outgoing, setOutgoing] = useState(null); // { targetUsername } | null
  // Brief result message shown after the invite resolves
  const [result, setResult] = useState(null); // "accepted" | "declined" | "expired" | "cancelled" | null
  const resultTimerRef = useRef(null);

  // Keep ref in sync so socket handlers always see the latest value
  useEffect(() => { incomingRef.current = incoming; }, [incoming]);

  // ── Countdown for incoming invite ─────────────────────────────────────────
  useEffect(() => {
    if (!incoming) {
      clearInterval(countdownRef.current);
      setCountdown(INVITE_TTL);
      return;
    }
    setCountdown(INVITE_TTL);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [incoming]);

  // ── Show result banner briefly then clear it ──────────────────────────────
  function showResult(type) {
    setResult(type);
    clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => setResult(null), 3000);
  }

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Target side: incoming invite
    socket.on("gameInviteReceived", ({ inviterId, inviterUsername }) => {
      setIncoming({ inviterId, inviterUsername });
    });

    // Dual-purpose: target receives this when the inviter disconnects,
    // inviter receives this when the target disconnects before answering.
    socket.on("gameInviteCancelled", () => {
      if (incomingRef.current) {
        // We are the target — inviter left, dismiss the modal
        setIncoming(null);
      } else {
        // We are the inviter — target disconnected before answering
        setOutgoing(null);
        showResult("cancelled");
      }
    });

    // Inviter side: target accepted — navigate to the game
    socket.on("gameInviteAccepted", ({ matchId }) => {
      setOutgoing(null);
      setIncoming(null);
      showResult("accepted");
      navigate("/online-game", { state: { matchId } });
    });

    // Inviter side: target actively declined
    socket.on("gameInviteDeclined", () => {
      setOutgoing(null);
      showResult("declined");
    });

    // Inviter side: 30s elapsed with no answer
    socket.on("gameInviteExpired", () => {
      setOutgoing(null);
      showResult("expired");
    });

    return () => {
      socket.off("gameInviteReceived");
      socket.off("gameInviteCancelled");
      socket.off("gameInviteAccepted");
      socket.off("gameInviteDeclined");
      socket.off("gameInviteExpired");
    };
  }, [socketRef.current, navigate]);

  // ── Window event: invite was sent from ChatModule or UserProfile ──────────
  useEffect(() => {
    const handler = (e) => setOutgoing({ targetUsername: e.detail.targetUsername });
    window.addEventListener("gameInviteSent", handler);
    return () => window.removeEventListener("gameInviteSent", handler);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!incoming || accepting) return;
    setAccepting(true);
    try {
      const { matchId } = await createPvpMatch();
      socketRef.current?.emit("gameInviteAccept", { inviterId: incoming.inviterId, matchId });
      setIncoming(null);
      navigate("/online-game", { state: { matchId } });
    } catch (err) {
      console.error("[InviteModal] failed to create match:", err);
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    if (!incoming) return;
    socketRef.current?.emit("gameInviteDecline", { inviterId: incoming.inviterId });
    setIncoming(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const progress = (countdown / INVITE_TTL) * 100;

  return (
    <>
      {/* Incoming invite modal */}
      {incoming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-cyan-500/40 rounded-xl p-6 w-80 shadow-2xl shadow-cyan-500/10 flex flex-col gap-4">
            <p className="text-cyan-300 text-center text-sm font-mono uppercase tracking-widest">
              Game Challenge
            </p>
            <p className="text-white text-center text-lg font-semibold">
              <span className="text-cyan-400">{incoming.inviterUsername}</span> is challenging you!
            </p>
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-gray-400 text-xs text-center font-mono">{countdown}s remaining</p>
            <div className="flex gap-3 mt-1">
              <button
                onClick={handleDecline}
                className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition text-sm"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition text-sm disabled:opacity-50"
              >
                {accepting ? "Starting…" : "Accept"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing invite banner (inviter waiting for response) */}
      {outgoing && !incoming && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-cyan-500/40 rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
          <span className="animate-pulse w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-cyan-300 text-sm font-mono">
            Waiting for <span className="text-white font-semibold">{outgoing.targetUsername}</span>…
          </span>
        </div>
      )}

      {/* Brief result notification */}
      {result && !incoming && !outgoing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-gray-600 rounded-lg px-5 py-3 shadow-lg">
          <span className="text-gray-300 text-sm font-mono">
            {result === "declined" && "Invite declined."}
            {result === "expired" && "Invite expired — no response."}
            {result === "cancelled" && "Invite cancelled."}
            {result === "accepted" && "Challenge accepted!"}
          </span>
        </div>
      )}
    </>
  );
}
