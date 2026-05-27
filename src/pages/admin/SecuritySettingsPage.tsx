// /admin/security/settings — protecao da landing + sessoes ativas.
import { LandingAccessSecurityPanel } from "@/components/admin/LandingAccessSecurityPanel";

const SecuritySettingsPage = () => (
  <div className="h-full overflow-y-auto p-6">
    <LandingAccessSecurityPanel />
  </div>
);

export default SecuritySettingsPage;
