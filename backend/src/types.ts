export interface CRMRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE' | '';
  crm_note: string;
  data_source: 'leads_on_demand' | 'meridian_tower' | 'eden_park' | 'varah_swamy' | 'sarjapur_plots' | '';
  possession_time: string;
  description: string;
}

export interface SkippedRecord {
  record: Record<string, any>;
  reason: string;
}

export interface ImportResponse {
  success: boolean;
  imported: CRMRecord[];
  skipped: SkippedRecord[];
  stats: {
    total: number;
    imported: number;
    skipped: number;
  };
}
