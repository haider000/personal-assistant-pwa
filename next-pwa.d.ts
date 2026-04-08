declare module "next-pwa" {
  import type { NextConfig } from "next";

  type PwaOptions = Record<string, unknown>;

  export default function withPWA(options: PwaOptions): (config: NextConfig) => NextConfig;
}
