import type { ReactNode } from "react";

// Marker wrapper for explicitly-public routes. No-op today; reserved for
// future global behaviors (e.g., redirecting authenticated users away from
// /login). Keep as a wrapper so consumers can opt in by replacement.
export const PublicRoute = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};
