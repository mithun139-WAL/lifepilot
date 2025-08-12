"use client";

import { createContext, useContext, useState, ReactNode } from "react";

const LoaderContext = createContext<{
  showLoader: () => void;
  hideLoader: () => void;
}>({
  showLoader: () => {},
  hideLoader: () => {},
});

export function LoaderProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const showLoader = () => setIsLoading(true);
  const hideLoader = () => setIsLoading(false);

  return (
    <LoaderContext.Provider value={{ showLoader, hideLoader }}>
      {children}

      {isLoading && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-pulse opacity-30" />
            <div className="w-full h-full border-4 border-cyan-400 rounded-full animate-spin border-t-transparent"></div>
            <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-sm font-orbitron tracking-wide">
              Syncing
            </span>
          </div>
        </div>
      )}
    </LoaderContext.Provider>
  );
}

// Hook to access loader
export const useLoader = () => {
  const context = useContext(LoaderContext);
  if (!context) throw new Error("useLoader must be used within LoaderProvider");
  return context;
};