"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { getErrorMessage } from "@/lib/api-error";
import { useLanguage } from "@/components/providers/LanguageProvider";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminMode = searchParams.get("role") === "admin";
  const { setAuth } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = t("auth.email_required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = t("auth.email_invalid");
    if (!password.trim()) newErrors.password = t("auth.password_required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    setErrors({});
    try {
      const data = await api.login({
        email,
        password,
        ...(isAdminMode && { role: "admin" }),
      });

      // C-3 fix: Use AuthProvider's setAuth for global state
      setAuth(data.accessToken!, {
        id: data.user?.id,
        email: data.user?.email,
        fullName: data.user?.fullName,
        role: data.user?.role,
      });

      // Redirect based on role
      if (data.user?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/user");
      }
    } catch (err) {
      // M-1 fix: Use centralized error extraction with i18n
      setErrors({ form: getErrorMessage(err, t("error.fallback")) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6 text-center">
        {isAdminMode ? t("auth.admin_login") : t("auth.login")}
      </h1>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive font-medium">
            {errors.form}
          </div>
        )}

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
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Lock className="size-4" />
            </span>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.password_placeholder")}
              className={cn(
                "pl-9 pr-10 h-10",
                errors.password && "border-destructive ring-destructive/20"
              )}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          id="login-submit-btn"
          className="w-full h-10 rounded-lg bg-brand hover:bg-brand-dark text-brand-foreground font-semibold text-sm"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            t("auth.login_btn")
          )}
        </Button>

        {/* Footer — hide register link for admin mode */}
        {!isAdminMode && (
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.no_account")}{" "}
            <Link
              href="/register"
              className="text-brand font-semibold hover:underline"
            >
              {t("auth.create_account")}
            </Link>
          </p>
        )}
      </form>
    </>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
