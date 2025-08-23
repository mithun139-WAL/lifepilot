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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="flex space-x-2">
            <span className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce"></span>
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