"use client";

// Keep the second and fourth pages on the same authenticated snapshot as the rest of V28.
// A separate, client-selected identity is never sent to an unshipped service.

import { useEffect } from "react";
import { useRuntime } from "./runtime-context";
import { setPage2Runtime } from "../features/pages24";

export function Page2Identity() {
  const runtime = useRuntime();
  useEffect(() => {
    setPage2Runtime(runtime?.snapshot ?? null, runtime?.command ?? null);
  }, [runtime?.snapshot, runtime?.command]);
  return null;
}
