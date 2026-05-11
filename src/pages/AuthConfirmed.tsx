import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AuthConfirmed() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-accent/30 shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-accent" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl tracking-wide">Cadastro confirmado</CardTitle>
          <CardDescription>
            Seu email foi verificado com sucesso. Sua conta no Orphea Core já está ativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full" size="lg">
            <Link to="/auth">Ir para o login</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/">Voltar para a página inicial</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
