// Aba "Reputação" — vista focada para `status.reputation` (Fama).
// Pequenos atalhos (+/-/zerar) e referência rápida de faixas de fama do PW.
import { Award, Info } from "lucide-react";
import type { ClsTemplate, ClsStatus } from "@/types/clsconfig";

interface Props {
  template: ClsTemplate;
  onChange: (next: ClsTemplate) => void;
}

const setStatus = (t: ClsTemplate, patch: Partial<ClsStatus>): ClsTemplate => ({
  ...t,
  status: { ...t.status, ...patch },
});

const PRESETS: { label: string; value: number }[] = [
  { label: "Iniciante", value: 0 },
  { label: "Conhecido", value: 5_000 },
  { label: "Renomado", value: 50_000 },
  { label: "Lendário", value: 500_000 },
  { label: "Imortal", value: 1_000_000 },
];

export const ReputationTab = ({ template, onChange }: Props) => {
  const reputation = template.status.reputation ?? 0;

  const setRep = (v: number) =>
    onChange(setStatus(template, { reputation: Math.max(0, Math.floor(v)) }));

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-bronze-soft/60 bg-card/40 p-3 text-xs text-bronze-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bronze" />
        <p>
          A <strong className="text-bronze">Fama</strong> (reputation) destrava títulos, missões e
          acesso a NPCs específicos. O save passa pelo fluxo padrão do editor.
        </p>
      </div>

      <section className="rounded-xl border border-bronze-soft/60 bg-card/30 p-4">
        <h4 className="uppercase-label mb-3 flex items-center gap-2">
          <Award className="h-3.5 w-3.5" />
          Fama atual
        </h4>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={0}
            value={reputation}
            onChange={(e) => setRep(Number(e.target.value))}
            className="w-44 rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-lg font-bold outline-none transition-smooth focus:border-primary"
          />
          <div className="flex flex-wrap gap-1.5">
            {[+100, +1_000, +10_000, +100_000].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRep(reputation + d)}
                className="rounded-md border border-bronze-soft/60 bg-card/50 px-2.5 py-1 font-mono text-[11px] font-semibold text-bronze-muted transition hover:border-primary/50 hover:text-bronze"
              >
                +{d.toLocaleString()}
              </button>
            ))}
            {[-100, -1_000, -10_000].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRep(reputation + d)}
                className="rounded-md border border-bronze-soft/60 bg-card/50 px-2.5 py-1 font-mono text-[11px] font-semibold text-bronze-muted transition hover:border-destructive/50 hover:text-destructive"
              >
                {d.toLocaleString()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRep(0)}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive transition hover:bg-destructive/20"
            >
              Zerar
            </button>
          </div>
        </div>
      </section>

      <section>
        <h4 className="uppercase-label mb-3">Presets rápidos</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {PRESETS.map((p) => {
            const active = reputation === p.value;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setRep(p.value)}
                className={
                  "rounded-lg border px-3 py-2 text-left transition " +
                  (active
                    ? "border-primary/60 bg-primary/10 text-bronze shadow-[0_0_12px_hsl(38_70%_50%/0.25)]"
                    : "border-bronze-soft/60 bg-card/40 text-bronze-muted hover:border-primary/40 hover:text-bronze")
                }
              >
                <div className="text-xs font-bold uppercase tracking-wider">{p.label}</div>
                <div className="font-mono text-[11px] opacity-80">{p.value.toLocaleString()}</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
