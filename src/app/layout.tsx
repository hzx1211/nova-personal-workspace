import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOVA · 个人工作台",
  description: "一个清晰、安静的个人工作台。当前版本使用浏览器本地演示数据。",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
