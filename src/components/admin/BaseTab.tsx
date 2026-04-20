import type { ClsBase, ClsTemplate } from "@/types/clsconfig";

interface Props {
  template: ClsTemplate;
  onChange: (next: ClsTemplate) => void;
}

const setBase = (t: ClsTemplate, patch: Partial<ClsBase>): ClsTemplate => ({
  ...t,
  base: { ...t.base, ...patch },
});

export const BaseTab = ({ template, onChange }: Props) => {
  const b = template.base;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Nome" value={b.name} onChange={(v) => onChange(setBase(template, { name: v }))} />
      <NumField label="Classe (cls)" value={b.cls} onChange={(v) => onChange(setBase(template, { cls: v }))} />
      <NumField label="Raça" value={b.race} onChange={(v) => onChange(setBase(template, { race: v }))} />
      <NumField label="Gênero" value={b.gender} onChange={(v) => onChange(setBase(template, { gender: v }))} />
      <NumField label="ID base" value={b.id} onChange={(v) => onChange(setBase(template, { id: v }))} />
      <NumField label="UserID" value={b.userid} onChange={(v) => onChange(setBase(template, { userid: v }))} />
      <NumField label="Spouse" value={b.spouse} onChange={(v) => onChange(setBase(template, { spouse: v }))} />
      <NumField label="Status base" value={b.status} onChange={(v) => onChange(setBase(template, { status: v }))} />
      <Field label="Custom data" value={b.custom_data} onChange={(v) => onChange(setBase(template, { custom_data: v }))} />
      <Field label="Config data" value={b.config_data} onChange={(v) => onChange(setBase(template, { config_data: v }))} />
      <Field label="Cross data" value={b.cross_data} onChange={(v) => onChange(setBase(template, { cross_data: v }))} />
      <NumField label="Custom stamp" value={b.custom_stamp} onChange={(v) => onChange(setBase(template, { custom_stamp: v }))} />
    </div>
  );
};

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <label className="block">
    <span className="uppercase-label mb-1.5 block">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none transition-smooth focus:border-primary"
    />
  </label>
);

const NumField = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <label className="block">
    <span className="uppercase-label mb-1.5 block">{label}</span>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-sm outline-none transition-smooth focus:border-primary"
    />
  </label>
);
