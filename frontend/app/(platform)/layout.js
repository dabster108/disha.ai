import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";

export const metadata = {
  title: "Dashboard | DISHA AI",
};

export default function PlatformLayout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopHeader />
      <main className="ml-64 mt-[72px] min-h-screen">{children}</main>
    </div>
  );
}
