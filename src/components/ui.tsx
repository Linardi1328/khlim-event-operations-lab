"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
const subscribeHydration = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">K.</span>
      <span>
        KHLIM<span className="brand-sub">EVENT OPERATIONS LAB</span>
      </span>
    </span>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "lime" | "amber" | "dark";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">↗</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Button({
  children,
  busy,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || busy}>
      {busy ? <LoaderCircle size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function useRequest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);
  async function run<T = Record<string, unknown>>(
    url: string,
    data: unknown,
    message = "Saved successfully.",
  ): Promise<T | null> {
    setBusy(true);
    setError("");
    setSuccess("");
    setConflicts([]);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        setConflicts(body.conflicts ?? []);
        throw new Error(body.error ?? "Unable to save.");
      }
      setSuccess(message);
      router.refresh();
      return body as T;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection failed. Your change was not confirmed.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    error,
    success,
    conflicts,
    clear: () => {
      setError("");
      setSuccess("");
      setConflicts([]);
    },
  };
}
export function Feedback({
  request,
}: {
  request: ReturnType<typeof useRequest>;
}) {
  return (
    <>
      {request.error && (
        <div className="notice error" role="alert">
          {request.error}
        </div>
      )}
      {request.success && (
        <div className="notice success" role="status">
          {request.success}
        </div>
      )}
    </>
  );
}
export function SignOut() {
  const router = useRouter();
  const r = useRequest();
  return (
    <>
      <button
        className="link-button"
        onClick={async () => {
          if (await r.run("/api/auth/logout", {})) router.push("/login");
        }}
        disabled={r.busy}
      >
        Sign out <ArrowUpRight size={14} />
      </button>
      <Feedback request={r} />
    </>
  );
}
