import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE_NAME = "tallea_admin_secret";

function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function isAdminSecretConfigured(): boolean {
  return (process.env.ADMIN_SECRET ?? "").length > 0;
}

export async function getAdminAccessStatus(
  _searchParams?: { admin_secret?: string },
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
  if (searchParams?.admin_secret) {
    redirect(`/api/admin/login?admin_secret=${encodeURIComponent(searchParams.admin_secret)}`);
  }

  const status = await getAdminAccessStatus(searchParams);
  if (!status.authorized) redirect("/");
  return {
    protected: status.protected,
    unprotectedWarning: status.unprotectedWarning,
  };
}
