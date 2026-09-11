"use client";
import { useRouter } from "next/navigation";
import { Button, Feedback, useRequest } from "./ui";
export function LoginForm() {
  const router = useRouter();
  const r = useRequest();
  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        if (
          await r.run(
            "/api/auth/login",
            { username: f.get("username"), password: f.get("password") },
            "Signed in.",
          )
        )
          router.push("/ops");
      }}
    >
      <label>
        Username
        <input name="username" autoComplete="username" required autoFocus />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      <Button type="submit" busy={r.busy}>
        Sign in to operations →
      </Button>
      <Feedback request={r} />
    </form>
  );
}
