'use client';

import { useEffect, useId, useState, type FormEventHandler } from 'react';
import {
  ArrowRight,
  Leaf,
  PlayCircle,
  CalendarDays,
  MessageSquare,
  Clock3,
  CircleCheck,
  BarChart3,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { StatusLine, type Status } from './ui';

export type AuthMode = 'register' | 'sign-in' | 'request-reset' | 'complete-reset';

type AuthLandingProps = {
  mode: AuthMode;
  status: Status;
  onSubmitAuth: FormEventHandler<HTMLFormElement>;
  onSubmitResetRequest: FormEventHandler<HTMLFormElement>;
  onSubmitReset: FormEventHandler<HTMLFormElement>;
  onSwitchMode: () => void;
  onForgotPassword: () => void;
  onBackToSignIn: () => void;
  onCreateAccount: () => void;
};

function AuthInput({
  label,
  name,
  type = 'text',
  placeholder,
  autoComplete,
  icon: Icon,
}: {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  autoComplete?: string;
  icon: LucideIcon;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const inputId = useId();
  const isPassword = type === 'password';

  return (
    <div className="auth-field">
      <label className="auth-field-label" htmlFor={inputId}>
        {label}
      </label>
      <span className="auth-input-wrap">
        <Icon aria-hidden="true" className="auth-input-icon" size={21} strokeWidth={1.8} />
        <input
          id={inputId}
          name={name}
          type={isPassword && passwordVisible ? 'text' : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          minLength={isPassword && autoComplete === 'new-password' ? 12 : undefined}
          aria-describedby={
            isPassword && autoComplete === 'new-password' ? `${inputId}-hint` : undefined
          }
        />
        {isPassword && (
          <button
            className="auth-password-toggle"
            type="button"
            aria-label={passwordVisible ? 'Hide entered value' : 'Show entered value'}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((current) => !current)}
          >
            {passwordVisible ? <Eye size={21} /> : <EyeOff size={21} />}
          </button>
        )}
      </span>
      {isPassword && autoComplete === 'new-password' && (
        <small id={`${inputId}-hint`} className="growth-password-hint">
          Use at least 12 characters.
        </small>
      )}
    </div>
  );
}

const benefits = [
  {
    icon: Zap,
    title: 'Faster responses',
    description: (
      <>
        Convert interest
        <br />
        while it&apos;s hot.
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Consent-aware follow-ups',
    description: (
      <>
        Stay compliant
        <br />
        and build trust.
      </>
    ),
  },
  {
    icon: BarChart3,
    title: 'Track every outcome',
    description: (
      <>
        See what&apos;s working
        <br />
        and keep momentum.
      </>
    ),
  },
];

const metrics = [
  { icon: UsersRound, value: '1.2k+', description: 'enquiries managed', illustrative: true },
  { icon: BarChart3, value: '94%', description: 'follow-up rate', illustrative: true },
  {
    icon: ShieldCheck,
    value: 'Trusted workflow',
    description: 'Built for growing businesses',
    illustrative: false,
  },
];

export function AuthLanding({
  mode,
  status,
  onSubmitAuth,
  onSubmitResetRequest,
  onSubmitReset,
  onSwitchMode,
  onForgotPassword,
  onBackToSignIn,
  onCreateAccount,
}: AuthLandingProps) {
  const isRegister = mode === 'register';
  const isSignIn = mode === 'sign-in';
  const pending = status.kind === 'pending';
  function focusRegistration() {
    onCreateAccount();
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('.auth-card input')?.focus(),
    );
  }
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          if (performance.now() > 2500) entry.target.classList.add('after-intro');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    document
      .querySelectorAll('.growth-analytics, .auth-benefits, .auth-metrics')
      .forEach((element) => {
        element.classList.add('growth-reveal');
        observer.observe(element);
      });
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <main className="auth-shell growth-landing">
      <svg
        className="growth-paths"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path d="M740 480 C1000 280 980 670 1260 320 S1480 30 1640 -60" />
        <path d="M680 760 C1000 830 1100 620 1660 390" />
      </svg>
      <header className="growth-nav">
        <a href="/" className="growth-logo" aria-label="GrowthOS home">
          <Leaf aria-hidden="true" />
          <span>
            Growth<span>OS</span>
          </span>
        </a>
      </header>
      <div className="auth-background-orbit" aria-hidden="true" />
      <div className="auth-background-glow" aria-hidden="true" />
      <div className="auth-background-dots" aria-hidden="true" />
      <img
        className="auth-background-leaves"
        src="/assets/plates/leaves.png"
        alt=""
        aria-hidden="true"
      />

      <div className="auth-left">
        <section className="auth-context" aria-label="Why Growth OS">
          <div className="auth-kicker">
            <span />
            Lead follow-up, simplified
          </div>
          <h1>
            <span>Turn enquiries into</span>
            <span className="auth-headline-emphasis">booked appointments.</span>
          </h1>
          <svg
            className="auth-underline"
            viewBox="0 0 812 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="auth-underline-gradient" x1="0" x2="1">
                <stop offset="0" stopColor="#3b8b77" />
                <stop offset="0.55" stopColor="#6cdca7" />
                <stop offset="1" stopColor="#02d56b" />
              </linearGradient>
            </defs>
            <path
              d="M 8 31 C 188 4, 633 -3, 803 34"
              fill="none"
              stroke="url(#auth-underline-gradient)"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
          <p className="auth-description">
            Capture the original context, respect contact permission,
            <br className="auth-desktop-break" />
            and keep recorded outcomes connected to the work —<br className="auth-desktop-break" />
            so nothing falls through the cracks.
          </p>
        </section>
        <div className="growth-hero-actions">
          <button type="button" className="auth-submit" onClick={focusRegistration}>
            Create your free account <ArrowRight size={22} />
          </button>
          <a className="growth-secondary" href="#growth-pipeline">
            <PlayCircle size={30} /> Explore the workflow
          </a>
        </div>
        <div className="auth-details" id="growth-features">
          <div className="auth-benefits" aria-label="Benefits">
            {benefits.map(({ icon: Icon, title, description }) => (
              <div className="auth-benefit" key={title}>
                <span className="auth-icon-circle">
                  <Icon size={31} strokeWidth={2.2} aria-hidden="true" />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="auth-card" aria-labelledby="auth-card-heading">
        <h2 id="auth-card-heading">
          {isRegister
            ? 'Create your account'
            : isSignIn
              ? 'Sign in to Today.'
              : mode === 'request-reset'
                ? 'Reset your password.'
                : 'Choose a new password.'}
        </h2>
        <p className="auth-card-description">
          {isRegister
            ? 'Get started in minutes. No credit card required.'
            : isSignIn
              ? 'Pick up where your team left off.'
              : mode === 'request-reset'
                ? 'Enter your account email to request a reset link.'
                : 'Use at least 12 characters. This link works once.'}
        </p>
        {isRegister && (
          <div className="growth-stepper" aria-label="Account setup: step 1 of 3">
            <span aria-current="step">
              <b>1</b>Account details
            </span>
            <span>
              <b>2</b>Business info
            </span>
            <span>
              <b>3</b>You’re in!
            </span>
          </div>
        )}

        {mode === 'request-reset' ? (
          <form className="auth-form" onSubmit={onSubmitResetRequest}>
            <AuthInput label="Email" name="email" type="email" autoComplete="email" icon={Mail} />
            <button className="auth-submit" disabled={pending}>
              {pending ? 'Preparing…' : 'Send reset instructions'}{' '}
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </form>
        ) : mode === 'complete-reset' ? (
          <form className="auth-form" onSubmit={onSubmitReset}>
            <AuthInput
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              icon={LockKeyhole}
            />
            <AuthInput
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              icon={LockKeyhole}
            />
            <button className="auth-submit" disabled={pending}>
              {pending ? 'Updating…' : 'Update password'}{' '}
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={onSubmitAuth}>
            {isRegister && (
              <AuthInput
                label="Business name"
                name="businessName"
                placeholder="Your business name"
                autoComplete="organization"
                icon={Building2}
              />
            )}
            <AuthInput
              label="Email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              icon={Mail}
            />
            <AuthInput
              label="Password"
              name="password"
              type="password"
              placeholder="••••••••••••••••••"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              icon={LockKeyhole}
            />
            <button className="auth-submit" disabled={pending}>
              {pending
                ? isRegister
                  ? 'Creating account…'
                  : 'Signing in…'
                : isRegister
                  ? 'Create account'
                  : 'Sign in'}{' '}
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </form>
        )}

        <div className="auth-card-footer">
          {isRegister || isSignIn ? (
            <p>
              {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
              <button
                type="button"
                className="auth-inline-link"
                aria-label={
                  isRegister ? 'Already have an account? Sign in.' : 'Need an account? Register.'
                }
                onClick={onSwitchMode}
              >
                {isRegister ? 'Sign in.' : 'Register.'}
              </button>
            </p>
          ) : (
            <button type="button" className="auth-inline-link" onClick={onBackToSignIn}>
              Back to sign in
            </button>
          )}
          {isSignIn && (
            <button type="button" className="auth-forgot-link" onClick={onForgotPassword}>
              Forgot password?
            </button>
          )}
        </div>
        <div className="growth-form-status">
          <StatusLine status={status} />
        </div>
        <p className="growth-security">
          <LockKeyhole size={17} aria-hidden="true" /> Your workspace, securely connected.
        </p>
      </section>
      <aside className="growth-analytics" aria-label="Illustrative analytics">
        <section className="growth-bookings">
          <div className="growth-card-label">
            Bookings this month <span className="auth-demo-badge">Demo</span>
          </div>
          <strong className="growth-big-number">
            287 <small>↑ 32%</small>
          </strong>
          <p>Booked appointments</p>
          <div className="growth-chart" aria-label="Sample monthly bookings from March to August">
            {[92, 120, 151, 180, 228, 287].map((value, index) => (
              <div className="growth-chart-column" key={value}>
                <button
                  type="button"
                  style={{ height: `${value / 3}px`, animationDelay: `${1150 + index * 40}ms` }}
                  aria-label={`${['March', 'April', 'May', 'June', 'July', 'August'][index]}: ${value} sample bookings`}
                >
                  <span>{value}</span>
                </button>
                <small>{['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'][index]}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="growth-pipeline" id="growth-pipeline">
          <div className="growth-card-label">
            Your pipeline <span className="auth-demo-badge">Sample</span>
          </div>
          {[
            { icon: MessageSquare, label: 'New enquiries', value: '1,245' },
            { icon: Clock3, label: 'In follow-up', value: '892' },
            { icon: CalendarDays, label: 'Appointments booked', value: '287' },
            { icon: CircleCheck, label: 'Closed won', value: '176' },
          ].map(({ icon: Icon, label, value }) => (
            <div className="growth-stage" key={label}>
              <span>
                <Icon size={22} />
              </span>
              <p>{label}</p>
              <strong>{value}</strong>
            </div>
          ))}
        </section>
      </aside>
      <div className="auth-metrics" aria-label="Growth OS at a glance">
        {metrics.map(({ icon: Icon, value, description, illustrative }) => (
          <div className="auth-metric" key={value}>
            <span className="auth-icon-circle">
              <Icon size={30} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <div>
              <strong>
                {value}
                {illustrative && <span className="auth-demo-badge">Demo</span>}
              </strong>
              <p>{description}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
