/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["dockerode", "tar-fs"],
};

export default nextConfig;
