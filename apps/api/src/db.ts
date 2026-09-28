import { hashPassword } from './auth.js';
import type { Agent, Transaction, User } from './types.js';

/**
 * In-memory data store. The whole point of AgentPay is to be a stable, fast
 * system under test, so it keeps its data in memory and reseeds deterministically
 * on every boot (and in tests, whenever reset() is called). No database to install.
 */
export const db = {
  users: [] as User[],
  agents: [] as Agent[],
  transactions: [] as Transaction[],
  nextTxnId: 1,
};

const REGIONS = ['Pune', 'Nagpur', 'Nashik', 'Mumbai'];
const STATUSES = ['success', 'pending', 'failed'] as const;
const TYPES = ['deposit', 'withdrawal', 'payment'] as const;

export function reset(): void {
  db.users = [
    { id: 1, name: 'Admin User', email: 'admin@agentpay.test', passwordHash: hashPassword('admin123'), role: 'admin', agentId: null },
    { id: 2, name: 'Asha Operator', email: 'asha@agentpay.test', passwordHash: hashPassword('operator123'), role: 'operator', agentId: 1 },
    { id: 3, name: 'Ravi Operator', email: 'ravi@agentpay.test', passwordHash: hashPassword('operator123'), role: 'operator', agentId: 2 },
  ];

  db.agents = [
    { id: 1, name: 'Sai Kirana', phone: '9876500001', region: 'Pune', status: 'active' },
    { id: 2, name: 'Ganesh Stores', phone: '9876500002', region: 'Nagpur', status: 'active' },
    { id: 3, name: 'Laxmi Traders', phone: '9876500003', region: 'Nashik', status: 'active' },
    { id: 4, name: 'Krishna Mart', phone: '9876500004', region: 'Mumbai', status: 'suspended' },
  ];

  // A deterministic spread of transactions: enough rows to make filtering,
  // sorting and pagination meaningful, produced from a fixed formula so every
  // boot and every test run sees exactly the same data.
  db.transactions = [];
  db.nextTxnId = 1;
  let seed = 42;
  const rand = () => {
    // simple deterministic LCG so the seed data never changes between runs
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const base = Date.parse('2026-01-01T08:00:00.000Z');
  for (let i = 0; i < 60; i++) {
    const agentId = 1 + Math.floor(rand() * db.agents.length);
    const amount = 50 + Math.floor(rand() * 40) * 25; // 50..1025 in steps
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];
    const type = TYPES[Math.floor(rand() * TYPES.length)];
    const phone = '98765' + String(10000 + Math.floor(rand() * 89999));
    const createdAt = new Date(base + i * 3600_000 + Math.floor(rand() * 1800_000)).toISOString();
    db.transactions.push({ id: db.nextTxnId++, agentId, amount, phone, type, status, createdAt, idempotencyKey: null });
  }
}

reset();
