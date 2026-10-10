"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Portal = "customer" | "staff" | "super_admin";
type Props = { mode: "login" | "register"; audience?: Portal };
type Values = { name?: string; email: string; password: string };

export function AuthForm({ mode, audience = "customer" }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestNotice, setRequestNotice] = useState("");
  const [verificationPreview, setVerificationPreview] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [developmentCodePreview, setDevelopmentCodePreview] = useState("");
  const schema = mode === "login" ? loginSchema : registerSchema;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
  });

  const onSubmit = async (values: Values) => {
    setRequestError("");
    setRequestNotice("");
    setVerificationPreview("");
    try {
      if (mfaChallengeId && !/^\d{6}$/.test(mfaCode)) {
        setRequestError("Enter the six-digit code sent to your verified email.");
        return;
      }
      const endpoint = mfaChallengeId ? "/api/auth/super-admin-verify"
        : mode === "login" && audience !== "customer" ? `/api/auth/${audience === "staff" ? "staff" : "super-admin"}-login` : `/api/auth/${mode}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mfaChallengeId ? { challengeId: mfaChallengeId, code: mfaCode } : { ...values, email: values.email.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) {
        const message = body.message || "We couldn’t sign you in. Please try again.";
        setRequestError(message);
        return;
      }

      if (body.data?.mfaRequired && typeof body.data.challengeId === "string") {
        setMfaChallengeId(body.data.challengeId);
        setDevelopmentCodePreview(body.data.developmentCodePreview || "");
        setRequestNotice("A one-time verification code was sent to your verified email. It expires in five minutes.");
        return;
      }

      if (mode === "register") {
        setRequestNotice(body.message || "Account created. Check your email to verify it before signing in.");
        const preview = body.data?.developmentEmailPreview as string | undefined;
        setVerificationPreview(preview?.match(/https?:\/\/\S+/)?.[0] || "");
        return;
      }

      toast.success("Welcome back");
      const next = params.get("next");
      const user = body.data?.user;
      const fallback = audience === "customer" ? "/account"
        : audience === "super_admin" ? "/super-admin/dashboard"
          : user?.permissions?.includes("analytics.read") ? "/admin"
            : user?.permissions?.includes("orders.read_all") ? "/admin/orders"
              : "/admin/products";
      const safeNext = next !== null && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") &&
        (audience === "customer" ? !next.startsWith("/admin") && !next.startsWith("/super-admin")
          : audience === "staff" ? next.startsWith("/admin") && !next.startsWith("/admin/login")
            : next.startsWith("/super-admin/") || next.startsWith("/admin/"));
      router.replace(safeNext ? next : fallback);
      router.refresh();
    } catch {
      setRequestError("We couldn’t reach the sign in service. Check your connection and try again.");
    }
  };

  const passwordProps = register("password");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {!mfaChallengeId && mode === "register" && (
        <Field label="Your name" error={errors.name?.message} id="name">
          <input {...register("name")} id="name" autoComplete="name" className="field" placeholder="Alex Morgan" />
        </Field>
      )}
      {!mfaChallengeId && <Field label={mode === "login" && audience === "staff" ? "Work email" : mode === "login" && audience === "super_admin" ? "Admin email" : "Email address"} error={errors.email?.message} id="email">
        <input {...register("email")} id="email" type="email" autoComplete="email" inputMode="email" className="field" placeholder={mode === "login" && audience !== "customer" ? "name@smartcart.com" : "you@example.com"} />
      </Field>}
      {!mfaChallengeId && <Field label="Password" error={errors.password?.message} id="password">
        <span className="relative block">
          <input
            {...passwordProps}
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="field pr-12"
            placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink/55 hover:bg-ink/5 hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </span>
      </Field>}
      {mfaChallengeId && <Field label="Email verification code" id="mfa-code"><input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="field" placeholder="6-digit code" /></Field>}
      {developmentCodePreview && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Development email preview code: <strong className="font-mono tracking-widest">{developmentCodePreview}</strong></p>}
      {mfaChallengeId && <button type="button" className="text-xs text-ink/55 underline" onClick={() => { setMfaChallengeId(""); setMfaCode(""); setDevelopmentCodePreview(""); setRequestNotice(""); setRequestError(""); }}>Back to password</button>}
      {requestError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{requestError}</p>}
      {requestNotice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{requestNotice}</p>}
      {verificationPreview && <a className="block break-all text-xs text-emerald-800 underline" href={verificationPreview}>Open the development-only verification link</a>}
      <Button className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (mfaChallengeId ? "Verifying…" : mode === "login" ? "Signing you in…" : "Creating account…") : mfaChallengeId ? "Verify and sign in" : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      {!mfaChallengeId && (mode === "login" && audience !== "customer" ? null : <p className="text-center text-sm text-ink/55">
        {mode === "login" ? "New to SmartCart? " : "Already have an account? "}
        <Link className="font-medium text-emerald-700 underline underline-offset-4" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>)}
      {!mfaChallengeId && mode === "login" && <div className="flex justify-center gap-5 text-xs text-ink/55"><Link className="underline underline-offset-4" href="/forgot-password">Forgot password?</Link>{audience === "customer" && <Link className="underline underline-offset-4" href="/resend-verification">Resend verification</Link>}</div>}
    </form>
  );
}

function Field({ label, error, id, children }: { label: string; error?: string; id: string; children: React.ReactNode }) {
  return (
    <div className="block text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span role="alert" className="mt-1 block text-xs font-normal text-red-700">{error}</span>}
    </div>
  );
}
