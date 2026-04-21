import type { ClsTemplate } from "@/types/clsconfig";
import { InventoryGrid } from "./InventoryGrid";

interface Props {
  template: ClsTemplate;
  onChange: (next: ClsTemplate) => void;
}

export const InventoryTab = ({ template, onChange }: Props) => {
  const inv = template.inventory;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Num
          label="Capacidade"
          value={inv.capacity}
          onChange={(v) => onChange({ ...template, inventory: { ...inv, capacity: v } })}
        />
        <Num
          label="Dinheiro"
          value={inv.money}
          onChange={(v) => onChange({ ...template, inventory: { ...inv, money: v } })}
        />
        <Num
          label="Timestamp"
          value={inv.timestamp}
          onChange={(v) => onChange({ ...template, inventory: { ...inv, timestamp: v } })}
        />
      </div>

      <InventoryGrid
        title="Itens do inventário"
        items={inv.items}
        gridSize={Math.max(inv.capacity || 0, inv.items.length, 32)}
        onChange={(items) => onChange({ ...template, inventory: { ...inv, items } })}
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
