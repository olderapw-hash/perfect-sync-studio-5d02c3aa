import { Trash2 } from "lucide-react";
import type { ClsItem } from "@/types/clsconfig";

interface Props {
  item: ClsItem;
  onChange: (next: ClsItem) => void;
  onRemove: () => void;
}

export const ItemEditor = ({ item, onChange, onRemove }: Props) => {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-md bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          pos {item.pos}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[11px] text-destructive transition-smooth hover:border-destructive/50"
        >
          <Trash2 className="h-3 w-3" />
          Remover
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Num label="ID" value={item.id} onChange={(v) => onChange({ ...item, id: v })} />
        <Num label="Pos" value={item.pos} onChange={(v) => onChange({ ...item, pos: v })} />
        <Num label="Count" value={item.count} onChange={(v) => onChange({ ...item, count: v })} />
        <Num label="Max count" value={item.max_count} onChange={(v) => onChange({ ...item, max_count: v })} />
        <Num label="Proctype" value={item.proctype} onChange={(v) => onChange({ ...item, proctype: v })} />
        <Num label="Expire date" value={item.expire_date} onChange={(v) => onChange({ ...item, expire_date: v })} />
        <Num label="Guid1" value={item.guid1} onChange={(v) => onChange({ ...item, guid1: v })} />
        <Num label="Guid2" value={item.guid2} onChange={(v) => onChange({ ...item, guid2: v })} />
        <Num label="Mask" value={item.mask} onChange={(v) => onChange({ ...item, mask: v })} />
      </div>

      <label className="mt-2 block">
        <span className="uppercase-label mb-1 block">Data (hex)</span>
        <input
          value={item.data}
          onChange={(e) => onChange({ ...item, data: e.target.value })}
          className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-[11px] outline-none transition-smooth focus:border-primary"
        />
      </label>
    </div>
  );
};

const Num = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <label className="block">
    <span className="uppercase-label mb-1 block">{label}</span>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-xs outline-none transition-smooth focus:border-primary"
    />
  </label>
);
