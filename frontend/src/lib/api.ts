import type {
  Account,
  DFSResult,
  Finding,
  GraphData,
  Investigation,
  InvestigationAnalysis,
  Report,
  SessionInfo,
  Transaction,
} from "@/types";

/**
 * Empty string means "same origin": the Next.js server proxies /api/* to the
 * FastAPI backend (see next.config.ts), which keeps the session cookie
 * first-party in production. Unset means local development against Uvicorn.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL === undefined
    ? "http://localhost:8000"
    : process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function performFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

/**
 * The first visitor request races the session bootstrap: a page mounted
 * directly at /accounts asks for data before the HttpOnly cookie exists.
 * Any 401 therefore triggers exactly one shared bootstrap and a retry, so
 * deep links work without duplicating workspaces.
 */
let bootstrapPromise: Promise<SessionInfo> | null = null;

async function bootstrapOnce(): Promise<SessionInfo> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapSession().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await performFetch(path, init);

  if (response.status === 401 && !path.startsWith("/api/sessions/bootstrap")) {
    try {
      await bootstrapOnce();
      response = await performFetch(path, init);
    } catch {
      // Keep the original 401 so the caller sees the real problem.
    }
  }

  if (!response.ok) {
    let detail = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body?.detail)) {
        detail = body.detail
          .map((item: { msg?: string }) => item?.msg ?? "Invalid value")
          .join(", ");
      }
    } catch {
      /* keep the default message */
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */
export const getSessionInfo = () => get<SessionInfo>("/api/sessions/me");
export const bootstrapSession = () => post<SessionInfo>("/api/sessions/bootstrap");
export const resetDataset = () => post<SessionInfo>("/api/sessions/reset");
export const deleteWorkspace = () => del<{ message: string }>("/api/sessions/");

/**
 * Return the visitor's workspace, creating one only if the cookie is missing
 * or expired. This keeps a reload from wiping the demo data.
 */
export async function ensureSession(): Promise<SessionInfo> {
  try {
    return await getSessionInfo();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return bootstrapSession();
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */
export const listAccounts = (q?: string) => {
  const params = new URLSearchParams({ limit: "200" });
  if (q) params.set("q", q);
  return get<Account[]>(`/api/accounts/?${params.toString()}`);
};

export const createAccount = (body: {
  account_number: string;
  account_holder: string;
  balance: number;
}) => post<Account>("/api/accounts/", body);

export const deleteAccount = (id: number) => del<{ message: string }>(`/api/accounts/${id}`);

export const getAccountNeighbors = (id: number) =>
  get<{ account: Account; neighbors: string[] }>(`/api/accounts/${id}/neighbors`);

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */
export const listTransactions = (q?: string) => {
  const params = new URLSearchParams({ limit: "500" });
  if (q) params.set("q", q);
  return get<Transaction[]>(`/api/transactions/?${params.toString()}`);
};

export const createTransaction = (body: {
  source_account_id: number;
  destination_account_id: number;
  amount: number;
  transaction_type?: string;
  description?: string;
}) => post<Transaction>("/api/transactions/", body);

export const deleteTransaction = (id: number) =>
  del<{ message: string }>(`/api/transactions/${id}`);

/* ------------------------------------------------------------------ */
/* Graph / DFS / detection                                             */
/* ------------------------------------------------------------------ */
export const getGraph = () => get<GraphData>("/api/graph/");
export const runDfs = (accountNumber: string) =>
  post<DFSResult>(`/api/graph/dfs/${encodeURIComponent(accountNumber)}`);
export const getComponents = () => get<string[][]>("/api/graph/components");
export const getCycles = () => get<string[][]>("/api/graph/cycles");
export const getDetectionSummary = () =>
  get<{ total: number; by_severity: Record<string, number>; by_type: Record<string, number> }>(
    "/api/detection/summary",
  );

export const analyzeTransactions = (startAccountId?: number) => {
  const params = new URLSearchParams();
  if (startAccountId) params.set("start_account_id", String(startAccountId));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return post<Finding[]>(`/api/detection/analyze${suffix}`);
};

/* ------------------------------------------------------------------ */
/* Investigations                                                      */
/* ------------------------------------------------------------------ */
export const listInvestigations = () => get<Investigation[]>("/api/investigations/");
export const createInvestigation = (startAccountId: number) =>
  post<Investigation>("/api/investigations/", { start_account_id: startAccountId });
export const runInvestigationDfs = (id: number) =>
  post<DFSResult>(`/api/investigations/${id}/run-dfs`);
export const analyzeInvestigation = (id: number, startAccountId?: number) => {
  const params = new URLSearchParams();
  if (startAccountId) params.set("start_account_id", String(startAccountId));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return post<InvestigationAnalysis>(`/api/investigations/${id}/analyze${suffix}`);
};
export const getInvestigationFindings = (id: number) =>
  get<Finding[]>(`/api/investigations/${id}/findings`);
export const getInvestigationReport = (id: number) =>
  get<Report>(`/api/investigations/${id}/report`);
export const deleteInvestigation = (id: number) =>
  del<{ message: string }>(`/api/investigations/${id}`);
