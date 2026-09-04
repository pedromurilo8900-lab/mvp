import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function fmtDate(iso: string, pattern = "dd/MM/yyyy"): string {
  try { return format(parseISO(iso), pattern, { locale: ptBR }); } catch { return iso; }
}

export function fmtDateLong(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch { return iso; }
}

export function fmtDateShort(iso: string): string {
  try { return format(parseISO(iso), "d 'de' MMMM", { locale: ptBR }); } catch { return iso; }
}

export function fmtTime(hhmm: string): string {
  return hhmm || "";
}

export function fmtRelative(iso: string): string {
  const today = new Date();
  const d = parseISO(iso);
  const isSameDay = d.toDateString() === today.toDateString();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  if (isSameDay) return `Hoje, ${format(d, "HH:mm")}`;
  if (isYesterday) return `Ontem, ${format(d, "HH:mm")}`;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function age(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  try {
    const d = parseISO(birthDate);
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  } catch { return null; }
}

export const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
