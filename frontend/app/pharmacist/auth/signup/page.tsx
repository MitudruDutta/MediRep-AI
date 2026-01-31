import { AuthPage } from "@/components/ui/auth-page";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

export default function SignupPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const nextParam =
    (typeof searchParams?.redirect === "string" && searchParams.redirect) ||
    (typeof searchParams?.next === "string" && searchParams.next) ||
    undefined;

  const redirectTo = sanitizeRedirectPath(nextParam, "/pharmacist/register");

  return <AuthPage mode="signup" redirectTo={redirectTo} />;
}
