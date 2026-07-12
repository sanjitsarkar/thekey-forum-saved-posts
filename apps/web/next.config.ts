import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Allow importing from the shared package
  transpilePackages: ["@forum/shared"],
};

export default withNextIntl(nextConfig);
