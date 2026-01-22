import Dashboard from "@/components/dashboard/page";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Dashboard
      initialUserEmail={user?.email}
      initialUserAvatar={user?.user_metadata?.avatar_url}
    />
  );
}
