import type { Metadata } from "next";
import "@/styles/booking.css";

export const metadata: Metadata = {
  title: "קביעת אימון טניס",
  description: "מערכת לקביעת אימוני טניס בימי שישי",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
