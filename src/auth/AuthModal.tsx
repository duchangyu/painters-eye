import { SignIn, SignUp } from "@clerk/clerk-react";
import { useEffect, useState } from "react";

export type AuthModalView = "sign-in" | "sign-up";

interface AuthModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Which Clerk flow to show first. Defaults to sign-in. */
  initialView?: AuthModalView;
  /** Called when the user dismisses the modal (close button or backdrop). */
  onClose: () => void;
  /** Optional heading shown above the Clerk component. */
  title?: string;
}

const DEFAULT_TITLES: Record<AuthModalView, string> = {
  "sign-in": "登录以使用云端保存",
  "sign-up": "创建账户",
};

/**
 * Modal wrapper around Clerk's <SignIn /> and <SignUp /> components.
 *
 * Usage is props-driven: render <AuthModal isOpen={...} onClose={...} /> from
 * the component that owns the open state (e.g. a "Save to cloud" button).
 * Styling hooks live in global.css under `.auth-modal*`.
 */
export function AuthModal({
  isOpen,
  initialView = "sign-in",
  onClose,
  title,
}: AuthModalProps) {
  const [view, setView] = useState<AuthModalView>(initialView);

  // Reset to the requested view each time the modal is opened (adjust state
  // during render instead of an effect to avoid cascading renders).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setView(initialView);
    }
  }

  // Close on Escape for accessibility.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const heading = title ?? DEFAULT_TITLES[view];

  return (
    <div
      className="auth-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <div className="auth-modal-header">
          <h2>{heading}</h2>
          <button
            type="button"
            className="auth-modal-close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="auth-modal-body">
          {view === "sign-in" ? (
            <SignIn routing="virtual" />
          ) : (
            <SignUp routing="virtual" />
          )}
        </div>
        <div className="auth-modal-footer">
          {view === "sign-in" ? (
            <button type="button" onClick={() => setView("sign-up")}>
              没有账户？注册
            </button>
          ) : (
            <button type="button" onClick={() => setView("sign-in")}>
              已有账户？登录
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
