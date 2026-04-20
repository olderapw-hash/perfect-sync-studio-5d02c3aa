import type { ClsTemplate } from "@/types/clsconfig";
import { ItemList } from "./ItemList";

interface Props {
  template: ClsTemplate;
  onChange: (next: ClsTemplate) => void;
}

export const StorehouseTab = ({ template, onChange }: Props) => {
  const sh = template.storehouse;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Num
          label="Capacidade"
          value={sh.capacity}
          onChange={(v) => onChange({ ...template, storehouse: { ...sh, capacity: v } })}
        />
        <Num
          label="Dinheiro"
          value={sh.money}
          onChange={(v) => onChange({ ...template, storehouse: { ...sh, money: v } })}
        />
      </div>

      <ItemList
        title="Itens do baú"
        items={sh.items}
        onChange={(items) => onChange({ ...template, storehouse: { ...sh, items } })}
      />
      <ItemList
        title="Dress"
        items={sh.dress}
        onChange={(dress) => onChange({ ...template, storehouse: { ...sh, dress } })}
      />
      <ItemList
        title="Material"
        items={sh.material}
        onChange={(material) => onChange({ ...template, storehouse: { ...sh, material } })}
      />
      <ItemList
        title="General card"
        items={sh.generalcard}
        onChange={(generalcard) => onChange({ ...template, storehouse: { ...sh, generalcard } })}
      />
    </div>
  );
};

const Num = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
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
