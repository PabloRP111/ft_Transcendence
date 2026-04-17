import { useState, useEffect } from "react"; // Añade esto
import { motion } from "framer-motion";
import { Cpu, Trophy } from "lucide-react";
import Footer from "../components/Footer.jsx";
import Navbar from "../components/Navbar.jsx";
import LightCycles from "../components/LightCycles";
import ChatModule from "../components/ChatModule.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiFetch } from "../api/client";
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

	useEffect(() => {
		if (isAuthenticated) {
			apiFetch("/ranking")
				.then((data) => {
					if (Array.isArray(data)) {
						const sorted = [...data].sort((a, b) => (b.score || 0) - (a.score || 0));
						setTopPlayers(sorted);
					}
					setRankingLoading(false);
				})
				.catch((err) => {
					console.error("[ranking] error:", err);
					setRankingLoading(false);
				});
		}
	}, [isAuthenticated]);

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
				<aside className="hidden lg:flex fixed left-8 top-24 bottom-12 z-40 items-center justify-center w-80 xl:w-96">
					<div className="w-full h-[70vh] max-h-[600px]">
						<ChatModule />
					</div>
				</aside>
			)}

			{/* ── RANKING SIDEBAR ── */}
			{!loading && isAuthenticated && (
				<aside className="hidden lg:flex fixed right-8 top-24 bottom-12 z-40 items-center justify-center w-80 xl:w-96">
					<div className="w-full h-[70vh] max-h-[600px] neon-panel bg-black/20 backdrop-blur-sm p-4 flex flex-col">
						<Trophy className="mx-auto mb-4 text-yellow-500" size={32} />
						<h2 className="text-center text-cyan-300 uppercase tracking-widest mb-4">
							Top Players
						</h2>

						<div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
							{rankingLoading ? (
								<div className="text-center text-[10px] text-cyan-500 animate-pulse mt-10">
									LOADING_RANKING...
								</div>
							) : topPlayers.length > 0 ? (
								topPlayers.map((player, index) => (
									<div
										key={player.id || index}
										onClick={() => navigate(`/profile/${player.username}`)}
										className="flex justify-between items-center px-3 py-2 rounded-md border border-cyan-500/20 bg-black/30 hover:border-cyan-400/50 hover:bg-cyan-900/20 cursor-pointer transition-all group"
									>
										<span className="text-cyan-100 text-sm">
											<span className="text-cyan-600 mr-2 font-bold">#{index + 1}</span>
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
							onClick={() => window.location.href = "/online-game"}
							className="neon-button w-full py-3 text-lg uppercase tracking-normal flex justify-center transition-all"
						>
							ONLINE GAME
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