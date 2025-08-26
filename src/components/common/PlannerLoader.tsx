"use client";

import { motion } from "framer-motion";

export default function PlannerLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-6">
      <motion.div
        className="w-40 h-2 rounded-full bg-cyan-400/20 overflow-hidden relative"
      >
        <motion.div
          className="absolute h-full w-1/3 bg-cyan-400 shadow-[0_0_10px_#06b6d4]"
          animate={{ x: ["-100%", "150%"] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        />
      </motion.div>
      <p className="text-cyan-300 text-sm">Loading...</p>
    </div>
  );
}