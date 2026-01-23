"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import {
  validateEmail,
  validatePassword,
  validatePasswordsMatch,
  sanitizeEmail,
  sanitizeAuthError,
} from "@/lib/auth/validation";

export interface AuthResult {
  error?: string;
  success?: string;
}

/**
 * Create or update user profile in the database
 */
async function upsertUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, email?: string | null, metadata?: Record<string, unknown>) {
  try {
    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          display_name: metadata?.full_name as string ||
                       metadata?.name as string ||
                       email?.split("@")[0] || null,
          avatar_url: metadata?.avatar_url as string ||
                     metadata?.picture as string || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
          ignoreDuplicates: false
        }
      );

    if (error) {
      console.error("Error upserting user profile:", error);
    }
  } catch (e) {
    console.error("Error in profile upsert:", e);
  }
}

export async function signInWithEmail(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Validate inputs
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return { error: emailValidation.error };
  }

  if (!password) {
    return { error: "Password is required" };
  }

  const supabase = await createClient();
  const sanitizedEmail = sanitizeEmail(email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: sanitizedEmail,
    password,
  });

  if (error) {
    return { error: sanitizeAuthError(error.message) };
  }

  // Create/update user profile on successful sign in
  if (data.user) {
    await upsertUserProfile(supabase, data.user.id, data.user.email, data.user.user_metadata);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUpWithEmail(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return { error: emailValidation.error };
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return { error: passwordValidation.error };
  }

  // Validate passwords match (if confirmPassword provided)
  if (confirmPassword) {
    const matchValidation = validatePasswordsMatch(password, confirmPassword);
    if (!matchValidation.isValid) {
      return { error: matchValidation.error };
    }
  }

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;
  const sanitizedEmail = sanitizeEmail(email);

  const { error } = await supabase.auth.signUp({
    email: sanitizedEmail,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: sanitizeAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  return { success: "Check your email for a confirmation link to complete registration." };
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("Google sign in error:", sanitizeAuthError(error.message));
    redirect("/auth/login?error=oauth_error");
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    // Log the error but don't return it - redirect will happen anyway
    console.error("Sign out error:", sanitizeAuthError(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email") as string;

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return { error: emailValidation.error };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;
  const sanitizedEmail = sanitizeEmail(email);

  const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    return { error: sanitizeAuthError(error.message) };
  }

  // Always return success to prevent email enumeration attacks
  return { success: "If an account exists with this email, you will receive a password reset link." };
}

export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return { error: passwordValidation.error };
  }

  // Validate passwords match
  const matchValidation = validatePasswordsMatch(password, confirmPassword);
  if (!matchValidation.isValid) {
    return { error: matchValidation.error };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: sanitizeAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  return { success: "Password updated successfully." };
}
