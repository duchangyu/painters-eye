import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AuthStateContext, type AuthState, type AuthStatus } from "./authState";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  string | undefined;

interface AuthProviderProps {
  readonly children: ReactNode;
}

const CLERK_LOAD_TIMEOUT_MS = 10_000;

function ClerkAuthBridge({ children }: AuthProviderProps) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => setTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  const getSessionToken = useCallback(() => getToken(), [getToken]);
  const signOutUser = useCallback(() => signOut(), [signOut]);

  const value = useMemo<AuthState>(() => {
    let status: AuthStatus;
    let error: string | null = null;
    if (!isLoaded && !timedOut) {
      status = "loading";
    } else if (!isLoaded && timedOut) {
      status = "unavailable";
      error =
        "认证服务加载超时，云端功能暂时不可用。请检查网络或稍后重试，本地使用不受影响。";
    } else if (isSignedIn) {
      status = "signedIn";
    } else {
      status = "signedOut";
    }
    return {
      status,
      email:
        status === "signedIn"
          ? (user?.primaryEmailAddress?.emailAddress ?? null)
          : null,
      error,
      getToken: getSessionToken,
      signOut: signOutUser,
    };
  }, [isLoaded, isSignedIn, timedOut, user, getSessionToken, signOutUser]);

  return (
    <AuthStateContext.Provider value={value}>
      {children}
    </AuthStateContext.Provider>
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  if (!publishableKey) {
    // Cloud features disabled: the app stays fully local and AuthStateContext
    // keeps its default 'unavailable' value.
    return <>{children}</>;
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}
