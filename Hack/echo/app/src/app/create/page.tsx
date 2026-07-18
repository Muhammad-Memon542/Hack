"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../providers";

// Single create entry point is the modal; this route just opens it.
export default function CreateRedirect() {
  const router = useRouter();
  const { setCreateOpen } = useApp();
  useEffect(() => {
    setCreateOpen(true);
    router.replace("/");
  }, [router, setCreateOpen]);
  return null;
}
