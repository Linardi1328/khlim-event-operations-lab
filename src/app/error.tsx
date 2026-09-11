"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="loading">
      <h1>We couldn’t load this view.</h1>
      <p>Check that the local database is running, then try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
