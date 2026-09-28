import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { db, reset } from './db.js';
import { signToken, verifyPassword, verifyToken, type TokenClaims } from './auth.js';
import type { Transaction } from './types.js';

export const MAX_AMOUNT = 100_000;
const PHONE_RE = /^[6-9]\d{9}$/;

// ---- validation schemas ------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createTxnSchema = z.object({
  agentId: z.number().int().positive(),
  amount: z.number().positive().max(MAX_AMOUNT),
  phone: z.string().regex(PHONE_RE, 'phone must be a 10-digit Indian mobile number'),
  type: z.enum(['deposit', 'withdrawal', 'payment']),
});

const listQuerySchema = z.object({
  status: z.enum(['success', 'pending', 'failed']).optional(),
  agentId: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(['createdAt', 'amount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ---- helpers -----------------------------------------------------------------

function authenticate(req: FastifyRequest, reply: FastifyReply): TokenClaims | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'missing or malformed Authorization header' });
    return null;
  }
  const claims = verifyToken(header.slice('Bearer '.length));
  if (!claims) {
    reply.code(401).send({ error: 'invalid or expired token' });
    return null;
  }
  return claims;
}

/** operators may only see their own agent's data; admins see everything */
function canSeeAgent(claims: TokenClaims, agentId: number): boolean {
  return claims.role === 'admin' || claims.agentId === agentId;
}

// ---- app ---------------------------------------------------------------------

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));

  // Test-only: reseed the store to its deterministic baseline. Guarded by an
  // env flag so it can never be reached in a normal/production run. This is how
  // the end-to-end suite gets a clean, known state before each test.
  if (process.env.AGENTPAY_TEST_RESET === '1') {
    app.post('/__test/reset', async (_req, reply) => {
      reset();
      return reply.send({ ok: true });
    });
  }

  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid request body', details: parsed.error.flatten() });
    }
    const user = db.users.find((u) => u.email === parsed.data.email);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: 'invalid email or password' });
    }
    const token = signToken(user);
    return reply.send({ token, user: { id: user.id, name: user.name, role: user.role, agentId: user.agentId } });
  });

  app.get('/agents', async (req, reply) => {
    const claims = authenticate(req, reply);
    if (!claims) return;
    const agents = claims.role === 'admin' ? db.agents : db.agents.filter((a) => a.id === claims.agentId);
    return reply.send({ data: agents });
  });

  app.get('/agents/:id', async (req, reply) => {
    const claims = authenticate(req, reply);
    if (!claims) return;
    const id = Number((req.params as { id: string }).id);
    const agent = db.agents.find((a) => a.id === id);
    if (!agent) return reply.code(404).send({ error: 'agent not found' });
    if (!canSeeAgent(claims, agent.id)) return reply.code(403).send({ error: 'not allowed to view this agent' });
    return reply.send(agent);
  });

  app.get('/transactions', async (req, reply) => {
    const claims = authenticate(req, reply);
    if (!claims) return;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid query parameters', details: parsed.error.flatten() });
    }
    const q = parsed.data;

    let rows = db.transactions.slice();
    if (claims.role !== 'admin') rows = rows.filter((t) => t.agentId === claims.agentId);
    if (q.status) rows = rows.filter((t) => t.status === q.status);
    if (q.agentId) rows = rows.filter((t) => t.agentId === q.agentId);
    if (q.from) rows = rows.filter((t) => t.createdAt >= q.from!);
    if (q.to) rows = rows.filter((t) => t.createdAt <= q.to!);

    rows.sort((a, b) => {
      const cmp = q.sort === 'amount' ? a.amount - b.amount : a.createdAt.localeCompare(b.createdAt);
      return q.order === 'asc' ? cmp : -cmp;
    });

    const total = rows.length;
    const start = (q.page - 1) * q.limit;
    const data = rows.slice(start, start + q.limit);
    return reply.send({ data, page: q.page, limit: q.limit, total });
  });

  app.get('/transactions/:id', async (req, reply) => {
    const claims = authenticate(req, reply);
    if (!claims) return;
    const id = Number((req.params as { id: string }).id);
    const txn = db.transactions.find((t) => t.id === id);
    if (!txn) return reply.code(404).send({ error: 'transaction not found' });
    if (!canSeeAgent(claims, txn.agentId)) {
      return reply.code(403).send({ error: 'not allowed to view this transaction' });
    }
    return reply.send(txn);
  });

  app.post('/transactions', async (req, reply) => {
    const claims = authenticate(req, reply);
    if (!claims) return;
    const parsed = createTxnSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: 'invalid transaction', details: parsed.error.flatten() });
    }
    const body = parsed.data;
    if (!canSeeAgent(claims, body.agentId)) {
      return reply.code(403).send({ error: 'not allowed to create a transaction for this agent' });
    }
    const agent = db.agents.find((a) => a.id === body.agentId);
    if (!agent) return reply.code(422).send({ error: 'unknown agentId' });
    if (agent.status !== 'active') return reply.code(409).send({ error: 'agent is suspended' });

    // Idempotency: the same key returns the same transaction, so a retried
    // request never creates a duplicate. This is the money-flow safety net.
    const key = (req.headers['idempotency-key'] as string | undefined) ?? null;
    if (key) {
      const existing = db.transactions.find((t) => t.idempotencyKey === key);
      if (existing) return reply.code(200).send(existing);
    }

    const txn: Transaction = {
      id: db.nextTxnId++,
      agentId: body.agentId,
      amount: body.amount,
      phone: body.phone,
      type: body.type,
      status: 'success',
      createdAt: new Date().toISOString(),
      idempotencyKey: key,
    };
    db.transactions.push(txn);
    return reply.code(201).send(txn);
  });

  app.get('/dashboard/summary', async (req, reply) => {
    const claims = authenticate(req, reply);
    if (!claims) return;
    let rows = db.transactions.slice();
    if (claims.role !== 'admin') rows = rows.filter((t) => t.agentId === claims.agentId);
    const byStatus = { success: 0, pending: 0, failed: 0 };
    let totalAmount = 0;
    for (const t of rows) {
      byStatus[t.status] += 1;
      if (t.status === 'success') totalAmount += t.amount;
    }
    return reply.send({ count: rows.length, byStatus, totalSuccessfulAmount: totalAmount });
  });

  return app;
}
