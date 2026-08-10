import { createContext, useContext } from "react";

export type AuthStatus = "unavailable" | "loading" | "signedOut" | "signedIn";

export interface AuthState {
  readonly status: AuthStatus;
  readonly email: string | null;
  readonly error: string | null;
  readonly getToken: () => Promise<string | null>;
  readonly signOut: () => Promise<void>;
}

const unavailableAuthState: AuthState = {
  status: "unavailable",
  email: null,
  error: null,
  getToken: () => Promise.resolve(null),
  signOut: () => Promise.resolve(),
};

export const AuthStateContext = createContext<AuthState>(unavailableAuthState);

export function useAuthState(): AuthState {
  return useContext(AuthStateContext);
}
