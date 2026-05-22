"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { getErrorMessage } from "@/lib/api-error";
import { useLanguage } from "@/components/providers/LanguageProvider";

/** Reusable password field with show/hide toggle */
function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Lock className="size-4" />
        </span>
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className={cn(
            "pl-9 pr-10 h-10",
            error && "border-destructive ring-destructive/20"
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = t("auth.name_required");
    if (!email.trim()) newErrors.email = t("auth.email_required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = t("auth.email_invalid");
    if (!password.trim()) newErrors.password = t("auth.password_required");
    else if (password.length < 8)
      newErrors.password = t("auth.password_min");
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
      newErrors.password = t("auth.password_format");
    if (!confirmPassword.trim())
      newErrors.confirmPassword = t("auth.confirm_required");
    else if (password !== confirmPassword)
      newErrors.confirmPassword = t("auth.confirm_mismatch");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    setErrors({});
    try {
      const data = await api.register({ fullName, email, password });
      setAuth(data.accessToken!, {
        id: data.user?.id,
        email: data.user?.email,
        fullName: data.user?.fullName,
        role: data.user?.role,
      });
      router.push("/user");
    } catch (err) {
      setErrors({ form: getErrorMessage(err, t("error.fallback")) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6 text-center">
        {t("auth.signup_title")}
      </h1>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive font-medium">
            {errors.form}
          </div>
        )}

        {/* Full name */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName">{t("auth.full_name")}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <User className="size-4" />
            </span>
            <Input
              id="fullName"
              type="text"
              placeholder={t("auth.name_placeholder")}
              className={cn(
                "pl-9 h-10",
                errors.fullName && "border-destructive ring-destructive/20"
              )}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={!!errors.fullName}
            />
          </div>
          {errors.fullName && (
            <p className="text-xs text-destructive">{errors.fullName}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <User className="size-4" />
            </span>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.email_placeholder")}
              className={cn(
                "pl-9 h-10",
                errors.email && "border-destructive ring-destructive/20"
              )}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <PasswordField
          id="password"
          label={t("auth.password")}
          placeholder={t("auth.create_password_placeholder")}
          value={password}
          onChange={setPassword}
          error={errors.password}
        />

        {/* Confirm Password */}
        <PasswordField
          id="confirmPassword"
          label={t("auth.confirm_password")}
          placeholder={t("auth.confirm_placeholder")}
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirmPassword}
        />

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          id="register-submit-btn"
          className="w-full h-10 rounded-lg bg-brand hover:bg-brand-dark text-brand-foreground font-semibold text-sm"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            t("auth.register_btn")
          )}
        </Button>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.have_account")}{" "}
          <Link
            href="/login"
            className="text-brand font-semibold hover:underline"
          >
            {t("auth.login_link")}
          </Link>
        </p>
      </form>
    </>
  );
}
