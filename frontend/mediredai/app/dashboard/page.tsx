import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard/dashboard";
import { cookies } from "next/headers";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = await createClient();
  
  // Log cookies for debugging
  const allCookies = cookieStore.getAll();
  const authCookies = allCookies.filter(c => c.name.includes('auth-token'));
  console.log("[Dashboard Page] All cookies:", allCookies.map(c => c.name));
  console.log("[Dashboard Page] Auth cookies:", authCookies.map(c => ({ name: c.name, valueLength: c.value.length })));
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  console.log("[Dashboard Page] User check - User:", user?.email, "Error:", error?.message);

  if (!user) {
    console.log("[Dashboard Page] No user, redirecting to login");
    redirect("/auth/login");
  }

  return <Dashboard initialUserEmail={user.email || null} />;
}
