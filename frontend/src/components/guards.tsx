import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/Auth';

const Spinner = () => <div className="grid min-h-[40vh] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-peach border-t-primary" role="status" aria-label="Loading" /></div>;

/** UX guard only. The API enforces access itself – never rely on this for security. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user, loading, isAdmin } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!isAdmin) {
    return (
      <div className="container-x py-20 text-center">
        <ShieldAlert size={52} className="mx-auto text-primary" />
        <h1 className="mt-3 text-3xl font-semibold">You don't have access to this page</h1>
        <p className="mt-2 text-choco-soft">This area is for Pawzora administrators only.</p>
        <Link to="/" className="btn mt-6">Back home</Link>
      </div>
    );
  }
  return <Outlet />;
}
