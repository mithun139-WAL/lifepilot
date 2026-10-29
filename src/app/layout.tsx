import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LifePilot - Your Personal AI Learning Coach",
  description: "Self-learning, self-discipline AI companion for personalized learning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.18 0.01 285)",
                border: "1px solid oklch(1 0 0 / 10%)",
                color: "oklch(0.95 0 0)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}