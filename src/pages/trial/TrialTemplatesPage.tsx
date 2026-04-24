// /trial/templates — mesma experiência da página de templates do /admin,
// mas servida dentro do TrialLayout (sem sidebar Pro).
// Reutilizamos o componente para não duplicar lógica de edição CLS.
import TemplatesPage from "@/pages/admin/TemplatesPage";

const TrialTemplatesPage = () => <TemplatesPage />;

export default TrialTemplatesPage;
