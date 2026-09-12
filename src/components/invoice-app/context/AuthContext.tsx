"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthChange } from "../firebase/auth";
import { getUserProfile, isMasterAdmin, ALL_COMPANIES } from "../firebase/users";

// Local replacement for firebase/auth User type (fake local auth in firebase/auth.js)
export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  companies: string[];
  role: string;
  permissions?: Record<string, number>;
}

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  allowedCompanies: string[];
  perms: Record<string, number>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ROLE_DEFAULTS: Record<string, Record<string, number>> = {
  admin:    { create_invoice:1,print_invoice:1,view_customers:1,bulk_input:1,edit_invoice:1,delete_invoice:1,edit_customer:1,delete_customer:1,export_data:1,reports_access:1,settings_access:1,finance_access:1,employee_management:1 },
  editor:   { create_invoice:1,print_invoice:1,view_customers:1,bulk_input:1,edit_invoice:1,delete_invoice:1,edit_customer:1,delete_customer:1,export_data:1,reports_access:0,settings_access:0,finance_access:0,employee_management:0 },
  employee: { create_invoice:1,print_invoice:1,view_customers:1,bulk_input:1,edit_invoice:1,delete_invoice:1,edit_customer:1,delete_customer:1,export_data:0,reports_access:0,settings_access:0,finance_access:0,employee_management:0 },
  viewer:   { create_invoice:0,print_invoice:0,view_customers:1,bulk_input:0,edit_invoice:0,delete_invoice:0,edit_customer:0,delete_customer:0,export_data:0,reports_access:0,settings_access:0,finance_access:0,employee_management:0 },
};

const LOCKED_PERMS = ["reports_access","settings_access","finance_access","employee_management"];

function resolvePerms(profile: UserProfile | null, isMaster: boolean): Record<string, number> {
  if (isMaster || profile?.role === "admin") return { ...ROLE_DEFAULTS.admin };
  const role = profile?.role || "viewer";
  const defaults = { ...(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.viewer) };
  if (role === "employee" && profile?.permissions) {
    const overrides = profile.permissions;
    Object.keys(overrides).forEach(k => {
      if (!LOCKED_PERMS.includes(k)) defaults[k] = overrides[k] ? 1 : 0;
    });
  }
  return defaults;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const doneRef = useRef(false);

  const done = () => {
    if (!doneRef.current) { doneRef.current = true; setLoading(false); }
  };

  useEffect(() => {
    const timeout = setTimeout(done, 8000);

    const unsub = onAuthChange(async (firebaseUser: User | null) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          if (isMasterAdmin(firebaseUser.email ?? "")) {
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? "",
              displayName: firebaseUser.displayName || "Ahmed Ezzat",
              companies: ALL_COMPANIES,
              role: "admin",
            });
          } else {
            const prof = await getUserProfile(firebaseUser.uid);
            setProfile(prof as import("./AuthContext").UserProfile | null);
          }
        } else {
          setUser(null);
          setProfile(null);
          doneRef.current = false; // reset so next login cycle works
        }
      } catch (err) {
        console.error("Auth profile load failed:", err);
        setUser(null);
        setProfile(null);
      } finally {
        done();
      }
    });

    return () => { clearTimeout(timeout); unsub(); };
  }, []);

  const isAdmin = profile?.role === "admin" || isMasterAdmin(user?.email || "");
  const perms   = resolvePerms(profile, isMasterAdmin(user?.email || ""));
  const canEdit = !!perms.edit_invoice;
  const allowedCompanies = profile?.companies || [];

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, canEdit, allowedCompanies, perms }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
