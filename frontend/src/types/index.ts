export type Severity = "low" | "medium" | "high" | "critical";

export interface Account {
  id: number;
  session_id: string;
  account_number: string;
  account_holder: string;
  balance: number; // paise
  created_at: string;
  is_active: boolean;
}

export interface Transaction {
  id: number;
  session_id: string;
  transaction_id: string;
  source_account_id: number;
  destination_account_id: number;
  amount: number; // paise
  transaction_type: string;
  timestamp: string;
  description?: string | null;
  is_fraudulent: boolean;
}

export interface SessionInfo {
  id: string;
  accounts_count: number;
  transactions_count: number;
  investigations_count: number;
}

export interface Finding {
  id: number;
  session_id: string;
  investigation_id?: number | null;
  finding_type: string;
  severity: Severity;
  description: string;
  transaction_id?: number | null;
  evidence?: Record<string, unknown> | null;
  detected_at: string;
}

export interface GraphAccount {
  id: string;
  name: string;
  balance: number;
  is_active: boolean;
  transaction_count: number;
}

export interface GraphTransaction {
  id: string;
  source: string;
  destination: string;
  amount: number;
  timestamp: string;
  type: string;
  description?: string | null;
}

export interface GraphData {
  accounts: GraphAccount[];
  transactions: GraphTransaction[];
  adjacency_list: Record<string, string[]>;
  stats: {
    account_count: number;
    transaction_count: number;
    is_connected: boolean;
    component_count: number;
  };
}

export interface DFSResult {
  start_account: string;
  traversal_order: string[];
  visited: string[];
  adjacency_list: Record<string, string[]>;
  time_complexity: string;
  space_complexity: string;
}

export interface Investigation {
  id: number;
  session_id: string;
  start_account_id: number;
  start_time: string;
  end_time?: string | null;
  dfs_traversal?: {
    start_account: string;
    traversal_order: string[];
    visited: string[];
    adjacency_list: Record<string, string[]>;
    time_complexity: string;
    space_complexity: string;
  } | null;
  suspicious_patterns?: {
    total_findings: number;
    findings_by_type: Record<string, number>;
    findings_by_severity: Record<string, number>;
  } | null;
  report_generated: boolean;
}

export interface InvestigationAnalysis {
  investigation_id: number;
  findings_summary: {
    total_findings: number;
    findings_by_type: Record<string, number>;
    findings_by_severity: Record<string, number>;
  };
  findings: Finding[];
  analysis_completed_at: string;
}

export interface Report {
  investigation_id: number;
  session_id: string;
  generated_at: string;
  start_time: string | null;
  end_time: string | null;
  start_account: {
    id: number;
    account_number: string;
    account_holder: string;
    balance: number;
  };
  dfs_results: {
    traversal_order: string[];
    visited_accounts: string[];
    time_complexity: string;
    space_complexity: string;
  };
  findings_summary: {
    total_findings: number;
    findings_by_type: Record<string, number>;
    findings_by_severity: Record<string, number>;
  };
  findings: Array<{
    id: number;
    type: string;
    severity: Severity;
    description: string;
    evidence: Record<string, unknown> | null;
  }>;
}
