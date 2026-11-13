// Shared data shapes. The Supabase `project_dataset` view and the seed JSON both produce `Dataset`.

export type PartnerType = "bilateral" | "multilateral" | "ingo" | "other";
export type FlowType = "grant" | "loan" | "technical_assistance" | "in_kind";
export type Status = "pipeline" | "ongoing" | "completed" | "suspended";
export type TxType = "commitment" | "disbursement";

export const STATUSES: Status[] = ["pipeline", "ongoing", "completed", "suspended"];
export const FLOW_TYPES: FlowType[] = ["grant", "loan", "technical_assistance", "in_kind"];

export interface Partner {
  id: string; // slug, e.g. "japan", "adb"
  name_en: string;
  name_ne: string;
  type: PartnerType;
  iso2: string | null; // for flag-icons; null for multilaterals
  short: string; // badge text for multilaterals, e.g. "ADB"
  /** capital / HQ [lng, lat]; drives the partner's position on the ring */
  hq: [number, number];
}

export interface Sector {
  code: string;
  name_en: string;
  name_ne: string;
  dac_codes: string[];
}

export interface Funding {
  partner_id: string;
  committed_usd: number;
  disbursed_usd: number;
}

export interface ProjectLocation {
  area_code: string; // province (P1..P7), district slug, or palika code
  share_pct: number | null;
}

export interface Transaction {
  date: string; // ISO date
  type: TxType;
  partner_id: string;
  amount_usd: number;
  note?: string | null;
}

export interface ProjectUpdate {
  date: string;
  body_en: string;
  progress_pct: number | null;
}

export interface Project {
  id: string;
  mofa_ref: string;
  title_en: string;
  title_ne: string;
  description_en: string;
  sector_code: string;
  flow_type: FlowType;
  status: Status;
  progress_pct: number;
  implementing_partner: string;
  start_date: string;
  end_date: string;
  agreement_date: string;
  source: string;
  links: { label: string; url: string }[];
  is_sample: boolean;
  funding: Funding[];
  locations: ProjectLocation[];
  transactions: Transaction[];
  updates: ProjectUpdate[];
}

export interface Dataset {
  source: "seed" | "supabase";
  generated_at: string;
  partners: Partner[];
  sectors: Sector[];
  projects: Project[];
  /** NPR per USD by year (approximate) */
  fx: Record<string, number>;
}

export type Level = "national" | "province" | "district" | "palika";

export interface Area {
  code: string;
  level: Exclude<Level, "national">;
  parent: string | null;
  name_en: string;
  name_ne: string;
  short: string;
  kind: "province" | "district" | "palika" | "protected_area" | "special_region";
  aliases?: string[];
  bbox: [number, number, number, number];
  label: [number, number];
}
