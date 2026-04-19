import { useState } from 'react';
import { BrainCircuit, X, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useAuth } from '../../hooks/useAuth';

export default function LoginModal() {
  const { loginModalOpen, loginModalMessage, closeLoginModal, runPendingExport } = useAuthStore();
  const { signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loginModalOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true);
      setError(null);
      await signInWithGoogle();
      // After successful login, run the pending export action (if any)
      runPendingExport();
      closeLoginModal();
    } catch (err: any) {
      setError('Sign-in failed. Please try again.');
      console.error(err);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="login-modal-backdrop" onClick={closeLoginModal}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button className="login-modal-close" onClick={closeLoginModal} aria-label="Close">
          <X size={18} />
        </button>

        {/* Logo */}
        <div className="login-modal-logo">
          <div className="login-modal-logo-icon">
            <BrainCircuit size={28} />
          </div>
          <span className="login-modal-logo-text">ArchViz</span>
        </div>

        {/* Heading */}
        <h2 className="login-modal-title">Sign in to ArchViz</h2>
        <p className="login-modal-subtitle">{loginModalMessage}</p>

        {/* Error */}
        {error && (
          <div className="login-modal-error">{error}</div>
        )}

        {/* Google Button */}
        <button
          className="login-google-btn"
          onClick={handleGoogleSignIn}
          disabled={signingIn}
        >
          {signingIn ? (
            <Loader2 size={18} className="spin" />
          ) : (
            <GoogleIcon />
          )}
          {signingIn ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p className="login-modal-terms">
          By signing in, you agree to our Terms of Service and Privacy Policy.
          Your designs are saved securely to your account.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4813h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087C16.6582 14.2509 17.64 11.9455 17.64 9.2045z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1818l-2.9087-2.2582c-.8064.54-1.8382.8591-3.0477.8591-2.3427 0-4.3282-1.5818-5.0359-3.7091H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
      <path d="M3.9641 10.71c-.18-.54-.2827-1.1164-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z" fill="#FBBC05"/>
      <path d="M9 3.5791c1.3214 0 2.5077.4545 3.4405 1.3459l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6573 3.5791 9 3.5791z" fill="#EA4335"/>
    </svg>
  );
}
