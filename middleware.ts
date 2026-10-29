import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * middleware.ts
 *
 * WHY WE CHANGED THIS:
 * The old middleware used `getToken` from next-auth/jwt to verify the
 * next-auth session cookie. Now that auth lives in FastAPI (JWTs stored in
 * localStorage + a plain cookie "lp_access_token"), we can't use next-auth
 * helpers here.
 *
 * The new strategy:
 * - Check for the presence of the "lp_access_token" cookie (set by tokenStore.ts).
 * - If it's present → allow the request through.
 * - If it's absent → redirect to /auth/signin.
 *
 * IMPORTANT: This is a *routing hint only*, NOT a security boundary.
 * The Edge Runtime cannot verify JWT signatures (no crypto libs), so we
 * don't try. Real authentication enforcement happens at the FastAPI layer:
 * every protected endpoint extracts and validates the Bearer token.
 * If an attacker plants a fake cookie, FastAPI will reject the request
 * with a 401 and apiClient will redirect them to sign-in anyway.
 *
 * The onboarding redirect is intentionally removed for now.
 * It will be restored as a client-side check in AuthProvider once we
 * confirm the FastAPI onboarding_complete field is stable.
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ── Public routes — no token required ─────────────────────────────────
    const publicRoutes = ['/auth/signin', '/auth/signup', '/auth/verify-email'];
    const isPublicRoute = publicRoutes.some((route) =>
        pathname.startsWith(route)
    );

    // Next.js API routes — let them through (next-auth callbacks, etc.)
    const publicApiRoutes = ['/api/auth'];
    const isPublicApiRoute = publicApiRoutes.some((route) =>
        pathname.startsWith(route)
    );

    if (isPublicRoute || isPublicApiRoute) {
        return NextResponse.next();
    }

    // ── Check for our access token cookie ─────────────────────────────────
    // tokenStore.setTokens() plants "lp_access_token" as a plain (non-HttpOnly)
    // cookie so the middleware can read it. Presence = user was logged in on
    // this device; absence = never logged in or explicitly signed out.
    const token = request.cookies.get('lp_access_token')?.value;

    if (!token && pathname !== '/') {
        const signInUrl = new URL('/auth/signin', request.url);
        signInUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
