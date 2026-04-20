import type { ClsTemplate } from "@/types/clsconfig";
import { ItemList } from "./ItemList";

interface Props {
  template: ClsTemplate;
  onChange: (next: ClsTemplate) => void;
}

export const EquipmentTab = ({ template, onChange }: Props) => {
  return (
    <ItemList
      title="Itens equipados"
      items={template.equipment.items}
      onChange={(items) => onChange({ ...template, equipment: { items } })}
    />
  );
};
