import { Outlet } from 'react-router-dom';
import { useAuth } from '../api/AuthContext';
import LoginCard from '../components/LoginCard';
import { Loading } from '../components/States';

export default function ProtectedRoute() {
  const { admin, loading } = useAuth();

  if (loading) return <Loading label="Checking session…" />;
  if (!admin) return <LoginCard />;
  return <Outlet />;
}
