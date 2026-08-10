import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase's local auth redirects can land back on either localhost or
  // 127.0.0.1 depending on which one initiated sign-in — allow both so the
  // dev server doesn't silently block its own JS chunks on the "wrong" one.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
