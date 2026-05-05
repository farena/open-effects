/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@open-effects/runtime", "@open-effects/shared-types"]
};
export default nextConfig;
