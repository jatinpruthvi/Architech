"use client";
/* Sign in / create account – phone-based with WhatsApp OTP.
 *
 * Flow:
 * - Signin: phone (India 10-digit) + password -> POST /api/auth/login/
 * - Register Step 1: name, phone, password, listerType -> POST /api/auth/otp/send/ (OTP via admin WhatsApp)
 * - Register Step 2: OTP 6-digit -> POST /api/auth/otp/verify/ (creates account) OR /api/auth/register/ with phone+otp
 *
 * Validation uses SAME module server runs (lib/auth/credentials + phone).
 * OTP is sent via system WhatsApp account that admin connects first via /api/admin/whatsapp/system/*
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowUpRight, Eye, EyeOff, Loader2, LockKeyhole, LogIn, ShieldCheck, Smartphone, UserPlus, MessageCircle, KeyRound } from "lucide-react";
import useTitle from "@/hooks/useTitle";
import { useSession } from "@/contexts/SessionContext";
import { landingPathForSession, resolvePostLoginPath, safeNextPath } from "@/lib/auth/redirects";
import {
  PASSWORD_MIN_LENGTH,
  validatePhoneSignIn,
  validatePhoneSignUp,
  validatePhone,
  validateOtp,
  validateResetPassword,
  validateResetRequest,
  type CredentialField,
  type CredentialIssue,
} from "@/lib/auth/credentials";
import { DEFAULT_LISTER_TYPE, LISTER_TYPE_OPTIONS, type ListerType } from "@/lib/listing/lister-type";
import type { AuthSession } from "@/lib/auth/roles";

type Mode = "signin" | "register" | "forgot";
type RegisterStep = "details" | "otp";
type ForgotStep = "phone" | "otp";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  issues?: CredentialIssue[];
  session?: AuthSession;
  redirectTo?: string;
  phoneE164?: string;
  phoneMasked?: string;
  expiresAt?: string;
};

const DEMO_HINTS = [
  { label: "Broker admin", email: "broker-admin@example.com", password: "demo-broker-1234", phone: "9876543210" },
  { label: "Buyer", email: "buyer@example.com", password: "demo-buyer-1234", phone: "9876543211" },
  { label: "Moderator", email: "moderator@example.com", password: "demo-moderator-1234", phone: "9876543212" },
];

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, session, adopt, registrationAvailable } = useSession();

  const requestedModeParam = searchParams.get("mode");
  const requestedMode: Mode = requestedModeParam === "register" ? "register" : requestedModeParam === "forgot" ? "forgot" : "signin";
  const next = safeNextPath(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>(requestedMode);
  const [registerStep, setRegisterStep] = useState<RegisterStep>("details");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("phone");
  const [name, setName] = useState("");
  const [listerType, setListerType] = useState<ListerType>(DEFAULT_LISTER_TYPE);
  const [phone, setPhone] = useState("");
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [issues, setIssues] = useState<CredentialIssue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useTitle(mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in");
  useEffect(() => setMode(requestedMode), [requestedMode]);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    router.replace(resolvePostLoginPath(session, next));
  }, [status, session, next, router]);

  // Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const issueFor = useMemo(() => {
    const map = new Map<CredentialField, string>();
    for (const issue of issues) if (!map.has(issue.field)) map.set(issue.field, issue.message);
    return map;
  }, [issues]);

  const focusFirstIssue = (found: CredentialIssue[]) => {
    const first = found[0]?.field;
    if (first === "name") nameRef.current?.focus();
    else if (first === "phone") phoneRef.current?.focus();
    else if (first === "otp") otpRef.current?.focus();
    else if (first === "password") passwordRef.current?.focus();
  };

  const switchMode = (nextMode: Mode, options: { keepPhone?: boolean; notice?: string } = {}) => {
    setMode(nextMode);
    setRegisterStep("details");
    setForgotStep("phone");
    setIssues([]);
    setFormError(null);
    setNotice(options.notice ?? null);
    setOtp("");
    setPhoneE164(null);
    setPhoneMasked(null);
    setOtpExpiresAt(null);
    setResendCountdown(0);
    setNewPassword("");
    setConfirmPassword("");
    if (!options.keepPhone) setPhone("");
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "signin") params.delete("mode");
    else params.set("mode", nextMode);
    const query = params.toString();
    router.replace(query ? `/login/?${query}` : "/login/", { scroll: false });
  };

  /* Step 1 of forgot-password: ask for the number, get a code on WhatsApp.
     The endpoint is deliberately non-committal about whether the number is
     registered, so this copy is too — promising "code sent" for a number we
     have no account for would be a lie the user can detect. */
  const handleSendResetOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const validated = validateResetRequest({ phone });
    if (!validated.ok) {
      setIssues(validated.issues);
      focusFirstIssue(validated.issues);
      return;
    }
    setIssues([]);
    setOtpSending(true);

    try {
      const response = await fetch("/api/auth/otp/forgot/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: validated.value.phoneE164 }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || !payload.ok) {
        const returned = payload.issues ?? [];
        setIssues(returned);
        setFormError(payload.message ?? "We could not send a reset code. Please try again.");
        if (returned.length > 0) focusFirstIssue(returned);
        return;
      }

      setPhoneE164(validated.value.phoneE164);
      setPhoneMasked(payload.phoneMasked ?? validated.value.phone);
      setOtpExpiresAt(payload.expiresAt ?? null);
      setForgotStep("otp");
      setResendCountdown(60);
      setOtp("");
      setTimeout(() => otpRef.current?.focus(), 100);
    } catch {
      setFormError("We could not reach the reset service. Check your connection and try again.");
    } finally {
      setOtpSending(false);
    }
  };

  /* Step 2: trade the verified code for a new password. No session comes back —
     recovering an account and being signed in to it are separate decisions, so
     the user is handed to sign-in with the number prefilled. */
  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const otpIssue = validateOtp(otp);
    if (otpIssue) {
      setIssues([otpIssue]);
      focusFirstIssue([otpIssue]);
      return;
    }

    const validated = validateResetPassword({ otp, password: newPassword });
    if (!validated.ok) {
      setIssues(validated.issues);
      focusFirstIssue(validated.issues);
      return;
    }

    /* Confirmation is a browser-side kindness, not a rule: the server takes one
       password, and checking the match here is what stops a typo from becoming
       a lockout that needs another reset. */
    if (newPassword !== confirmPassword) {
      setIssues([{ field: "password", message: "The two passwords do not match." }]);
      passwordRef.current?.focus();
      return;
    }

    setIssues([]);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/otp/reset/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164 ?? phone, otp: validated.value.otp, password: validated.value.password }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || !payload.ok) {
        const returned = payload.issues ?? [];
        setIssues(returned);
        setFormError(payload.message ?? "We could not reset your password. Please check the code and try again.");
        if (returned.length > 0) focusFirstIssue(returned);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setPassword("");
      switchMode("signin", { keepPhone: true, notice: "Your password has been updated. Sign in with your mobile number and new password." });
    } catch {
      setFormError("We could not reach the reset service. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resendCountdown > 0) return;
    setFormError(null);
    setOtpSending(true);
    try {
      const response = await fetch("/api/auth/otp/forgot/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164 ?? phone }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !payload.ok) {
        setFormError(payload.message ?? "Could not resend the code.");
        return;
      }
      setOtpExpiresAt(payload.expiresAt ?? null);
      setPhoneMasked(payload.phoneMasked ?? phoneMasked);
      setResendCountdown(60);
    } catch {
      setFormError("Could not resend the code.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const validated = validatePhoneSignIn({ phone, password });
    if (!validated.ok) {
      setIssues(validated.issues);
      focusFirstIssue(validated.issues);
      return;
    }
    setIssues([]);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: validated.value.phoneE164, password: validated.value.password, next }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || !payload.ok || !payload.session) {
        const returned = payload.issues ?? [];
        setIssues(returned);
        setFormError(payload.message ?? "We could not sign you in. Please try again.");
        if (returned.length > 0) focusFirstIssue(returned);
        return;
      }

      setPassword("");
      adopt(payload.session);
      const destination = payload.redirectTo ?? landingPathForSession(payload.session);
      router.replace(destination);
      router.refresh();
    } catch {
      setFormError("We could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const validated = validatePhoneSignUp({ name, phone, password, listerType });
    if (!validated.ok) {
      setIssues(validated.issues);
      focusFirstIssue(validated.issues);
      return;
    }
    setIssues([]);
    setOtpSending(true);

    try {
      const response = await fetch("/api/auth/otp/send/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validated.value, next }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || !payload.ok) {
        const returned = payload.issues ?? [];
        setIssues(returned);
        setFormError(payload.message ?? "We could not send OTP. Please try again.");
        if (returned.length > 0) focusFirstIssue(returned);
        return;
      }

      setPhoneE164(payload.phoneE164 ?? validated.value.phoneE164);
      setPhoneMasked(payload.phoneMasked ?? validated.value.phone);
      setOtpExpiresAt(payload.expiresAt ?? null);
      setRegisterStep("otp");
      setResendCountdown(60);
      setOtp("");
      setTimeout(() => otpRef.current?.focus(), 100);
    } catch {
      setFormError("We could not reach OTP service. Check connection and try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const otpIssue = validateOtp(otp);
    if (otpIssue) {
      setIssues([otpIssue]);
      focusFirstIssue([otpIssue]);
      return;
    }

    const validated = validatePhoneSignUp({ name, phone, password, listerType });
    if (!validated.ok) {
      setIssues(validated.issues);
      focusFirstIssue(validated.issues);
      setRegisterStep("details");
      return;
    }

    setIssues([]);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/otp/verify/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: validated.value.phoneE164, otp: otp.trim().replace(/\D/g, ""), name: validated.value.name, password: validated.value.password, listerType: validated.value.listerType, next }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || !payload.ok || !payload.session) {
        const returned = payload.issues ?? [];
        setIssues(returned);
        setFormError(payload.message ?? "We could not create your account. Please check the OTP and try again.");
        if (returned.length > 0) focusFirstIssue(returned);
        return;
      }

      setPassword("");
      setOtp("");
      adopt(payload.session);
      const destination = payload.redirectTo ?? landingPathForSession(payload.session);
      router.replace(destination);
      router.refresh();
    } catch {
      setFormError("We could not reach verification service. Check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setFormError(null);
    setOtpSending(true);
    try {
      const response = await fetch("/api/auth/otp/send/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password, listerType, next }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !payload.ok) {
        setFormError(payload.message ?? "Could not resend OTP.");
        return;
      }
      setOtpExpiresAt(payload.expiresAt ?? null);
      setResendCountdown(60);
      setFormError(null);
    } catch {
      setFormError("Could not resend OTP.");
    } finally {
      setOtpSending(false);
    }
  };

  const fieldClass = (field: CredentialField) =>
    `mt-2 w-full border bg-card px-4 py-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-[color:var(--ink-3,#6e6058)] focus:border-brick ${issueFor.has(field) ? "border-brick" : "border-ink/15"}`;

  const registering = mode === "register";
  const resetting = mode === "forgot";

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-12 md:py-16">
        <div className="container">
          <p className="kicker text-brick">{registering ? "Create your account" : resetting ? "Reset your password" : "Sign in"}</p>
          <h1 className="display mt-5 max-w-[720px] text-[clamp(34px,4.6vw,64px)]">
            {registering ? (
              <>
                Start a <em className="text-brick">shortlist</em> that follows you.
              </>
            ) : resetting ? (
              <>
                Back in, <em className="text-brick">one code</em> away.
              </>
            ) : (
              <>
                Welcome back to your <em className="text-brick">survey</em>.
              </>
            )}
          </h1>
          <p className="mt-5 max-w-[520px] text-[15px] leading-7 ink-2">
            {registering
              ? "Use your mobile number — we'll verify via WhatsApp OTP from our official number, then you can sign in with mobile + password."
              : resetting
                ? "Give us the mobile number on your account and we'll send a reset code over WhatsApp from our official number. No email needed."
                : "Sign in with your mobile number and password to reach your shortlist and partner workspace."}
          </p>
        </div>
      </section>

      <section className="container grid gap-10 py-12 md:py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-[520px]">
          <div className="flex border border-ink/15" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={!registering}
              onClick={() => switchMode("signin")}
              className={`flex-1 px-5 py-3.5 stamp font-semibold transition-colors ${!registering ? "bg-brick text-cream" : "bg-card ink-2 hover:text-brick"}`}
            >
              <span className="inline-flex items-center gap-2">
                <LogIn size={14} /> Sign in
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={registering}
              onClick={() => switchMode("register")}
              disabled={!registrationAvailable}
              title={registrationAvailable ? undefined : "Account creation disabled in preview."}
              className={`flex-1 border-l border-ink/15 px-5 py-3.5 stamp font-semibold transition-colors ${registering ? "bg-brick text-cream" : "bg-card ink-2 hover:text-brick"} ${registrationAvailable ? "" : "cursor-not-allowed opacity-55"}`}
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus size={14} /> Create account
              </span>
            </button>
          </div>

          {registering && !registrationAvailable && (
            <p role="status" className="mt-4 flex items-start gap-2 border border-ink/20 bg-card px-4 py-3 text-[13px] leading-6 ink-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-brick" aria-hidden="true" />
              <span>Account creation is disabled in this preview. Use demo sign-ins below.</span>
            </p>
          )}

          {/* Success from a completed reset. Sits above whichever form is open
              so it is not lost when the view switches back to sign-in. */}
          {notice && (
            <p role="status" className="mt-7 flex items-start gap-2 border border-trust/35 bg-trust/8 px-4 py-3 text-[13px] leading-6 text-ink">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-trust" aria-hidden="true" />
              <span>{notice}</span>
            </p>
          )}

          {/* SIGN IN FORM */}
          {!registering && !resetting && (
            <form onSubmit={handleSignIn} noValidate className={`${notice ? "mt-4" : "mt-7"} border border-ink/12 bg-card p-6 md:p-8`}>
              {formError && (
                <p role="alert" className="mb-6 flex items-start gap-2 border border-brick/35 bg-brick/8 px-4 py-3 text-[13px] leading-6 text-brick">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </p>
              )}

              <div className="mb-5">
                <label htmlFor="login-phone" className="stamp font-semibold ink-2 flex items-center gap-2">
                  <Smartphone size={14} /> Mobile number
                </label>
                <div className="mt-2 flex">
                  <span className="inline-flex items-center border border-r-0 border-ink/15 bg-sand/50 px-3 text-[15px] text-ink">+91</span>
                  <input
                    id="login-phone"
                    ref={phoneRef}
                    type="tel"
                    name="phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full border bg-card px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-[color:var(--ink-3)] focus:border-brick ${issueFor.has("phone") ? "border-brick" : "border-ink/15"}`}
                    placeholder="98765 43210"
                    aria-invalid={issueFor.has("phone") || undefined}
                    aria-describedby={issueFor.has("phone") ? "login-phone-error" : undefined}
                    disabled={submitting}
                  />
                </div>
                {issueFor.has("phone") && (
                  <p id="login-phone-error" role="alert" className="mt-2 text-[12px] text-brick">
                    {issueFor.get("phone")}
                  </p>
                )}
                <p className="mt-1 text-[11px] ink-3">10-digit Indian mobile, starting with 6-9</p>
              </div>

              <div className="mb-6">
                <label htmlFor="login-password" className="stamp font-semibold ink-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldClass("password")} pr-12`}
                    placeholder="Your password"
                    aria-invalid={issueFor.has("password") || undefined}
                    aria-describedby={issueFor.has("password") ? "login-password-error" : undefined}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((c) => !c)}
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center ink-3 hover:text-brick"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {issueFor.has("password") && (
                  <p id="login-password-error" role="alert" className="mt-2 text-[12px] text-brick">
                    {issueFor.get("password")}
                  </p>
                )}
              </div>

              <div className="mb-6 flex justify-end">
                <button type="button" onClick={() => switchMode("forgot")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brick underline underline-offset-4 hover:opacity-80">
                  <KeyRound size={14} /> Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="clay-fill btn-sweep btn-solid motion-press inline-flex w-full items-center justify-center gap-2 bg-brick px-7 py-4 stamp font-semibold text-cream"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowUpRight size={15} />
                  </>
                )}
              </button>

              <p className="mt-5 text-[13px] leading-6 ink-3">
                New to Architech?{" "}
                <button type="button" onClick={() => switchMode("register")} className="font-semibold text-brick underline underline-offset-4">
                  Create an account
                </button>
                .
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD – STEP 1: WHICH NUMBER */}
          {resetting && forgotStep === "phone" && (
            <form onSubmit={handleSendResetOtp} noValidate className="mt-7 border border-ink/12 bg-card p-6 md:p-8">
              <div className="mb-6 flex items-start gap-3 border border-ink/12 bg-sand/50 p-4">
                <KeyRound size={18} className="mt-0.5 shrink-0 text-brick" aria-hidden="true" />
                <p className="text-[13px] leading-6 ink-2">
                  Tell us the mobile number on your account. If it exists, a 6-digit reset code arrives over WhatsApp within a minute.
                </p>
              </div>

              {formError && (
                <p role="alert" className="mb-6 flex items-start gap-2 border border-brick/35 bg-brick/8 px-4 py-3 text-[13px] leading-6 text-brick">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </p>
              )}

              <div className="mb-6">
                <label htmlFor="forgot-phone" className="stamp font-semibold ink-2 flex items-center gap-2">
                  <Smartphone size={14} /> Mobile number
                </label>
                <div className="mt-2 flex">
                  <span className="inline-flex items-center border border-r-0 border-ink/15 bg-sand/50 px-3 text-[15px] text-ink">+91</span>
                  <input
                    id="forgot-phone"
                    ref={phoneRef}
                    type="tel"
                    name="phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full border bg-card px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-[color:var(--ink-3)] focus:border-brick ${issueFor.has("phone") ? "border-brick" : "border-ink/15"}`}
                    placeholder="98765 43210"
                    aria-invalid={issueFor.has("phone") || undefined}
                    aria-describedby={issueFor.has("phone") ? "forgot-phone-error" : undefined}
                    disabled={otpSending}
                  />
                </div>
                {issueFor.has("phone") && (
                  <p id="forgot-phone-error" role="alert" className="mt-2 text-[12px] text-brick">
                    {issueFor.get("phone")}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1 text-[11px] ink-3">
                  <MessageCircle size={12} /> The code comes from our official WhatsApp number
                </p>
              </div>

              <button type="submit" disabled={otpSending} className="clay-fill btn-sweep btn-solid motion-press inline-flex w-full items-center justify-center gap-2 bg-brick px-7 py-4 stamp font-semibold text-cream">
                {otpSending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Sending code…
                  </>
                ) : (
                  <>
                    Send reset code <ArrowUpRight size={15} />
                  </>
                )}
              </button>

              <p className="mt-5 text-[13px] ink-3">
                Remembered it?{" "}
                <button type="button" onClick={() => switchMode("signin", { keepPhone: true })} className="font-semibold text-brick underline underline-offset-4">
                  Back to sign in
                </button>
                .
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD – STEP 2: CODE + NEW PASSWORD */}
          {resetting && forgotStep === "otp" && (
            <form onSubmit={handleResetPassword} noValidate className="mt-7 border border-ink/12 bg-card p-6 md:p-8">
              <div className="mb-6 rounded border border-trust/20 bg-trust/5 p-4">
                <p className="flex items-center gap-2 text-[13px] font-medium">
                  <MessageCircle size={14} className="text-trust" /> Code sent to {phoneMasked ?? phone} via WhatsApp
                </p>
                <p className="mt-1 text-[12px] ink-3">Enter the 6-digit code and choose a new password. Valid for 5 minutes.</p>
                {otpExpiresAt && <p className="mt-1 text-[11px] ink-3">Expires: {new Date(otpExpiresAt).toLocaleTimeString()}</p>}
              </div>

              {formError && (
                <p role="alert" className="mb-6 flex items-start gap-2 border border-brick/35 bg-brick/8 px-4 py-3 text-[13px] leading-6 text-brick">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </p>
              )}

              <div className="mb-5">
                <label htmlFor="forgot-otp" className="stamp font-semibold ink-2">
                  6-digit code
                </label>
                <input
                  id="forgot-otp"
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`${fieldClass("otp")} tracking-[0.3em] text-center text-[20px] font-mono`}
                  placeholder="123456"
                  aria-invalid={issueFor.has("otp") || undefined}
                  aria-describedby={issueFor.has("otp") ? "forgot-otp-error" : undefined}
                  disabled={submitting}
                />
                {issueFor.has("otp") && (
                  <p id="forgot-otp-error" role="alert" className="mt-2 text-[12px] text-brick">
                    {issueFor.get("otp")}
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label htmlFor="forgot-new-password" className="stamp font-semibold ink-2">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="forgot-new-password"
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${fieldClass("password")} pr-12`}
                    placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                    aria-invalid={issueFor.has("password") || undefined}
                    aria-describedby={issueFor.has("password") ? "forgot-new-password-error" : undefined}
                    disabled={submitting}
                  />
                  <button type="button" onClick={() => setShowPassword((c) => !c)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center ink-3 hover:text-brick" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {issueFor.has("password") && (
                  <p id="forgot-new-password-error" role="alert" className="mt-2 text-[12px] text-brick">
                    {issueFor.get("password")}
                  </p>
                )}
              </div>

              <div className="mb-6">
                <label htmlFor="forgot-confirm-password" className="stamp font-semibold ink-2">
                  Confirm new password
                </label>
                <input
                  id="forgot-confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={fieldClass("password")}
                  placeholder="Type it once more"
                  disabled={submitting}
                />
              </div>

              <button type="submit" disabled={submitting} className="clay-fill btn-sweep btn-solid motion-press inline-flex w-full items-center justify-center gap-2 bg-brick px-7 py-4 stamp font-semibold text-cream">
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Updating password…
                  </>
                ) : (
                  <>
                    Set new password <ArrowUpRight size={15} />
                  </>
                )}
              </button>

              <div className="mt-5 flex items-center justify-between text-[13px]">
                <button type="button" onClick={() => { setForgotStep("phone"); setIssues([]); setFormError(null); setOtp(""); }} className="ink-3 underline underline-offset-4 hover:text-brick">
                  ← Change number
                </button>
                <button type="button" onClick={handleResendResetOtp} disabled={resendCountdown > 0 || otpSending} className="font-semibold text-brick underline underline-offset-4 disabled:opacity-50">
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : otpSending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {/* REGISTER FORM – STEP 1: DETAILS */}
          {registering && registerStep === "details" && (
            <form onSubmit={handleSendOtp} noValidate className="mt-7 border border-ink/12 bg-card p-6 md:p-8">
              {formError && (
                <p role="alert" className="mb-6 flex items-start gap-2 border border-brick/35 bg-brick/8 px-4 py-3 text-[13px] leading-6 text-brick">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </p>
              )}

              <div className="mb-5">
                <label htmlFor="reg-name" className="stamp font-semibold ink-2">
                  Full name
                </label>
                <input
                  id="reg-name"
                  ref={nameRef}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass("name")}
                  placeholder="Ananya Sharma"
                  aria-invalid={issueFor.has("name") || undefined}
                  disabled={otpSending}
                />
                {issueFor.has("name") && <p role="alert" className="mt-2 text-[12px] text-brick">{issueFor.get("name")}</p>}
              </div>

              <fieldset className="mb-5 border-0 p-0">
                <legend className="stamp font-semibold ink-2">I am listing as</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {LISTER_TYPE_OPTIONS.map((option) => {
                    const active = listerType === option.value;
                    return (
                      <label
                        key={option.value}
                        htmlFor={`lister-type-${option.value}`}
                        className={`flex cursor-pointer items-start gap-3 border bg-card p-4 ${active ? "border-brick" : "border-ink/15"}`}
                      >
                        {/* Explicit htmlFor/id rather than relying on wrapping: the
                            caption sits two levels down in nested spans, so neither
                            the a11y lint rule nor every screen reader can infer the
                            association from containment alone. */}
                        <input
                          id={`lister-type-${option.value}`}
                          type="radio"
                          name="listerType"
                          value={option.value}
                          checked={active}
                          onChange={() => setListerType(option.value)}
                          disabled={otpSending}
                          className="mt-0.5 h-4 w-4 accent-[var(--brick)]"
                        />
                        <span className="block">
                          <span className="block text-[14px] font-semibold">{option.label}</span>
                          <span className="mt-0.5 block text-[12px] ink-3">{option.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {issueFor.has("listerType") && <p role="alert" className="mt-2 text-[12px] text-brick">{issueFor.get("listerType")}</p>}
              </fieldset>

              <div className="mb-5">
                <label htmlFor="reg-phone" className="stamp font-semibold ink-2 flex items-center gap-2">
                  <Smartphone size={14} /> Mobile number
                </label>
                <div className="mt-2 flex">
                  <span className="inline-flex items-center border border-r-0 border-ink/15 bg-sand/50 px-3 text-[15px]">+91</span>
                  <input
                    id="reg-phone"
                    ref={phoneRef}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full border bg-card px-4 py-3.5 text-[15px] outline-none focus:border-brick ${issueFor.has("phone") ? "border-brick" : "border-ink/15"}`}
                    placeholder="98765 43210"
                    aria-invalid={issueFor.has("phone") || undefined}
                    disabled={otpSending}
                  />
                </div>
                {issueFor.has("phone") && <p role="alert" className="mt-2 text-[12px] text-brick">{issueFor.get("phone")}</p>}
                <p className="mt-2 flex items-center gap-1 text-[11px] ink-3">
                  <MessageCircle size={12} /> OTP will be sent via WhatsApp from our official number
                </p>
              </div>

              <div className="mb-6">
                <label htmlFor="reg-password" className="stamp font-semibold ink-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldClass("password")} pr-12`}
                    placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                    aria-invalid={issueFor.has("password") || undefined}
                    disabled={otpSending}
                  />
                  <button type="button" onClick={() => setShowPassword((c) => !c)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center ink-3 hover:text-brick">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {issueFor.has("password") ? (
                  <p role="alert" className="mt-2 text-[12px] text-brick">{issueFor.get("password")}</p>
                ) : (
                  <p className="mt-2 text-[12px] ink-3">You’ll use mobile number + password to sign in.</p>
                )}
              </div>

              <button type="submit" disabled={otpSending} className="clay-fill btn-sweep btn-solid motion-press inline-flex w-full items-center justify-center gap-2 bg-brick px-7 py-4 stamp font-semibold text-cream">
                {otpSending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Sending OTP via WhatsApp…
                  </>
                ) : (
                  <>
                    Send OTP <ArrowUpRight size={15} />
                  </>
                )}
              </button>

              <p className="mt-5 text-[13px] ink-3">
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-brick underline underline-offset-4">
                  Sign in
                </button>
                .
              </p>
            </form>
          )}

          {/* REGISTER STEP 2: OTP */}
          {registering && registerStep === "otp" && (
            <form onSubmit={handleVerifyOtp} noValidate className="mt-7 border border-ink/12 bg-card p-6 md:p-8">
              <div className="mb-6 rounded border border-trust/20 bg-trust/5 p-4">
                <p className="flex items-center gap-2 text-[13px] font-medium">
                  <MessageCircle size={14} className="text-trust" /> OTP sent to {phoneMasked ?? phone} via WhatsApp
                </p>
                <p className="mt-1 text-[12px] ink-3">Enter the 6-digit code. Valid for 5 minutes. Check WhatsApp from our official number.</p>
                {otpExpiresAt && <p className="mt-1 text-[11px] ink-3">Expires: {new Date(otpExpiresAt).toLocaleTimeString()}</p>}
              </div>

              {formError && (
                <p role="alert" className="mb-6 flex items-start gap-2 border border-brick/35 bg-brick/8 px-4 py-3 text-[13px] text-brick">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </p>
              )}

              <div className="mb-5">
                <label htmlFor="reg-otp" className="stamp font-semibold ink-2">
                  6-digit OTP
                </label>
                <input
                  id="reg-otp"
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`${fieldClass("otp")} tracking-[0.3em] text-center text-[20px] font-mono`}
                  placeholder="123456"
                  aria-invalid={issueFor.has("otp") || undefined}
                  disabled={submitting}
                />
                {issueFor.has("otp") && <p role="alert" className="mt-2 text-[12px] text-brick">{issueFor.get("otp")}</p>}
              </div>

              <button type="submit" disabled={submitting} className="clay-fill btn-sweep btn-solid motion-press inline-flex w-full items-center justify-center gap-2 bg-brick px-7 py-4 stamp font-semibold text-cream">
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    Verify & Create Account <ArrowUpRight size={15} />
                  </>
                )}
              </button>

              <div className="mt-5 flex items-center justify-between text-[13px]">
                <button type="button" onClick={() => setRegisterStep("details")} className="ink-3 underline underline-offset-4 hover:text-brick">
                  ← Change number
                </button>
                <button type="button" onClick={handleResendOtp} disabled={resendCountdown > 0 || otpSending} className="font-semibold text-brick underline underline-offset-4 disabled:opacity-50">
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : otpSending ? "Sending…" : "Resend OTP"}
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="h-fit space-y-5">
          <div className="border border-ink/12 bg-card p-6">
            <ShieldCheck size={22} className="text-trust" />
            <h2 className="mt-4 font-display text-2xl font-medium">WhatsApp OTP – secure</h2>
            <p className="mt-3 text-[14px] leading-7 ink-2">
              We use our official WhatsApp number (admin connects first via QR) to send OTPs — to verify a new account and to reset a forgotten password. Your number is verified once, then you sign in with mobile + password. No email needed.
            </p>
            <ul role="list" className="mt-4 list-disc pl-5 text-[13px] leading-6 ink-3">
              <li>India only: +91, 10-digit starting 6-9</li>
              <li>6-digit OTP, 5 min expiry, 5 attempts max</li>
              <li>3 OTPs per hour per number</li>
              <li>Signup and reset codes are separate — one cannot stand in for the other</li>
              <li>Admin WhatsApp must be CONNECTED</li>
            </ul>
          </div>

          <div className="border border-ink/12 bg-sand/60 p-6">
            <LockKeyhole size={20} className="text-brick" />
            <h2 className="mt-4 font-display text-2xl font-medium">Preview sign-ins</h2>
            <p className="mt-3 text-[14px] leading-7 ink-2">Demo auth source – phone OTP mocked as 123456 in demo. Use email demos below or set ARCHITECH_AUTH_SOURCE=better-auth for real phone flow.</p>
            <ul role="list" className="mt-5 space-y-3">
              {DEMO_HINTS.map((hint) => (
                <li key={hint.email}>
                  <button type="button" onClick={() => { setMode("signin"); setPhone(hint.phone); setPassword(hint.password); setIssues([]); setFormError(null); phoneRef.current?.focus(); }} className="w-full border border-ink/12 bg-card px-4 py-3 text-left hover:border-brick">
                    <span className="stamp font-semibold text-brick">{hint.label}</span>
                    <span className="mt-1 block text-[13px] ink-2">{hint.email} • +91 {hint.phone}</span>
                    <span className="block text-[12px] ink-3">{hint.password} • OTP: 123456 in demo</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
