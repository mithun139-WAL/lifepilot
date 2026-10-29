/**
 * src/app/(app)/layout.tsx — Protected App Shell
 *
 * WHY THIS CHANGED:
 * The old layout was an async Server Component that:
 *  1. Called getServerSession() to verify the next-auth cookie
 *  2. Queried Prisma directly to check if the user had a Goal
 *  3. Redirected server-side if either check failed
 *
 * Now:
 *  - Auth enforcement happens in middleware.ts (cookie presence check)
 *    and at the FastAPI layer (JWT verification on every API call).
 *  - The goal check is dropped for now — it will be restored client-side
 *    inside AuthContext/AuthProvider once the FastAPI onboarding flow
 *    is fully verified.
 *  - This layout simply renders MainLayout, which mounts AuthProvider
 *    and validates the token on the client.
 *
 * This makes the layout synchronous and removes the Prisma + next-auth
 * server-side dependencies from the app shell entirely.
 */
import MainLayout from "@/components/layout/MainLayout";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
