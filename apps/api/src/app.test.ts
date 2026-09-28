import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { reset } from './db.js';

let app: FastifyInstance;

async function login(email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
  return res;
}

async function tokenFor(email: string, password: string) {
  const res = await login(email, password);
  return res.json().token as string;
}

beforeEach(() => {
  reset();
  app = buildApp();
});

describe('auth', () => {
  it('logs in a valid user and returns a token', async () => {
    const res = await login('admin@agentpay.test', 'admin123');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTypeOf('string');
    expect(body.user).toMatchObject({ role: 'admin', agentId: null });
  });

  it('rejects a wrong password with 401', async () => {
    const res = await login('admin@agentpay.test', 'wrong');
    expect(res.statusCode).toBe(401);
  });

  it('rejects a malformed body with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'not-an-email' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('auth guard', () => {
  it('rejects a request with no token (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request with an invalid token (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions', headers: { authorization: 'Bearer nonsense' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('transactions list', () => {
  it('paginates: total is stable, page size respected', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'GET', url: '/transactions?limit=10&page=1', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(60);
    expect(body.data).toHaveLength(10);
  });

  it('does not drop or duplicate rows across pages', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const seen = new Set<number>();
    for (let page = 1; page <= 6; page++) {
      const res = await app.inject({ method: 'GET', url: `/transactions?limit=10&page=${page}`, headers: { authorization: `Bearer ${token}` } });
      for (const t of res.json().data) seen.add(t.id);
    }
    expect(seen.size).toBe(60); // every row seen exactly once
  });

  it('filters by status, returning only matching rows', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'GET', url: '/transactions?status=failed&limit=100', headers: { authorization: `Bearer ${token}` } });
    const data = res.json().data;
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((t: { status: string }) => t.status === 'failed')).toBe(true);
  });

  it('sorts by amount ascending, numerically not alphabetically', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'GET', url: '/transactions?sort=amount&order=asc&limit=100', headers: { authorization: `Bearer ${token}` } });
    const amounts = res.json().data.map((t: { amount: number }) => t.amount);
    const sorted = [...amounts].sort((a, b) => a - b);
    expect(amounts).toEqual(sorted);
  });

  it('rejects an invalid query parameter with 400', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'GET', url: '/transactions?status=bogus', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(400);
  });

  it('scopes an operator to their own agent only', async () => {
    const token = await tokenFor('asha@agentpay.test', 'operator123'); // agentId 1
    const res = await app.inject({ method: 'GET', url: '/transactions?limit=100', headers: { authorization: `Bearer ${token}` } });
    const data = res.json().data;
    expect(data.every((t: { agentId: number }) => t.agentId === 1)).toBe(true);
  });
});

describe('transaction access control', () => {
  it('returns 404 for a missing transaction', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'GET', url: '/transactions/99999', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
  });

  it('forbids an operator from reading another agent\'s transaction by id (403), not 404', async () => {
    const adminToken = await tokenFor('admin@agentpay.test', 'admin123');
    // find a transaction that does NOT belong to agent 1
    const all = (await app.inject({ method: 'GET', url: '/transactions?limit=100', headers: { authorization: `Bearer ${adminToken}` } })).json().data;
    const other = all.find((t: { agentId: number }) => t.agentId !== 1);
    const operatorToken = await tokenFor('asha@agentpay.test', 'operator123'); // agent 1
    const res = await app.inject({ method: 'GET', url: `/transactions/${other.id}`, headers: { authorization: `Bearer ${operatorToken}` } });
    expect(res.statusCode).toBe(403);
  });
});

describe('create transaction', () => {
  const good = { agentId: 1, amount: 500, phone: '9876543210', type: 'payment' as const };

  it('creates a transaction and returns 201 with the record', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'POST', url: '/transactions', headers: { authorization: `Bearer ${token}` }, payload: good });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ agentId: 1, amount: 500, status: 'success' });
  });

  it('rejects a non-positive amount with 422', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'POST', url: '/transactions', headers: { authorization: `Bearer ${token}` }, payload: { ...good, amount: 0 } });
    expect(res.statusCode).toBe(422);
  });

  it('rejects an amount over the limit with 422', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'POST', url: '/transactions', headers: { authorization: `Bearer ${token}` }, payload: { ...good, amount: 100001 } });
    expect(res.statusCode).toBe(422);
  });

  it('rejects a badly formatted phone with 422', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'POST', url: '/transactions', headers: { authorization: `Bearer ${token}` }, payload: { ...good, phone: '12345' } });
    expect(res.statusCode).toBe(422);
  });

  it('is idempotent: the same Idempotency-Key never creates a duplicate', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const headers = { authorization: `Bearer ${token}`, 'idempotency-key': 'abc-123' };
    const first = await app.inject({ method: 'POST', url: '/transactions', headers, payload: good });
    const second = await app.inject({ method: 'POST', url: '/transactions', headers, payload: good });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id); // same record, not a new one
  });

  it('forbids an operator creating a transaction for another agent (403)', async () => {
    const token = await tokenFor('asha@agentpay.test', 'operator123'); // agent 1
    const res = await app.inject({ method: 'POST', url: '/transactions', headers: { authorization: `Bearer ${token}` }, payload: { ...good, agentId: 2 } });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a transaction for a suspended agent with 409', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'POST', url: '/transactions', headers: { authorization: `Bearer ${token}` }, payload: { ...good, agentId: 4 } }); // agent 4 suspended
    expect(res.statusCode).toBe(409);
  });
});

describe('dashboard summary', () => {
  it('returns counts that add up to the total', async () => {
    const token = await tokenFor('admin@agentpay.test', 'admin123');
    const res = await app.inject({ method: 'GET', url: '/dashboard/summary', headers: { authorization: `Bearer ${token}` } });
    const body = res.json();
    const { success, pending, failed } = body.byStatus;
    expect(success + pending + failed).toBe(body.count);
    expect(body.count).toBe(60);
  });
});
