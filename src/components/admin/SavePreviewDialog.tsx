import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { ClsTemplate } from "@/types/clsconfig";
import { Loader2, Save } from "lucide-react";

interface Props {
  open: boolean;
  template: ClsTemplate;
  onCancel: () => void;
  onConfirm: () => void;
  saving?: boolean;
}

export const SavePreviewDialog = ({ open, template, onCancel, onConfirm, saving }: Props) => {
  const filled = (arr: { id: number }[]) => arr.filter((i) => i.id > 0).length;
  const className = template.summary.class_name ?? `Classe ${template.summary.cls}`;
  const s = template.status;
  const inv = template.inventory;
  const eq = template.equipment;
  const sh = template.storehouse;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel()}>
      <DialogContent className="max-w-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle>Revisar antes de salvar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <Section title="Identidade">
            <Row label="Classe" value={`${className} (cls ${template.summary.cls})`} />
            <Row label="Roleid" value={template.roleid || "—"} mono />
            <Row label="Nome" value={template.base.name || "(sem nome)"} />
            <Row label="Raça / Gênero" value={`${template.base.race} / ${template.base.gender}`} mono />
          </Section>

          <Section title="Status">
            <Row label="Level" value={s.level} mono />
            <Row label="Cultivo (level2)" value={s.level2} mono />
            <Row label="Fama" value={s.reputation} mono />
            <Row label="HP / MP" value={`${s.hp} / ${s.mp}`} mono />
            <Row label="EXP / SP / PP" value={`${s.exp} / ${s.sp} / ${s.pp}`} mono />
          </Section>

          <Section title="Posição">
            <Row label="World tag" value={s.worldtag} mono />
            <Row label="X, Y, Z" value={`${s.posx}, ${s.posy}, ${s.posz}`} mono />
          </Section>

          <Section title="Bens">
            <Row label="Dinheiro (inv)" value={inv.money.toLocaleString("pt-BR")} mono />
            <Row label="Dinheiro (baú)" value={sh.money.toLocaleString("pt-BR")} mono />
            <Row
              label="Itens"
              value={`inv ${filled(inv.items)}/${inv.items.length} · eq ${filled(eq.items)}/${eq.items.length} · baú ${
                filled(sh.items) + filled(sh.dress) + filled(sh.material) + filled(sh.generalcard)
              }`}
              mono
            />
          </Section>
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-4 py-2 text-sm transition-smooth hover:border-primary/50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-smooth hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Confirmar e salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h4 className="uppercase-label mb-2">{title}</h4>
    <div className="rounded-lg border border-border bg-background/40 p-3">{children}</div>
  </div>
);

const Row = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={mono ? "font-mono text-sm" : "text-sm"}>{value}</span>
  </div>
);
