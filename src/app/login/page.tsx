import Link from "next/link";
import { Brand } from "@/components/ui";
import { LoginForm } from "@/components/login";
export default function Login() {
  return (
    <div className="login-page">
      <Link href="/">
        <Brand />
      </Link>
      <main id="main" className="login-card">
        <span className="eyebrow">STAFF ACCESS</span>
        <h1>Ready for game day.</h1>
        <p>Sign in to the event operations desk.</p>
        <LoginForm />
        <div className="lab-note">
          Disposable lab authentication
          <br />
          Synthetic data only · Astra Experiment #002
        </div>
      </main>
      <Link href="/" className="subtle-link">
        ← Back to public events
      </Link>
    </div>
  );
}
