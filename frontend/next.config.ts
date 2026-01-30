import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow Supabase Storage public object URLs (license images, avatars, etc.)
    // `domains` is the simplest/most forgiving option and avoids path-matching edge cases
    // (e.g. accidental double-slashes in stored URLs).
    domains: ["oaskvfqytsexurcgfafo.supabase.co"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oaskvfqytsexurcgfafo.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
