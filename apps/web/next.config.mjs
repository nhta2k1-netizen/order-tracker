/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@order-tracker/shared"],
  // Shared package dùng Node crypto / fetch — chỉ gọi từ Route Handlers
  serverExternalPackages: [],
};

export default nextConfig;
