import type { WorkspaceData } from "./types";
import { demoData } from "./mock-data";

export const STORAGE_KEY = "nova-workspace-demo-v1";
export function loadWorkspace(): WorkspaceData {
  if (typeof window === "undefined") return demoData;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoData;
    const parsed = JSON.parse(raw) as Partial<WorkspaceData>;
    return { ...demoData, ...parsed, preferences: { ...demoData.preferences, ...parsed.preferences }, timer: { ...demoData.timer, ...parsed.timer } };
  } catch {
    return demoData;
  }
}
export function saveWorkspace(data: WorkspaceData): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { /* The UI reports browser storage limitations; no server persistence is implied. */ }
}
export function subscribeWorkspace(callback: () => void): () => void {
  const handler = (event: StorageEvent) => { if (event.key === STORAGE_KEY) callback(); };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
