import type { ClsTemplate } from "@/types/clsconfig";
import { InventoryGrid } from "./InventoryGrid";

interface Props {
  template: ClsTemplate;
  onChange: (next: ClsTemplate) => void;
}

export const EquipmentTab = ({ template, onChange }: Props) => {
  return (
    <InventoryGrid
      title="Itens equipados"
      items={template.equipment.items}
      gridSize={Math.max(template.equipment.items.length, 16)}
      onChange={(items) => onChange({ ...template, equipment: { items } })}
    />
  );
};
