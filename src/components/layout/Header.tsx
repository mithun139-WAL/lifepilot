"use client";

import { signOut, useSession } from "next-auth/react";
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

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  const getInitial = () => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "U";
  };

  const [open, setOpen] = useState(false);

  return (
    <header className="h-16 bg-slate-950 text-white flex justify-between items-center px-6 shadow rounded-tr-2xl">
      <h1 className="font-orbitron text-3xl text-cyan-400">LifePilot</h1>

      <DropdownMenu onOpenChange={(val) => setOpen(val)}>
        <DropdownMenuTrigger asChild>
          <Avatar
            className={`cursor-pointer transition-transform transform ${
              open ? "scale-105" : ""
            }`}
          >
            {" "}
            {user?.image && (
              <AvatarImage src={user.image} alt={user.name || "User"} />
            )}
            <AvatarFallback
              className={`border font-bold transition-all ${
                open
                  ? "bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_10px_#22d3ee]"
                  : "bg-slate-950 text-cyan-400 border-blue-400 shadow-[0_0_10px_#3B82F6]"
              } focus:outline-none focus:ring-0`}
            >
              {" "}
              {getInitial()}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 bg-slate-700 backdrop-blur-md rounded-xl border border-blue-500/20">
          <DropdownMenuLabel>
            <div className="text-sm font-medium text-slate-100">
              {user?.name || "Anonymous"}
            </div>
            <div className="text-xs text-slate-100">{user?.email}</div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="bg-slate-800" />

          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="text-red-500 cursor-pointer hover:bg-red-500 hover:text-white"
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
