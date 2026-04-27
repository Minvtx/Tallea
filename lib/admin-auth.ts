import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE_NAME = "tallea_admin_secret";

function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function isAdminSecretConfigured(): boolean {
  return (process.env.ADMIN_SECRET ?? "").length > 0;
}

export async function getAdminAccessStatus(
  searchParams?: { admin_secret?: string },
): Promise<{
  authorized: boolean;
  protected: boolean;
  unprotectedWarning: boolean;
}> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return {
      authorized: !isProduction(),
      protected: false,
      unprotectedWarning: !isProduction(),
    };
  }

  const headerSecret = (await headers()).get("x-admin-secret");
  const cookieStore = await cookies();
  const cookieSecret = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const querySecret = searchParams?.admin_secret;

  if (querySecret === secret) {
    cookieStore.set(ADMIN_COOKIE_NAME, secret, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      maxAge: 60 * 60 * 24 * 30,
    });
    return { authorized: true, protected: true, unprotectedWarning: false };
  }

  return {
    authorized: headerSecret === secret || cookieSecret === secret,
    protected: true,
    unprotectedWarning: false,
  };
}

export async function requireAdminAccess(): Promise<void> {
  const status = await getAdminAccessStatus();
  if (!status.authorized) {
    throw new Error(
      isProduction() && !isAdminSecretConfigured()
        ? "Unauthorized admin action. ADMIN_SECRET must be configured in production."
        : "Unauthorized admin action. Provide ?admin_secret=... once to set the admin cookie, or send x-admin-secret.",
    );
  }
}

export async function guardAdminPage(searchParams?: {
  admin_secret?: string;
}): Promise<{
  protected: boolean;
  unprotectedWarning: boolean;
}> {
  const status = await getAdminAccessStatus(searchParams);
  if (!status.authorized) redirect("/");
  return {
    protected: status.protected,
    unprotectedWarning: status.unprotectedWarning,
  };
}
