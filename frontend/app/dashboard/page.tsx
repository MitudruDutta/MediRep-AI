import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard/page";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Check if user is a pharmacist by querying the database
  try {
    const { data: pharmacistProfile, error } = await supabase
      .from("pharmacist_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("Pharmacist profile check:", { userId: user.id, pharmacistProfile, error });

    if (pharmacistProfile) {
      redirect('/pharmacist/dashboard');
    }
  } catch (e) {
    console.error("Error checking pharmacist profile:", e);
  }

  return (
    <Dashboard
      initialUserEmail={user?.email}
      initialUserName={user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0]}
      initialUserAvatar={user?.user_metadata?.avatar_url}
    />
  );
}
