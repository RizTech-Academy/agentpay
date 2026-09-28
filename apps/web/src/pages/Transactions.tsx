import { useEffect, useState } from 'react';
import { listTransactions, type Transaction } from '../api.ts';

const PAGE_SIZE = 10;

export default function Transactions() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listTransactions({ status, sort, order, page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.total);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'failed to load'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status, sort, order, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <h1>Transactions</h1>

      <div className="controls">
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="createdAt">Date</option>
            <option value="amount">Amount</option>
          </select>
        </label>
        <label>
          Order
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      {error && <p role="alert" className="error">{error}</p>}

      <table>
        <caption>Showing {rows.length} of {total} transactions</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Agent</th>
            <th scope="col">Amount (₹)</th>
            <th scope="col">Phone</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading ? (
            <tr>
              <td colSpan={7}>No transactions match these filters.</td>
            </tr>
          ) : (
            rows.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.agentId}</td>
                <td>{t.amount}</td>
                <td>{t.phone}</td>
                <td>{t.type}</td>
                <td>{t.status}</td>
                <td>{new Date(t.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="pagination">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          Previous
        </button>
        <span data-testid="page-indicator">
          Page {page} of {pages}
        </span>
        <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>
          Next
        </button>
      </div>
    </section>
  );
}
