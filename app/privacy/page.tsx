import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] px-5 py-10 text-[var(--color-foreground)] md:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-[var(--color-primary)] hover:underline">
          Back to FloodWatch PH
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Privacy Notice</h1>
        <p className="mt-3 leading-7 text-[var(--color-muted-foreground)]">
          FloodWatch PH accepts community flood reports without requiring an account.
          Reporter names and optional contact details are collected only when you choose
          to provide them for follow-up.
        </p>

        <section className="mt-8 space-y-5 leading-7 text-[var(--color-muted-foreground)]">
          <div>
            <h2 className="font-semibold text-[var(--color-foreground)]">Public display</h2>
            <p>
              Reporter names are not shown in public feeds, maps, nearby-report results,
              or shared report links. Public reports are labeled as anonymous community reports.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-foreground)]">Owner access</h2>
            <p>
              The anonymous browser session that submitted a report can view its own
              submitted reporter name while managing that report. The session cookie is
              HttpOnly and is not a user account or identity verification system.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-foreground)]">Use and retention</h2>
            <p>
              Submitted details are used to operate, verify, and moderate flood reports.
              Do not submit sensitive information, government identifiers, medical details,
              or information about another person without permission.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-foreground)]">Your choices</h2>
            <p>
              You may leave reporter details blank and submit anonymously. For deletion or
              privacy questions, contact the FloodWatch PH project operator through the
              deployment’s published support channel.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
