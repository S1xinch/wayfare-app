import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AuthForm from "@/components/AuthForm";

const MODES = ["login", "register", "forgot", "reset"];

export async function generateMetadata({ params }: { params: Promise<{ mode: string }> }): Promise<Metadata> {
  const { mode } = await params;
  return { title: { login: "Sign in", register: "Create account", forgot: "Forgot password", reset: "Reset password" }[mode] ?? "Not found" };
}

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { mode } = await params;
  if (!MODES.includes(mode)) notFound();
  const { token } = await searchParams;
  return (
    <div className="wrap auth-shell">
      <AuthForm mode={mode as "login" | "register" | "forgot" | "reset"} token={token ?? ""} />
    </div>
  );
}
