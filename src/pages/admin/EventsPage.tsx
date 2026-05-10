// /admin/events — hub container preparado para receber subsessões.
// Subsessão inicial: Rank PvP. Futuras: Boss Mundial, Eventos Sazonais,
// Torneios. Esta rota apenas redireciona para a primeira subsessão.
import { Navigate } from "react-router-dom";

const EventsPage = () => <Navigate to="/admin/events/rank-pvp" replace />;

export default EventsPage;
