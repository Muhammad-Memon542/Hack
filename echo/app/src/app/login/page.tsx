import type { Metadata } from "next";
import { auth0Enabled } from "@/lib/auth0";
import { LoginPanel } from "@/components/LoginPanel";

export const metadata: Metadata = {
  title: "Log in — Echo",
};

export default function LoginPage() {
  // auth0Enabled is read server-side; the panel handles the client auth state.
  return <LoginPanel configured={auth0Enabled} />;
}
