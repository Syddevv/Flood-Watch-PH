import type { WeatherOverviewData } from "@/lib/types";

export function WeatherOverview({ weather }: { weather: WeatherOverviewData }) {
  const WeatherIcon = weather.icon;

  return (
    <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[2rem] font-semibold leading-none text-[var(--color-foreground)]">
            {weather.temperature}
          </div>
          <p className="mt-1 text-[0.94rem] font-medium text-[var(--color-muted-foreground)]">
            {weather.condition}
          </p>
        </div>
        <div className="rounded-[16px] bg-[var(--color-panel)] p-2.5 text-[var(--color-primary)]">
          <WeatherIcon className="h-8 w-8" strokeWidth={2.1} />
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {weather.stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.id}
              className="rounded-[16px] bg-[var(--color-panel)] px-2.5 py-2.5 text-center"
            >
              <Icon
                className="mx-auto h-3.5 w-3.5 text-[var(--color-primary)]"
                strokeWidth={2.1}
              />
              <div className="mt-1.5 font-mono text-[1.05rem] font-semibold text-[var(--color-foreground)]">
                {stat.value}
              </div>
              <div className="mt-0.5 text-[0.64rem] text-[var(--color-muted-foreground)]">
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
