import React from 'react';

interface RouteProps {
  children: React.ReactNode;
}

export function Router({ children }: RouteProps): React.ReactElement {
  return <>{children}</>;
}