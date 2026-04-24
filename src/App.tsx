import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import JobsList from "./pages/JobsList";
import JobDetail from "./pages/JobDetail";
import JobNew from "./pages/JobNew";
import ZonesList from "./pages/ZonesList";
import ZoneEdit from "./pages/ZoneEdit";
import Workers from "./pages/Workers";
import WorkerDetail from "./pages/WorkerDetail";
import Payments from "./pages/Payments";
import AppShell from "./components/AppShell";

function RequireAuth({ children, owner }: { children: JSX.Element; owner?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (owner && user.role !== "OWNER") return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="jobs" element={<JobsList />} />
        <Route
          path="jobs/new"
          element={
            <RequireAuth owner>
              <JobNew />
            </RequireAuth>
          }
        />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route
          path="zones"
          element={
            <RequireAuth owner>
              <ZonesList />
            </RequireAuth>
          }
        />
        <Route
          path="zones/:id"
          element={
            <RequireAuth owner>
              <ZoneEdit />
            </RequireAuth>
          }
        />
        <Route
          path="workers"
          element={
            <RequireAuth owner>
              <Workers />
            </RequireAuth>
          }
        />
        <Route
          path="workers/:id"
          element={
            <RequireAuth owner>
              <WorkerDetail />
            </RequireAuth>
          }
        />
        <Route
          path="payments"
          element={
            <RequireAuth owner>
              <Payments />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
