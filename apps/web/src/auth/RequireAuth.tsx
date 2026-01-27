import React from "react";
import { Navigate } from "react-router-dom";
import { getSession } from "./auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
