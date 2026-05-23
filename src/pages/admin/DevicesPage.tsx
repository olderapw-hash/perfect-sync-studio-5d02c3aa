import { Laptop } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceList } from "@/components/admin/DeviceList";

const DevicesPage = () => {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h2 className="text-xl font-extrabold uppercase tracking-wider text-foreground">
            Dispositivos autorizados
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os navegadores/dispositivos que validaram uma licença no painel.
          </p>
        </div>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Todos os dispositivos
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Como superadmin você pode revogar qualquer dispositivo. A pessoa terá que validar a licença novamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeviceList scope="all" showOwner />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DevicesPage;
