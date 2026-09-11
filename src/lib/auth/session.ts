import { demoBrokerSession, type AuthSession } from "./roles";

export type SessionMode = "demo" | "none";

export function getDemoSession(mode: SessionMode = "demo"): AuthSession | null {
  return mode === "demo" ? demoBrokerSession : null;
}
