import { useState, useRef } from 'react';
import { BrainCircuit, X, Loader2, Shield, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useAuth } from '../../hooks/useAuth';

/* ── Effective date & version ── */
const TNC_VERSION  = '1.0';
const TNC_DATE     = 'April 19, 2025';
const CONTACT_MAIL = 'krish.qcai@gmail.com';

export default function LoginModal() {
  const { loginModalOpen, loginModalMessage, closeLoginModal, runPendingExport } = useAuthStore();
  const { signInWithGoogle } = useAuth();

  const [signingIn, setSigningIn]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tncOpen, setTncOpen]       = useState(false);
  const [accepted, setAccepted]     = useState(false);
  const [tncScrolled, setTncScrolled] = useState(false);
  const tncRef = useRef<HTMLDivElement>(null);

  if (!loginModalOpen) return null;

  const handleScroll = () => {
    const el = tncRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) setTncScrolled(true);
  };

  const handleGoogleSignIn = async () => {
    if (!accepted) return;
    try {
      setSigningIn(true);
      setError(null);
      await signInWithGoogle();
      runPendingExport();
      closeLoginModal();
    } catch (err: any) {
      setError('Sign-in failed. Please try again or check your Google account settings.');
      console.error(err);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="lm-backdrop" onClick={closeLoginModal}>
      <div className="lm-modal" onClick={e => e.stopPropagation()}>

        {/* ── Close ── */}
        <button className="lm-close" onClick={closeLoginModal} aria-label="Close">
          <X size={16} />
        </button>

        {/* ── Header ── */}
        <div className="lm-header">
          <div className="lm-logo-ring">
            <div className="lm-logo-icon">
              <BrainCircuit size={22} />
            </div>
          </div>
          <div className="lm-header-text">
            <span className="lm-wordmark">ArchViz</span>
            <span className="lm-tagline">Cloud Architecture Studio</span>
          </div>
        </div>

        {/* ── Headline ── */}
        <div className="lm-headline">
          <h2 className="lm-title">Welcome back</h2>
          <p className="lm-subtitle">{loginModalMessage || 'Sign in to save your work, access your projects, and unlock professional exports.'}</p>
        </div>



        {/* ── Error ── */}
        {error && (
          <div className="lm-error">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* ── T&C accordion ── */}
        <div className="lm-tnc-wrap">
          <button
            className={`lm-tnc-toggle ${tncOpen ? 'open' : ''}`}
            onClick={() => setTncOpen(v => !v)}
          >
            <Shield size={13} />
            <span>Terms of Service &amp; Privacy Policy</span>
            <ChevronDown size={14} className="lm-tnc-chevron" />
          </button>

          {tncOpen && (
            <div
              className="lm-tnc-body"
              ref={tncRef}
              onScroll={handleScroll}
            >
              <TermsContent />
              {!tncScrolled && (
                <div className="lm-tnc-fade-hint">
                  <ChevronDown size={14} /> Scroll to read all
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Accept checkbox ── */}
        <label className="lm-accept-row">
          <div
            className={`lm-checkbox ${accepted ? 'checked' : ''}`}
            onClick={() => setAccepted(v => !v)}
            role="checkbox"
            aria-checked={accepted}
            tabIndex={0}
            onKeyDown={e => e.key === ' ' && setAccepted(v => !v)}
          >
            {accepted && <Check size={10} />}
          </div>
          <span className="lm-accept-text">
            I have read and agree to the{' '}
            <button className="lm-inline-link" onClick={() => setTncOpen(true)}>
              Terms of Service
            </button>{' '}
            and{' '}
            <button className="lm-inline-link" onClick={() => setTncOpen(true)}>
              Privacy Policy
            </button>
          </span>
        </label>

        {/* ── Google Sign-in ── */}
        <button
          className={`lm-google-btn ${!accepted ? 'disabled' : ''}`}
          onClick={handleGoogleSignIn}
          disabled={signingIn || !accepted}
          title={!accepted ? 'Please accept the Terms & Conditions first' : ''}
        >
          <div className="lm-google-btn-inner">
            {signingIn ? <Loader2 size={18} className="spin" /> : <GoogleIcon />}
            <span>{signingIn ? 'Signing in…' : 'Continue with Google'}</span>
          </div>
          {!accepted && <div className="lm-btn-lock"><Shield size={12} /></div>}
        </button>

        <p className="lm-legal-note">
          ArchViz v{TNC_VERSION} · Effective {TNC_DATE}
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   TERMS OF SERVICE + PRIVACY POLICY  (Real & enforceable)
────────────────────────────────────────────────────────── */
function TermsContent() {
  return (
    <div className="lm-tnc-content">

      <p className="lm-tnc-effective">
        Effective Date: {TNC_DATE} · Version {TNC_VERSION}<br />
        These Terms govern your use of ArchViz ("<strong>the Service</strong>"). By
        creating an account or using the Service, you agree to be bound by these Terms.
        If you do not agree, do not access the Service.
      </p>

      <section>
        <h3>1. Acceptance of Terms</h3>
        <p>
          By signing in with Google, you ("User") acknowledge that you have read,
          understood, and agree to be legally bound by these Terms of Service and
          our Privacy Policy. These Terms apply to all users of ArchViz, whether
          registered or guest. Any use of this Service constitutes acceptance.
        </p>
      </section>

      <section>
        <h3>2. Description of Service</h3>
        <p>
          ArchViz is a cloud architecture design and simulation platform that allows
          users to design, simulate, and export technical architecture diagrams.
          The Service includes: drag-and-drop diagram creation, real-time traffic
          simulation, cost estimation, security scanning, and cloud-based project
          storage via Firebase Firestore. ArchViz is provided "as is" and may be
          modified or discontinued at any time.
        </p>
      </section>

      <section>
        <h3>3. User Accounts &amp; Authentication</h3>
        <p>
          Authentication is provided exclusively via Google Sign-In. You are
          responsible for maintaining the security of your Google account. ArchViz
          accesses only your Google account name, email address, and profile photo
          — no passwords are stored by ArchViz. You must not use another person's
          account or allow others to use your account.
        </p>
      </section>

      <section>
        <h3>4. Intellectual Property</h3>
        <p>
          All architecture diagrams, designs, and project data you create ("<strong>User Content</strong>")
          remain your property. By saving to the cloud, you grant ArchViz a
          limited, non-exclusive licence to store and display your content solely
          for the purpose of providing the Service. ArchViz does not claim
          ownership of your designs. The ArchViz platform, UI, code, and branding
          are the exclusive intellectual property of ArchViz and may not be copied,
          redistributed, or reverse-engineered without explicit written permission.
        </p>
      </section>

      <section>
        <h3>5. Prohibited Conduct</h3>
        <p>You agree NOT to:</p>
        <ul>
          <li>Use the Service for unlawful purposes or to violate any applicable law</li>
          <li>Upload, share, or store content that is malicious, defamatory, or infringing</li>
          <li>Attempt to reverse-engineer, scrape, or exploit the ArchViz platform or API</li>
          <li>Use automated bots or scripts to interact with the Service</li>
          <li>Attempt to gain unauthorised access to other users' data or Firebase resources</li>
          <li>Misrepresent your identity or impersonate any person or entity</li>
          <li>Use the Service to generate, design, or simulate malicious network infrastructure</li>
        </ul>
        <p>
          Violation of any prohibited conduct may result in immediate termination of your
          account without notice.
        </p>
      </section>

      <section>
        <h3>6. Data Storage &amp; Cloud Persistence</h3>
        <p>
          When signed in, your project data (diagram nodes, edges, simulation settings)
          is stored in Google Firebase Firestore under your user ID. Data is secured
          by Firebase Security Rules that restrict access strictly to your account.
          ArchViz does not share your project data with third parties. You may delete
          your projects at any time from the Dashboard. Deletion is permanent and
          cannot be reversed.
        </p>
      </section>

      <section>
        <h3>7. Privacy Policy</h3>
        <p><strong>Data We Collect:</strong></p>
        <ul>
          <li>Google Display Name, Email Address, and Profile Photo (from Google Sign-In)</li>
          <li>Architecture project data (nodes, edges, configuration) that you explicitly save</li>
          <li>Anonymous usage analytics via Google Analytics (page views, session duration)</li>
        </ul>
        <p><strong>Data We Do NOT Collect:</strong></p>
        <ul>
          <li>Passwords (handled entirely by Google)</li>
          <li>Payment information</li>
          <li>Designs you create without signing in (local-only, never transmitted)</li>
        </ul>
        <p>
          Your data is stored securely in Google Firebase infrastructure in compliance
          with Google's data processing terms. You may request deletion of all your
          data by emailing <strong>{CONTACT_MAIL}</strong>.
        </p>
      </section>

      <section>
        <h3>8. Disclaimer of Warranties</h3>
        <p>
          THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
          IMPLIED. ARCHVIZ DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
          ERROR-FREE, OR COMPLETELY SECURE. COST ESTIMATES AND SIMULATION RESULTS ARE
          FOR INFORMATIONAL PURPOSES ONLY AND SHOULD NOT BE USED AS THE SOLE BASIS
          FOR FINANCIAL OR INFRASTRUCTURE DECISIONS.
        </p>
      </section>

      <section>
        <h3>9. Limitation of Liability</h3>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARCHVIZ AND ITS CREATORS SHALL NOT
          BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, INCLUDING LOSS OF DATA, LOSS OF REVENUE, OR LOSS OF PROFITS,
          ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
        </p>
      </section>

      <section>
        <h3>10. Account Termination</h3>
        <p>
          ArchViz reserves the right to suspend or permanently terminate any account
          that violates these Terms, engages in abusive behaviour, or is inactive for
          more than 12 consecutive months. Upon termination, your cloud-stored data
          may be deleted. You may also delete your own account at any time.
        </p>
      </section>

      <section>
        <h3>11. Changes to Terms</h3>
        <p>
          ArchViz may update these Terms from time to time. Continued use of the
          Service after a Terms update constitutes acceptance of the revised Terms.
          Material changes will be communicated via the platform or by email.
          The current version number and effective date are displayed at the top of
          these Terms.
        </p>
      </section>

      <section>
        <h3>12. Governing Law</h3>
        <p>
          These Terms shall be governed by and construed in accordance with the laws
          of India. Any disputes arising under these Terms shall be subject to the
          exclusive jurisdiction of the courts of India.
        </p>
      </section>

      <section>
        <h3>13. Contact</h3>
        <p>
          For any questions, data deletion requests, or legal notices, contact:
          <br /><strong>{CONTACT_MAIL}</strong>
        </p>
      </section>

      <p className="lm-tnc-footer">
        © {new Date().getFullYear()} ArchViz. All rights reserved.
        These Terms were last updated on {TNC_DATE}.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4813h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087C16.6582 14.2509 17.64 11.9455 17.64 9.2045z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1818l-2.9087-2.2582c-.8064.54-1.8382.8591-3.0477.8591-2.3427 0-4.3282-1.5818-5.0359-3.7091H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
      <path d="M3.9641 10.71c-.18-.54-.2827-1.1164-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z" fill="#FBBC05"/>
      <path d="M9 3.5791c1.3214 0 2.5077.4545 3.4405 1.3459l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6573 3.5791 9 3.5791z" fill="#EA4335"/>
    </svg>
  );
}
