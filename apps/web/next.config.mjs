/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@open-effects/runtime", "@open-effects/shared-types"],
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@rspack/core",
    "@rspack/binding",
  ],
};
export default nextConfig;
