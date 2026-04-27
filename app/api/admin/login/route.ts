import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  const url = new URL(req.url);
  const provided = url.searchParams.get("admin_secret");
  const redirectUrl = new URL("/admin", url.origin);

  if (!secret || provided !== secret) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set(ADMIN_COOKIE_NAME, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
