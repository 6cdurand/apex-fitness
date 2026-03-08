import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Inline env vars at build time — required because Netlify's Next.js plugin
  // doesn't pass runtime process.env to the server handler function
  env: {
    GROQ_API_KEY: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '',
  },
};

export default nextConfig;
