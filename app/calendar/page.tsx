import { getDb, type Trade } from "@/lib/db";
import { dailyPnlMap } from "@/lib/stats";
import { enrichTradesWithFees, asNetTrades } from "@/lib/commissions";
import { requireUser } from "@/lib/auth";
import CalendarView from "@/components/CalendarView";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

function parseMonth(input: string | undefined): { year: number; month: number } {
  if (input) {
    const m = input.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      if (month >= 0 && month <= 11) return { year, month };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const { year, month } = parseMonth(searchParams.month);
  const user = requireUser();

  const db = getDb();
  const raw = db
    .prepare("SELECT * FROM trades WHERE user_id = ?")
    .all(user.id) as Trade[];
  const netTrades = asNetTrades(enrichTradesWithFees(db, user.id, raw));
  const dayMap = dailyPnlMap(netTrades);

  const dayData: Record<string, { pnl: number; trades: number }> = {};
  for (const [k, v] of dayMap) dayData[k] = v;

  return <CalendarView year={year} month={month} dayData={dayData} />;
}
