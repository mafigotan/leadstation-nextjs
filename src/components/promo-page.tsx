import { THEME_CLASSES, type PageContent } from "@/lib/types";

export function PromoPage({ content, form }: { content: PageContent; form: React.ReactNode }) {
  const theme = THEME_CLASSES[content.theme] ?? THEME_CLASSES.indigo;

  return (
    <div className="bg-white">
      <section className={`${theme.soft} px-4 py-16 sm:py-24`}>
        <div className="mx-auto max-w-3xl text-center">
          {content.badge && (
            <span className={`inline-block rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm ${theme.text}`}>
              {content.badge}
            </span>
          )}
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{content.headline}</h1>
          <p className="mx-auto mt-5 max-w-2xl whitespace-pre-line text-lg text-slate-600">{content.subheadline}</p>
          <a href="#signup" className={`mt-8 inline-flex rounded-lg px-6 py-3 font-semibold text-white shadow ${theme.bg}`}>
            {content.cta_label}
          </a>
        </div>
      </section>

      {content.benefits.length > 0 && (
        <section className="px-4 py-16">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {content.benefits.map((b, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-6">
                <div className={`mb-3 text-2xl font-bold ${theme.text}`}>{String(i + 1).padStart(2, "0")}</div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{b.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.details && (
        <section className="px-4 pb-8">
          <p className="mx-auto max-w-3xl whitespace-pre-line rounded-xl bg-slate-50 p-6 text-slate-700">{content.details}</p>
        </section>
      )}

      <section id="signup" className="px-4 py-16">
        <div className="mx-auto max-w-md">
          <h2 className="text-center text-2xl font-bold">{content.form_title}</h2>
          <p className="mb-6 mt-2 text-center text-slate-600">{content.form_description}</p>
          {form}
        </div>
      </section>
    </div>
  );
}
