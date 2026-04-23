import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_OWNER = [
  { to: "/dashboard", label: "Home", icon: "🏡" },
  { to: "/jobs", label: "Jobs", icon: "📋" },
  { to: "/zones", label: "Zones", icon: "📍" },
  { to: "/workers", label: "Workers", icon: "👷" },
  { to: "/payments", label: "Pay", icon: "💵" },
];

const NAV_WORKER = [
  { to: "/dashboard", label: "Home", icon: "🏡" },
  { to: "/jobs", label: "My Jobs", icon: "📋" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = user?.role === "OWNER" ? NAV_OWNER : NAV_WORKER;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <span className="text-sm font-bold">BT</span>
            </div>
            <div>
              <div className="text-sm font-semibold">BraimTracker</div>
              <div className="text-xs text-slate-500">
                {user?.name} · {user?.role === "OWNER" ? "Owner" : "Worker"}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-4 pb-24 md:pb-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden">
        <div className="mx-auto grid max-w-4xl" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/dashboard"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2 text-xs ${
                  isActive ? "text-brand-700" : "text-slate-500"
                }`
              }
            >
              <span className="text-lg leading-none">{n.icon}</span>
              <span className="mt-1">{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <nav className="hidden border-t border-slate-200 bg-white md:block">
        <div className="mx-auto flex max-w-4xl gap-1 px-4 py-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/dashboard"}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {n.icon} {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
