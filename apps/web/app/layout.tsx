import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Order Tracker — Theo dõi vận đơn",
  description:
    "Tra cứu trạng thái đơn Shopee Express & các sàn chỉ bằng mã vận đơn. Nhận thông báo qua Telegram.",
  openGraph: {
    title: "Order Tracker",
    description: "Theo dõi đơn hàng không cần mở app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
