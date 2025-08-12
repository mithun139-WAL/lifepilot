"use client";

import { useEffect, useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./SideBar";
import { LoaderProvider } from "../common/Loader";
import { SessionProvider } from "next-auth/react";
import { ChatProvider } from "@/context/ChatContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored !== null) {
      setCollapsed(stored === "true");
    } else {
      setCollapsed(false);
    }
  }, []);

  if (collapsed === null) return null;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebarCollapsed", String(next));
  };

  return (
    <SessionProvider>
      <LoaderProvider>
        <ChatProvider>
        <div className="fixed inset-0 bg-gradient-to-br from-slate-950 to-black p-6 flex items-center justify-center overflow-hidden">
          <div className="relative w-[95vw] h-[95vh] rounded-3xl p-[2px] shadow-[0_0_40px_#3B82F6]/50">
            <div className="relative z-10 flex h-full w-full rounded-[1.4rem] bg-white/5 backdrop-blur-md">
              <div className="absolute inset-0 pointer-events-none rounded-[1.4rem] bg-radial-at-center from-blue-500/20 via-transparent to-transparent opacity-30 blur-2xl" />

              <Sidebar collapsed={collapsed} toggle={toggleCollapsed} />

              <div className="flex-1 flex flex-col min-h-0">
                <Header />
                <main className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-950/40 text-white">
                  {children}
                </main>
              </div>
            </div>
          </div>
        </div>
        </ChatProvider>
      </LoaderProvider>
    </SessionProvider>
  );
}
