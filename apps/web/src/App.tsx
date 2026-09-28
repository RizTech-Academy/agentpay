import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { clearSession, getUser } from './api.ts';

export default function App() {
  const navigate = useNavigate();
  const user = getUser();

  if (!user) return <Navigate to="/login" replace />;

  function logout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">AgentPay Console</span>
        <nav aria-label="Main">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/transactions/new">New transaction</NavLink>
        </nav>
        <div className="user">
          <span data-testid="current-user">
            {user.name} ({user.role})
          </span>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
