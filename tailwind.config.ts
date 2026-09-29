import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: { nova: { canvas: "#f7f7f4", green: "#456a53", sage: "#e9eee6", ink: "#252722" } }, fontFamily: { sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "PingFang SC", "Microsoft YaHei", "sans-serif"] } } },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
