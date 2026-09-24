import { BarChart3, House, LogOut, Megaphone, Settings2, Star, UsersRound } from 'lucide-react';

export type AppScreen = 'today' | 'customers' | 'campaigns' | 'reviews' | 'results' | 'settings';

const destinations = [
  { screen: 'today', label: 'Today', icon: House },
  { screen: 'customers', label: 'Customers', icon: UsersRound },
  { screen: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { screen: 'reviews', label: 'Reviews', icon: Star },
  { screen: 'results', label: 'Results', icon: BarChart3 },
  { screen: 'settings', label: 'Settings', icon: Settings2 },
] as const satisfies readonly { screen: AppScreen; label: string; icon: typeof House }[];

export function AppNav({
  active,
  businessName,
  isDemo,
  onNavigate,
  onSignOut,
  signOutPending,
}: {
  active: AppScreen;
  businessName: string;
  isDemo: boolean;
  onNavigate: (screen: AppScreen) => void;
  onSignOut: () => void;
  signOutPending: boolean;
}) {
  return (
    <div className="app-nav-shell">
      <span className="workspace-backdrop-dots" aria-hidden="true" />
      <span className="workspace-backdrop-curve" aria-hidden="true" />
      <div className="app-identity" aria-label={`${businessName} workspace`}>
        <span>Growth OS</span>
        <strong>{businessName}</strong>
        {isDemo ? <em>Demo workspace</em> : null}
      </div>
      <nav className="app-nav" aria-label="Workspace">
        {destinations.map((destination) => (
          <button
            type="button"
            key={destination.screen}
            className="app-nav-link"
            aria-current={active === destination.screen ? 'page' : undefined}
            onClick={() => onNavigate(destination.screen)}
          >
            <destination.icon aria-hidden="true" size={21} strokeWidth={2} />
            {destination.label}
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="app-nav-signout"
        onClick={onSignOut}
        disabled={signOutPending}
      >
        <LogOut aria-hidden="true" size={20} strokeWidth={2} />
        {signOutPending ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
