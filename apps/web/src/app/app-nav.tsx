export type AppScreen = 'today' | 'customers' | 'campaigns' | 'reviews' | 'results' | 'settings';

const destinations: readonly { screen: AppScreen; label: string }[] = [
  { screen: 'today', label: 'Today' },
  { screen: 'customers', label: 'Customers' },
  { screen: 'campaigns', label: 'Campaigns' },
  { screen: 'reviews', label: 'Reviews' },
  { screen: 'results', label: 'Results' },
  { screen: 'settings', label: 'Settings' },
];

export function AppNav({
  active,
  businessName,
  onNavigate,
  onSignOut,
  signOutPending,
}: {
  active: AppScreen;
  businessName: string;
  onNavigate: (screen: AppScreen) => void;
  onSignOut: () => void;
  signOutPending: boolean;
}) {
  return (
    <div className="app-nav-shell">
      <div className="app-identity" aria-label={`${businessName} workspace`}>
        <span>Growth OS</span>
        <strong>{businessName}</strong>
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
        {signOutPending ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
