import { useState, type FormEvent } from 'react';
import { createTransaction, getUser, type Transaction } from '../api.ts';

export default function NewTransaction() {
  const user = getUser();
  const [agentId, setAgentId] = useState(user?.agentId ? String(user.agentId) : '1');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('payment');
  const [created, setCreated] = useState<Transaction | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCreated(null);
    setBusy(true);
    try {
      const txn = await createTransaction({ agentId: Number(agentId), amount: Number(amount), phone, type });
      setCreated(txn);
      setAmount('');
      setPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not create transaction');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-page">
      <h1>New transaction</h1>
      <form onSubmit={onSubmit}>
        <label>
          Agent ID
          <input name="agentId" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
        </label>
        <label>
          Amount (₹)
          <input name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          Phone
          <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Type
          <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="payment">Payment</option>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
          </select>
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        {created && (
          <p role="status" className="success">
            Created transaction #{created.id} for ₹{created.amount}.
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create transaction'}
        </button>
      </form>
    </section>
  );
}
