import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your concert ticket reservation account.",
};

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
