"use client";
import { useTranslations } from "next-intl";
import { useData, useLocalName } from "@/components/providers";
import { PartnerBadge } from "@/components/ui/bits";
import type { Transaction } from "@/lib/data/types";
import { useMoney } from "@/lib/hooks/use-money";
import { formatDate } from "./format-date";

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  const t = useTranslations("project");
  const money = useMoney();
  const name = useLocalName();
  const { partners } = useData();
  const rows = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-l-border text-xs font-bold uppercase tracking-wider text-l-muted">
            <th className="py-2 pr-4">{t("date")}</th>
            <th className="py-2 pr-4">{t("type")}</th>
            <th className="py-2 pr-4">{t("partner")}</th>
            <th className="py-2 text-right">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx, i) => (
            <tr key={i} className="border-b border-l-border/60 last:border-0">
              <td className="tabular whitespace-nowrap py-2.5 pr-4 text-l-muted">{formatDate(tx.date)}</td>
              <td className="py-2.5 pr-4">
                <span
                  className={
                    tx.type === "commitment"
                      ? "rounded-full bg-[#2d90f2]/10 px-2 py-0.5 text-xs font-semibold text-[#1f6fbf]"
                      : "rounded-full bg-l-teal/10 px-2 py-0.5 text-xs font-semibold text-l-teal"
                  }
                >
                  {t(tx.type)}
                </span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <PartnerBadge partner={partners.get(tx.partner_id)} size={16} />
                  {name(partners.get(tx.partner_id)) || tx.partner_id}
                </span>
              </td>
              <td className="tabular whitespace-nowrap py-2.5 text-right font-semibold">{money(tx.amount_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
