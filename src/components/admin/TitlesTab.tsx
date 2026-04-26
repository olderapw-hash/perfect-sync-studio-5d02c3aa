// Aba "Títulos" — vista focada para editar `status.title_data` (blob raw).
// O save continua passando pelo fluxo padrão do editor (mesma rota de status).
import { ScrollText, Info } from "lucide-react";
import type { ClsTemplate, ClsStatus } from "@/types/clsconfig";

interface Props {
  template: ClsTemplate;
  onChange: (next: ClsTemplate) => void;
}

const setStatus = (t: ClsTemplate, patch: Partial<ClsStatus>): ClsTemplate => ({
  ...t,
  status: { ...t.status, ...patch },
});

export const TitlesTab = ({ template, onChange }: Props) => {
  const value = template.status.title_data ?? "";
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-bronze-soft/60 bg-card/40 p-3 text-xs text-bronze-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bronze" />
        <div className="space-y-1">
          <p>
            <strong className="text-bronze">title_data</strong> é o blob serializado de títulos do
            personagem (string hex/octets). Edite com cuidado — formato proprietário do servidor.
          </p>
          <p className="text-[11px] opacity-80">
            Salvar usa o mesmo fluxo do editor (backup automático + auto-export se ligado).
          </p>
        </div>
      </div>

      <section>
        <h4 className="uppercase-label mb-2 flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5" />
          title_data (raw)
        </h4>
        <textarea
          rows={10}
          value={value}
          onChange={(e) => onChange(setStatus(template, { title_data: e.target.value }))}
          className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs leading-relaxed outline-none transition-smooth focus:border-primary"
          spellCheck={false}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {value.length.toLocaleString()} caracteres
        </p>
      </section>
    </div>
  );
};
