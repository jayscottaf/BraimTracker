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

function HouseLogo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M3 10.75 12 3l9 7.75" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
      </svg>
    </div>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = user?.role === "OWNER" ? NAV_OWNER : NAV_WORKER;
  const roleLabel = user?.role === "OWNER" ? "Owner" : `${user?.name} · Worker`;

  return (
    <div className="flex min-h-full md:flex-row flex-col">
      {/* Desktop sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-col md:border-r md:border-slate-200 md:bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <HouseLogo />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">BraimTracker</div>
            <div className="truncate text-xs text-slate-500">{roleLabel}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/dashboard"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <span className="text-lg leading-none">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={logout}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Right column (mobile + desktop) */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header — hidden on desktop because the sidebar carries the brand and sign out */}
        <header className="pt-safe sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur md:hidden">
          <div className="px-safe mx-auto flex max-w-6xl items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <HouseLogo />
              <div>
                <div className="text-sm font-semibold">BraimTracker</div>
                <div className="text-xs text-slate-500">{roleLabel}</div>
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

        <main className="px-safe mx-auto w-full max-w-6xl flex-1 py-5 pb-24 md:px-8 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav — unchanged, still md:hidden */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto grid w-full max-w-6xl" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
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
      </div>
    </div>
  );
}
