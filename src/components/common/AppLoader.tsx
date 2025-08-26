"use client";

import { motion } from "framer-motion";

export default function AppLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-lg">
      <motion.div
        className="w-22 h-22 rounded-full border-4 border-cyan-400/40 border-t-cyan-400 shadow-[0_0_20px_#06b6d4]"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      />
      <p className="absolute bottom-16 text-cyan-300 text-lg font-medium tracking-wider">
        AI Coach is getting ready…
      </p>
    </div>
  );
}