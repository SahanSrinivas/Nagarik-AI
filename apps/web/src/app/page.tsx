import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8 py-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">NagarikAI</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Citizens report. Seven AI agents triage, verify, and route. A MILP solver
          assigns the right crew to the right route, every day. Pothole to repair
          in days, not months.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card href="/report" title="Report an issue" body="Snap a photo. We do the rest." />
        <Card href="/map" title="See your area" body="Live map of nearby issues." />
        <Card href="/agents" title="Watch the agents" body="See 7 agents collaborate in real time." />
        <Card href="/milp" title="Optimizer" body="Today's optimal crew dispatch — vs. the naive baseline." />
        <Card href="/dashboard" title="City dashboard" body="Resolution metrics by ward." />
        <Card href="/impact" title="Leaderboard" body="Top citizens and wards." />
      </section>
    </div>
  );
}

function Card({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-white p-5 transition hover:border-brand hover:shadow-sm"
    >
      <div className="text-base font-semibold text-zinc-900">{title}</div>
      <div className="mt-1 text-sm text-zinc-600">{body}</div>
    </Link>
  );
}
