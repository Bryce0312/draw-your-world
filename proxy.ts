import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const cloud = process.env.DYW_NETLIFY_BUILD === "1" || process.env.NETLIFY === "true" || process.env.WALL_STORAGE === "netlify";
  if (!cloud) return NextResponse.next();

  if (request.nextUrl.pathname === "/studio" || request.nextUrl.pathname.startsWith("/studio/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.json(
    { error: "The archived studio is available in the local version. Continue at Draw Your World." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export const config = {
  matcher: [
    "/studio/:path*",
    "/api/agent/:path*",
    "/api/session/:path*",
    "/api/artworks/:path*",
    "/api/assets/:path*",
    "/api/jobs/:path*",
    "/api/proposals/:path*",
  ],
};
