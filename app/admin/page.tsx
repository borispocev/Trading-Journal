import { requireAdmin } from "@/lib/auth";
import AdminPanel from "./AdminPanel";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const admin = requireAdmin();
  return (
    <div className="space-y-8 max-w-5xl animate-fade-in">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tightest">Admin</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Manage users and invite codes. Each user has their own isolated trades,
          journal, accounts, and commission rates.
        </p>
      </header>

      <AdminPanel currentUserId={admin.id} />
    </div>
  );
}
