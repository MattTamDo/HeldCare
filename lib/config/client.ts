import type { RuntimeConfig } from "./runtime";

export async function readRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch("/api/runtime-config", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to read runtime configuration.");
  return response.json() as Promise<RuntimeConfig>;
}
