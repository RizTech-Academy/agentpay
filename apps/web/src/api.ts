const TOKEN_KEY = 'agentpay.token';
const USER_KEY = 'agentpay.user';

export interface User {
  id: number;
  name: string;
  role: 'operator' | 'admin';
  agentId: number | null;
}

export interface Transaction {
  id: number;
  agentId: number;
  amount: number;
  phone: string;
  type: string;
  status: 'success' | 'pending' | 'failed';
  createdAt: string;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<User> {
  const { token, user } = await request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setSession(token, user);
  return user;
}

export interface TxnQuery {
  status?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

export interface TxnPage {
  data: Transaction[];
  page: number;
  limit: number;
  total: number;
}

export function listTransactions(q: TxnQuery): Promise<TxnPage> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
  return request<TxnPage>(`/transactions?${params.toString()}`);
}

export function createTransaction(input: {
  agentId: number;
  amount: number;
  phone: string;
  type: string;
}): Promise<Transaction> {
  return request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(input) });
}

export interface Summary {
  count: number;
  byStatus: { success: number; pending: number; failed: number };
  totalSuccessfulAmount: number;
}

export function getSummary(): Promise<Summary> {
  return request<Summary>('/dashboard/summary');
}
