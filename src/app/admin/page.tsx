import type { Metadata } from "next";
import { AdminPage } from "@/features/admin/AdminPage";

export const metadata: Metadata = {
  title: "ניהול הזמנות",
  description: "ניהול הזמנות אימון טניס",
};

export default function Page() {
  return <AdminPage />;
}
