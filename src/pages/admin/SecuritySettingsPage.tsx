// /admin/security/settings — wrapper da SettingsTab existente.
import { SettingsTab } from "@/components/admin/SettingsTab";

const SecuritySettingsPage = () => (
  <div className="h-full overflow-y-auto p-6">
    <SettingsTab />
  </div>
);

export default SecuritySettingsPage;
