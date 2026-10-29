"use client";

/**
 * Header.tsx — Redesigned app header
 *
 * DESIGN DECISIONS:
 *
 * 1. DATE + DAY context on the left
 *    The header left side shows the current date and a human-friendly
 *    day label ("Monday · May 16"). This grounds the user temporally —
 *    a small detail that significantly reduces cognitive load. Users
 *    immediately know which "today" they're looking at.
 *
 * 2. QUICK ACTIONS in the center (placeholder for future)
 *    Reserved space for a command palette trigger (⌘K) — a power-user
 *    feature that dramatically speeds up navigation in complex apps.
 *
 * 3. AVATAR stays on the right
 *    Avatar-top-right is a universal convention. Don't fight it.
 *    We keep it minimal — name/email/logout — no profile editing here.
 */

import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { useState } from "react";
import { format } from "date-fns";

export function Header() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const getInitial = () => {
    if (user?.name)  return user.name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "U";
  };

  const now = new Date();
  /* e.g. "Friday · May 16" */
  const dayLabel    = format(now, "EEEE");
  const dateLabel   = format(now, "MMM d, yyyy");

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-white/[0.05] rounded-tr-2xl bg-black/20 backdrop-blur-sm flex-shrink-0">

      {/* ── Left: date context ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white/80">{dayLabel}</span>
        <span className="text-white/20 text-xs">·</span>
        <span className="text-xs text-white/40">{dateLabel}</span>
      </div>

      {/* ── Center: command palette hint (future) ─────────────────────── */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] cursor-pointer hover:bg-white/[0.07] transition-colors">
        <span className="text-xs text-white/30">Search or ask anything…</span>
        <kbd className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">⌘K</kbd>
      </div>

      {/* ── Right: user avatar ─────────────────────────────────────────── */}
      <DropdownMenu onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Avatar className={`cursor-pointer transition-transform duration-150 ${open ? "scale-105" : ""} w-8 h-8`}>
            {user?.image && (
              <AvatarImage
                className="rounded-full ring-1 ring-violet-500/50"
                src={user.image}
                alt={user.name || "User"}
              />
            )}
            <AvatarFallback
              className={`text-xs font-bold transition-all duration-150 ${
                open
                  ? "bg-violet-500 text-white ring-2 ring-violet-400/50"
                  : "bg-white/10 text-white/70 border border-white/20"
              }`}
            >
              {getInitial()}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-52 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl"
        >
          <DropdownMenuLabel className="pb-2">
            <div className="text-sm font-semibold text-white truncate">
              {user?.name || "Anonymous"}
            </div>
            <div className="text-xs text-white/40 truncate">{user?.email}</div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="bg-white/10" />

          <DropdownMenuItem
            onClick={signOut}
            className="text-rose-400 cursor-pointer hover:bg-rose-500/10 hover:text-rose-300 rounded-lg mx-1 my-0.5"
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
