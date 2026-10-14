import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar user={{ name: user.name, username: user.username, role: user.role, plus: user.plus }} />
      <main className="pb-20 md:ml-60 md:pb-0">{children}</main>
    </div>
  );
}
