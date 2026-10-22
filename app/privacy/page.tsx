import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] px-5 py-10 text-[var(--color-foreground)] md:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-[var(--color-primary)] hover:underline">
          Back to Flood Watch
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Privacy Notice</h1>
        <p className="mt-3 leading-7 text-[var(--color-muted-foreground)]">
          Viewing the flood map and existing reports never requires an account. Submitting a
          new flood report requires a verified account with a registered full name.
          Registration also collects an email and a verified Bulacan address.
        </p>

        <section className="mt-8 space-y-5 leading-7 text-[var(--color-muted-foreground)]">
          <div>
            <h2 className="font-semibold text-[var(--color-foreground)]">Public display</h2>
            <p>
              Your registered full name appears publicly on reports you submit, including report
              cards, maps, and shared links. Your email and residential address are not public.
              Historical reports without a reliable linked account show reporter information as unavailable.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-foreground)]">Owner access</h2>
            <p>
              The linked account can manage its submitted reports. Historical reports retain
              their original ownership rules. Session cookies are HttpOnly and passwords are
              never stored in plain text.
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
              You can update your registered full name from your profile. For deletion or
              privacy questions, contact the Flood Watch project operator through the
              deployment’s published support channel.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
