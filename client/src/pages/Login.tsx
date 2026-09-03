"use client";
/* Sign in / create account.
 *
 * One page, two modes, because the alternative — two near-identical routes —
 * duplicates the validation, the error surface and the redirect logic three
 * ways. The mode is reflected in `?mode=register` so the register form is
 * linkable and survives a reload.
 *
 * Notes on the parts that are easy to get wrong:
 *
 * - Validation is the SAME module the server runs (`lib/auth/credentials`), so
 *   the inline message a user sees is never a different rule from the one that
 *   actually rejects them.
 * - Errors are announced through `role="alert"` and fields carry
 *   `aria-invalid`/`aria-describedby`, so a screen-reader user learns what went
 *   wrong. Focus moves to the first bad field.
 * - Redirect goes through `resolvePostLoginPath`, which refuses off-site
 *   `?next=` values; the server independently computes the same destination, so
 *   a tampered client cannot be sent somewhere the server would not send it.
 * - The form posts JSON to a same-origin route, so the credentials never appear
 *   in a URL or in the browser history.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowUpRight, Eye, EyeOff, Loader2, LockKeyhole, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import useTitle from "@/hooks/useTitle";
import { useSession } from "@/contexts/SessionContext";
import { landingPathForSession, resolvePostLoginPath, safeNextPath } from "@/lib/auth/redirects";
import { PASSWORD_MIN_LENGTH, validateSignIn, validateSignUp, type CredentialField, type CredentialIssue } from "@/lib/auth/credentials";
import type { AuthSession } from "@/lib/auth/roles";

type Mode = "signin" | "register";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  issues?: CredentialIssue[];
  session?: AuthSession;
  redirectTo?: string;
};

const DEMO_HINTS = [
  { label: "Broker admin", email: "broker-admin@example.com", password: "demo-broker-1234" },
  { label: "Buyer", email: "buyer@example.com", password: "demo-buyer-1234" },
  { label: "Moderator", email: "moderator@example.com", password: "demo-moderator-1234" },
];

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, session, adopt } = useSession();

  const requestedMode = searchParams.get("mode") === "register" ? "register" : "signin";
  const next = safeNextPath(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>(requestedMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [issues, setIssues] = useState<CredentialIssue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useTitle(mode === "register" ? "Create your account" : "Sign in");
  useEffect(() => setMode(requestedMode), [requestedMode]);

  /* Already signed in? A login page is not a useful destination for a live
     session, so hand them onward to where they were going. Waiting for
     `status` to settle avoids bouncing a user who is merely still loading. */
  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    router.replace(resolvePostLoginPath(session, next));
  }, [status, session, next, router]);

  const issueFor = useMemo(() => {
    const map = new Map<CredentialField, string>();
    for (const issue of issues) if (!map.has(issue.field)) map.set(issue.field, issue.message);
    return map;
  }, [issues]);

  const focusFirstIssue = (found: CredentialIssue[]) => {
    const first = found[0]?.field;
    if (first === "name") nameRef.current?.focus();
    else if (first === "email") emailRef.current?.focus();
    else if (first === "password") passwordRef.current?.focus();
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setIssues([]);
    setFormError(null);
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "register") params.set("mode", "register");
    else params.delete("mode");
    const query = params.toString();
    router.replace(query ? `/login/?${query}` : "/login/", { scroll: false });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const validated = mode === "register" ? validateSignUp({ name, email, password }) : validateSignIn({ email, password });
    if (!validated.ok) {
      setIssues(validated.issues);
      focusFirstIssue(validated.issues);
      return;
    }
    setIssues([]);
    setSubmitting(true);

    try {
      const response = await fetch(mode === "register" ? "/api/auth/register/" : "/api/auth/login/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validated.value, next }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || !payload.ok || !payload.session) {
        const returned = payload.issues ?? [];
        setIssues(returned);
        setFormError(payload.message ?? "We could not sign you in. Please try again.");
        if (returned.length > 0) focusFirstIssue(returned);
        return;
      }

      /* Clear the password from state the moment it is no longer needed. */
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

  const fieldClass = (field: CredentialField) =>
    `mt-2 w-full border bg-card px-4 py-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-[color:var(--ink-3,#6e6058)] focus:border-brick ${issueFor.has(field) ? "border-brick" : "border-ink/15"}`;

  const registering = mode === "register";

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-12 md:py-16">
        <div className="container">
          <p className="kicker text-brick">{registering ? "Create your account" : "Sign in"}</p>
          <h1 className="display mt-5 max-w-[720px] text-[clamp(34px,4.6vw,64px)]">
            {registering ? <>Start a <em className="text-brick">shortlist</em> that follows you.</> : <>Welcome back to your <em className="text-brick">survey</em>.</>}
          </h1>
          <p className="mt-5 max-w-[520px] text-[15px] leading-7 ink-2">
            {registering
              ? "An account keeps your saved homes, saved searches and requirement briefs together across devices."
              : "Sign in to reach your shortlist, saved searches, and — for verified partners — the broker workspace."}
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
              <span className="inline-flex items-center gap-2"><LogIn size={14} /> Sign in</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={registering}
              onClick={() => switchMode("register")}
              className={`flex-1 border-l border-ink/15 px-5 py-3.5 stamp font-semibold transition-colors ${registering ? "bg-brick text-cream" : "bg-card ink-2 hover:text-brick"}`}
            >
              <span className="inline-flex items-center gap-2"><UserPlus size={14} /> Create account</span>
            </button>
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-7 border border-ink/12 bg-card p-6 md:p-8">
            {formError && (
              <p role="alert" className="mb-6 flex items-start gap-2 border border-brick/35 bg-brick/8 px-4 py-3 text-[13px] leading-6 text-brick">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </p>
            )}

            {registering && (
              <div className="mb-5">
                <label htmlFor="login-name" className="stamp font-semibold ink-2">Full name</label>
                <input
                  id="login-name"
                  ref={nameRef}
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={fieldClass("name")}
                  placeholder="Ananya Sharma"
                  aria-invalid={issueFor.has("name") || undefined}
                  aria-describedby={issueFor.has("name") ? "login-name-error" : undefined}
                  disabled={submitting}
                />
                {issueFor.has("name") && <p id="login-name-error" role="alert" className="mt-2 text-[12px] text-brick">{issueFor.get("name")}</p>}
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="login-email" className="stamp font-semibold ink-2">Email address</label>
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                name="email"
                inputMode="email"
                autoComplete={registering ? "email" : "username"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={fieldClass("email")}
                placeholder="you@example.com"
                aria-invalid={issueFor.has("email") || undefined}
                aria-describedby={issueFor.has("email") ? "login-email-error" : undefined}
                disabled={submitting}
              />
              {issueFor.has("email") && <p id="login-email-error" role="alert" className="mt-2 text-[12px] text-brick">{issueFor.get("email")}</p>}
            </div>

            <div className="mb-6">
              <label htmlFor="login-password" className="stamp font-semibold ink-2">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={registering ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${fieldClass("password")} pr-12`}
                  placeholder={registering ? `At least ${PASSWORD_MIN_LENGTH} characters` : "Your password"}
                  aria-invalid={issueFor.has("password") || undefined}
                  aria-describedby={issueFor.has("password") ? "login-password-error" : registering ? "login-password-hint" : undefined}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center ink-3 transition-colors hover:text-brick"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {issueFor.has("password") ? (
                <p id="login-password-error" role="alert" className="mt-2 text-[12px] text-brick">{issueFor.get("password")}</p>
              ) : registering ? (
                <p id="login-password-hint" className="mt-2 text-[12px] ink-3">Use at least {PASSWORD_MIN_LENGTH} characters.</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="clay-fill btn-sweep btn-solid motion-press inline-flex w-full items-center justify-center gap-2 bg-brick px-7 py-4 stamp font-semibold text-cream"
            >
              {submitting ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> {registering ? "Creating account…" : "Signing in…"}</> : <>{registering ? "Create account" : "Sign in"} <ArrowUpRight size={15} aria-hidden="true" /></>}
            </button>

            <p className="mt-5 text-[13px] leading-6 ink-3">
              {registering ? (
                <>Already have an account? <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-brick underline underline-offset-4">Sign in</button>.</>
              ) : (
                <>New to Architech? <button type="button" onClick={() => switchMode("register")} className="font-semibold text-brick underline underline-offset-4">Create an account</button>.</>
              )}
            </p>
            <p className="mt-3 text-[12px] leading-6 ink-3">
              By continuing you agree to our <Link href="/terms/" className="underline underline-offset-4">terms</Link> and <Link href="/privacy/" className="underline underline-offset-4">privacy notice</Link>.
            </p>
          </form>
        </div>

        <aside className="h-fit space-y-5">
          <div className="border border-ink/12 bg-card p-6">
            <ShieldCheck size={22} className="text-trust" aria-hidden="true" />
            <h2 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em]">Sessions, not surveillance</h2>
            <p className="mt-3 text-[14px] leading-7 ink-2">
              Sign-in uses a first-party, HTTP-only session cookie. Broker and moderation surfaces are authorised on the server for every request — the browser never decides what you may see.
            </p>
          </div>

          <div className="border border-ink/12 bg-sand/60 p-6">
            <LockKeyhole size={20} className="text-brick" aria-hidden="true" />
            <h2 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em]">Preview sign-ins</h2>
            <p className="mt-3 text-[14px] leading-7 ink-2">
              This deployment runs the demo auth source. Use one of these accounts to see how each role lands, or wire <code className="text-[12px]">ARCHITECH_AUTH_SOURCE=better-auth</code> for live credentials.
            </p>
            <ul role="list" className="mt-5 space-y-3">
              {DEMO_HINTS.map((hint) => (
                <li key={hint.email}>
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setEmail(hint.email); setPassword(hint.password); setIssues([]); setFormError(null); }}
                    className="w-full border border-ink/12 bg-card px-4 py-3 text-left transition-colors hover:border-brick"
                  >
                    <span className="stamp font-semibold text-brick">{hint.label}</span>
                    <span className="mt-1 block text-[13px] ink-2">{hint.email}</span>
                    <span className="block text-[12px] ink-3">{hint.password}</span>
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
