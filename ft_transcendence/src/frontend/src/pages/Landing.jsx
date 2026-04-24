import { useState, useEffect } from "react"; // Añade esto
import { motion } from "framer-motion";
import {
	Cpu,
	Trophy,
	ChevronUp,
	ChevronDown,
	ArrowUpDown,
	Users,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import Footer from "../components/Footer.jsx";
import Navbar from "../components/Navbar.jsx";
import LightCycles from "../components/LightCycles";
import ChatModule from "../components/ChatModule.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiFetch } from "../api/client";
import { getCurrentUser } from "../api/users.js";
import { getFriends } from "../api/friends.js";
import { useNavigate } from "react-router-dom";

const containerVariants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: {
			staggerChildren: 0.16,
			delayChildren: 0.18,
		},
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 18 },
	show: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.55,
			ease: "easeOut",
		},
	},
};

export default function GridLanding() {
	const { isAuthenticated, loading } = useAuth();
	const navigate = useNavigate();
	const [topPlayers, setTopPlayers] = useState([]);
	const [rankingLoading, setRankingLoading] = useState(true);
	const [rankingPage, setRankingPage] = useState(0);
	const [rankingAsc, setRankingAsc] = useState(false);
	const [showFriendsOnly, setShowFriendsOnly] = useState(false);
	const [currentUserId, setCurrentUserId] = useState(null);
	const [friendIds, setFriendIds] = useState([]);
	const [chatCollapsed, setChatCollapsed] = useState(false);
	const [rankingCollapsed, setRankingCollapsed] = useState(false);
	const pageSize = 8;

	useEffect(() => {
		if (isAuthenticated) {
			apiFetch("/ranking")
				.then((data) => {
					if (Array.isArray(data)) {
						setTopPlayers(data);
						setRankingPage(0);
					}
					setRankingLoading(false);
				})
				.catch((err) => {
					console.error("[ranking] error:", err);
					setRankingLoading(false);
				});
		}
	}, [isAuthenticated]);

	useEffect(() => {
		if (!isAuthenticated) {
			setCurrentUserId(null);
			setFriendIds([]);
			return;
		}

		getCurrentUser()
			.then((data) => {
				if (data?.id) {
					setCurrentUserId(data.id);
				}
			})
			.catch(() => {
				setCurrentUserId(null);
			});
	}, [isAuthenticated]);

	useEffect(() => {
		if (!isAuthenticated || !showFriendsOnly) {
			return;
		}

		getFriends()
			.then((data) => {
				if (Array.isArray(data)) {
					setFriendIds(data.map((friend) => friend.id));
				}
			})
			.catch(() => {
				setFriendIds([]);
			});
	}, [isAuthenticated, showFriendsOnly]);

	const sortedPlayers = [...topPlayers].sort((a, b) => {
		const scoreA = a.score || 0;
		const scoreB = b.score || 0;
		if (scoreA === scoreB) {
			return (a.id || 0) - (b.id || 0);
		}
		return rankingAsc ? scoreA - scoreB : scoreB - scoreA;
	});
	const friendIdSet = new Set(friendIds);
	const filteredPlayers = showFriendsOnly
		? sortedPlayers.filter((player) => player.id === currentUserId || friendIdSet.has(player.id))
		: sortedPlayers;

	const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
	const safePage = Math.min(rankingPage, totalPages - 1);
	const pageStart = safePage * pageSize;
	const pageItems = filteredPlayers.slice(pageStart, pageStart + pageSize);
	const matchId = localStorage.getItem("activeMatch");

	return (
		<div className="relative flex flex-col min-h-screen overflow-hidden bg-voidBlack font-mono text-[color:var(--tron-text)]">

			{/* ── BACKGROUND LAYER ── */}
			<div className="pointer-events-none absolute inset-0">
				<div className="grid-atmosphere" />
				<div className="grid-floor" />
				<LightCycles />
				<div className="scanline-overlay" />
			</div>

			<Navbar />

			{/* ── CHAT SIDEBAR (Only for Authenticated Users) ── */}
			{!loading && isAuthenticated && (
				<aside
					className={`hidden lg:flex fixed left-8 top-24 bottom-12 z-40 items-center justify-center transition-all duration-300 ${
						chatCollapsed ? "w-12" : "w-80 xl:w-96"
					}`}
				>
					<div className="relative w-full h-[70vh] max-h-[600px] pt-10">
						<button
							className="neon-button absolute right-2 top-2 px-2 py-2 text-[10px] uppercase tracking-widest flex items-center gap-2"
							onClick={() => setChatCollapsed((value) => !value)}
							aria-label={chatCollapsed ? "Open chat sidebar" : "Collapse chat sidebar"}
							title={chatCollapsed ? "Open chat" : "Collapse chat"}
						>
							{chatCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
							{chatCollapsed ? "CHAT" : "HIDE"}
						</button>
						<div
							className={`w-full h-full transition-all duration-300 ${
								chatCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
							}`}
						>
							<ChatModule />
						</div>
					</div>
				</aside>
			)}

			{/* ── RANKING SIDEBAR ── */}
			{!loading && isAuthenticated && (
				<aside
					className={`hidden lg:flex fixed right-4 sm:right-6 lg:right-8 top-24 bottom-12 z-40 items-center justify-center transition-all duration-300 overflow-visible ${
						rankingCollapsed ? "w-12" : "w-72 sm:w-80 xl:w-96"
					}`}
				>
					<div
						className={`relative w-full h-[70vh] max-h-[600px] flex flex-col transition-all duration-300 ${
							rankingCollapsed ? "pt-10" : "neon-panel bg-black/20 backdrop-blur-sm p-4 pt-10"
						}`}
					>
						<button
							className="neon-button absolute left-2 top-2 px-2 py-2 text-[10px] uppercase tracking-widest flex items-center gap-2"
							onClick={() => setRankingCollapsed((value) => !value)}
							aria-label={rankingCollapsed ? "Open ranking sidebar" : "Collapse ranking sidebar"}
							title={rankingCollapsed ? "Open ranking" : "Collapse ranking"}
						>
							{rankingCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
							{rankingCollapsed ? "RANK" : "HIDE"}
						</button>
						<div
							className={`flex flex-col flex-1 transition-all duration-300 ${
								rankingCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
							}`}
						>
						<div className="grid grid-cols-[1fr_auto_1fr] items-center mb-4">
							<div className="flex justify-start">
								<button
									className="neon-button px-2 py-2 text-[10px] uppercase tracking-widest flex items-center gap-2"
									onClick={() => {
										setShowFriendsOnly((value) => !value);
										setRankingPage(0);
									}}
									aria-label="Show only friends and me"
									title={showFriendsOnly ? "Show all players" : "Show only friends"}
								>
									<Users size={14} />
									{showFriendsOnly ? "FRIENDS" : "ALL"}
								</button>
							</div>
							<Trophy className="justify-self-center text-yellow-500" size={32} />
							<div className="flex justify-end">
								<button
									className="neon-button px-2 py-2 text-[10px] uppercase tracking-widest flex items-center gap-2"
									onClick={() => {
										setRankingAsc((value) => !value);
										setRankingPage(0);
									}}
									aria-label="Toggle ranking order and go to first page"
									title={rankingAsc ? "Highest score first" : "Lowest score first"}
								>
									<ArrowUpDown size={14} />
									{rankingAsc ? "ASC" : "DESC"}
								</button>
							</div>
						</div>
						<h2 className="text-center text-cyan-300 uppercase tracking-widest mb-4">
							Top Players
						</h2>

						<div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
							{rankingLoading ? (
								<div className="text-center text-[10px] text-cyan-500 animate-pulse mt-10">
									LOADING_RANKING...
								</div>
							) : topPlayers.length > 0 ? (
								pageItems.map((player, index) => (
									<div
										key={player.id || index}
										onClick={() => navigate(`/profile/${player.username}`)}
										className="flex justify-between items-center px-3 py-2 rounded-md border border-cyan-500/20 bg-black/30 hover:border-cyan-400/50 hover:bg-cyan-900/20 cursor-pointer transition-all group"
									>
										<span className="text-cyan-100 text-sm">
											<span className="text-cyan-600 mr-2 font-bold">#{pageStart + index + 1}</span>
											<span className="group-hover:text-cyan-300 transition-colors">
												{player.username}
											</span>
										</span>
										<span className="text-cyan-400 text-sm font-bold group-hover:neon-text-sm">
											{player.score} <span className="text-[9px] text-cyan-800">PTS</span>
										</span>
									</div>
								))
							) : (
								<div className="text-center text-[10px] text-cyan-700 mt-10">
									NO_RECORDS_FOUND
								</div>
							)}
						</div>

						<div className="mt-4 flex items-center justify-between">
							<button
								className="neon-button px-3 py-2 text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
								onClick={() => setRankingPage((page) => Math.max(0, page - 1))}
								disabled={safePage === 0 || totalPages <= 1}
								aria-label="Previous ranking page"
							>
								<ChevronUp size={14} />
								Prev
							</button>
							<div className="text-[10px] text-cyan-500 uppercase tracking-[0.3em]">
								{safePage + 1} / {totalPages}
							</div>
							<button
								className="neon-button px-3 py-2 text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
								onClick={() => setRankingPage((page) => Math.min(totalPages - 1, page + 1))}
								disabled={safePage >= totalPages - 1 || totalPages <= 1}
								aria-label="Next ranking page"
							>
								Next
								<ChevronDown size={14} />
							</button>
						</div>
						</div>
					</div>
				</aside>
			)}

			{/* ── MAIN ARENA CONTENT ── */}
			<motion.main
				className="relative z-20 flex flex-col flex-1 min-h-[calc(100vh-176px)] items-center justify-start px-4 pt-16 sm:px-6 lg:px-8"
				variants={containerVariants}
				initial="hidden"
				animate="show"
			>
				<motion.section
					variants={itemVariants}
					className="neon-panel w-full max-w-3xl p-8 sm:p-10 text-center flex flex-col items-center gap-4 bg-black/20 backdrop-blur-sm"
				>
					<motion.h1
						variants={itemVariants}
						className="neon-title text-5xl sm:text-6xl md:text-6xl uppercase tracking-[0.04em]"
					>
						ENTER THE ARENA
					</motion.h1>

					<motion.div
						variants={itemVariants}
						className="mt-8 flex flex-col items-center gap-4 w-full max-w-xs sm:max-w-sm"
					>
						<button
							onClick={() => {
								if (matchId) {
									navigate("/online-game", { state: { matchId } });
								} else {
									window.location.href = "/online-game";
								}
								}}
							className="neon-button w-full py-3 text-lg uppercase tracking-normal flex justify-center transition-all"
						>
							{matchId ? "RECONNECT" : "ONLINE GAME"}
						</button>

						<button
							onClick={() => window.location.href = "/ai-game"}
							className="neon-button w-full py-3 text-lg uppercase tracking-normal flex justify-center transition-all"
						>
							PLAY VS AI
						</button>
					</motion.div>

					<motion.div
						variants={itemVariants}
						className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/45 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-cyan-100/85 bg-cyan-950/20"
					>
						<Cpu size={14} />
						Arena Core Online
					</motion.div>
				</motion.section>

				{/* Decorative Title */}
				<motion.h1
					className="landing-tron-title mt-10 sm:mt-28 select-none"
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 1.2, delay: 0.2 }}
				>
					TRON GAME
				</motion.h1>
			</motion.main>

			<Footer />
		</div>
	);
}