import { api } from "./api";

export async function login(password: string): Promise<boolean> {
  const res = await api<{ success: boolean }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return !!res.success;
}

export async function logout(): Promise<void> {
  await api("/api/auth/logout", { method: "POST" });
}
