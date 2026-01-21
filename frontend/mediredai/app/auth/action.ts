"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email");
  const password = formData.get("password");

  // Validate inputs
  if (!email || typeof email !== "string" || !email.trim()) {
    redirect("/auth/error?message=" + encodeURIComponent("Email is required"));
  }

  if (!password || typeof password !== "string") {
    redirect("/auth/error?message=" + encodeURIComponent("Password is required"));
  }

  const data = {
    email: email.trim(),
    password: password, // Do not trim password - whitespace may be intentional
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    console.error("Login error:", error.message);
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email");
  const password = formData.get("password");

  // Validate inputs
  if (!email || typeof email !== "string" || !email.trim()) {
    redirect("/auth/error?message=" + encodeURIComponent("Email is required"));
  }

  if (!password || typeof password !== "string") {
    redirect("/auth/error?message=" + encodeURIComponent("Password is required"));
  }

  const data = {
    email: email.trim(),
    password: password, // Do not trim password - whitespace may be intentional
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    console.error("Signup error:", error.message);
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    console.error("Google OAuth error:", error.message);
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  } else {
    redirect("/auth/error?message=" + encodeURIComponent("OAuth failed to generate redirect URL"));
  }
}
