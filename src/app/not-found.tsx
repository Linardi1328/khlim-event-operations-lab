import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="loading">
      <h1>Event unavailable</h1>
      <p>The event may be unpublished, or this link is no longer available.</p>
      <Link className="button" href="/">
        Browse events
      </Link>
    </main>
  );
}
