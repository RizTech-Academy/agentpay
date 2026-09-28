export type Role = 'operator' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  /** operators are scoped to a single agent; admins see everything */
  agentId: number | null;
}

export interface Agent {
  id: number;
  name: string;
  phone: string;
  region: string;
  status: 'active' | 'suspended';
}

export type TxnType = 'deposit' | 'withdrawal' | 'payment';
export type TxnStatus = 'success' | 'pending' | 'failed';

export interface Transaction {
  id: number;
  agentId: number;
  amount: number;
  phone: string;
  type: TxnType;
  status: TxnStatus;
  createdAt: string; // ISO
  idempotencyKey: string | null;
}
