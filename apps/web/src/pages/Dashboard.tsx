import { useEffect, useState } from 'react';
import { getSummary, type Summary } from '../api.ts';

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'failed to load'));
  }, []);

  return (
    <section>
      <h1>Dashboard</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {summary && (
        <div className="cards">
          <div className="card">
            <span className="label">Total transactions</span>
            <span className="value" data-testid="card-count">{summary.count}</span>
          </div>
          <div className="card">
            <span className="label">Successful</span>
            <span className="value" data-testid="card-success">{summary.byStatus.success}</span>
          </div>
          <div className="card">
            <span className="label">Pending</span>
            <span className="value" data-testid="card-pending">{summary.byStatus.pending}</span>
          </div>
          <div className="card">
            <span className="label">Failed</span>
            <span className="value" data-testid="card-failed">{summary.byStatus.failed}</span>
          </div>
          <div className="card">
            <span className="label">Value settled (₹)</span>
            <span className="value" data-testid="card-amount">{summary.totalSuccessfulAmount}</span>
          </div>
        </div>
      )}
    </section>
  );
}
