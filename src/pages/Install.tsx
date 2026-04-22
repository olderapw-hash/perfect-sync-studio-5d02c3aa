// Página /install — entrega o pacote de instalação para a VPS do cliente.
// Cada arquivo é baixado individualmente; também tem botão "Copiar conteúdo"
// para colar direto no editor da VPS via SSH.
//
// Mostra o secret e a URL esperada do servidor ATIVO (ou um seletor caso o
// usuário tenha múltiplas VPS), para que ele saiba exatamente o que colar
// no $SECRET = '__PW_API_SECRET__'; do api_cls.php.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode,
  FileText,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  ShieldCheck,
  Terminal,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useServers } from "@/hooks/useServers";
import { supabase } from "@/integrations/supabase/client";
import { testServerConnection } from "@/lib/serverConnection";
import { cn } from "@/lib/utils";

interface InstallerFile {
  name: string;
  description: string;
  path: string; // public path
  icon: typeof FileCode;
  language: "php" | "bash" | "ini" | "markdown";
}

const FILES: InstallerFile[] = [
  {
    name: "api_cls.php",
    description: "Ponte HTTP entre o painel e o gamedbd da sua VPS.",
    path: "/installer/api_cls.php",
    icon: FileCode,
    language: "php",
  },
  {
    name: "exportclsconfig-api.sh",
    description: "Script que roda o gamedbd ./exportclsconfig.",
    path: "/installer/exportclsconfig-api.sh",
    icon: Terminal,
    language: "bash",
  },
  {
    name: "sudoers.example",
    description: "Linha do /etc/sudoers.d/apicls para o www-data/apache.",
    path: "/installer/sudoers.example",
    icon: ShieldCheck,
    language: "ini",
  },
  {
    name: "README.md",
    description: "Passo-a-passo completo de instalação.",
    path: "/installer/README.md",
    icon: FileText,
    language: "markdown",
  },
];

/** Tenta inferir uma URL "esperada" do api_cls.php a partir da URL cadastrada. */
function expectedApiUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return "http://SEU_IP/apicls/api_cls.php";
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (/api_cls\.php$/i.test(trimmed)) return trimmed;
  return `${trimmed}/apicls/api_cls.php`;
}

const Install = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { servers, active, loading: serversLoading } = useServers();

  const [copied, setCopied] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [secret, setSecret] = useState<string | null>(null);
  const [secretLoading, setSecretLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  // Default: servidor ativo, ou o primeiro da lista.
  useEffect(() => {
    if (!selectedId) {
      const fallback = active?.id ?? servers[0]?.id ?? "";
      if (fallback) setSelectedId(fallback);
    }
  }, [active, servers, selectedId]);

  const selected = useMemo(
    () => servers.find((s) => s.id === selectedId) ?? null,
    [servers, selectedId],
  );

  // Carrega o secret apenas para o servidor ATIVO (RPC só retorna o do ativo).
  useEffect(() => {
    let alive = true;
    setSecret(null);
    setShowSecret(false);
    if (!selected) return;
    if (!selected.is_active) {
      // Para servidores inativos, não conseguimos exibir o secret aqui — o
      // usuário precisa ativar primeiro ou abrir em "Meus Servidores".
      return;
    }
    setSecretLoading(true);
    supabase.rpc("get_my_tenant_secret").then(({ data }) => {
      if (!alive) return;
      setSecret((data as string | null) ?? null);
      setSecretLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [selected]);

  const apiUrl = expectedApiUrl(selected?.pw_api_base_url);

  const handleCopy = async (file: InstallerFile) => {
    try {
      const res = await fetch(file.path);
      if (!res.ok) throw new Error("Arquivo ainda não disponível");
      let text = await res.text();
      // Auto-substitui o placeholder do api_cls.php pelo secret real, se houver.
      if (file.name === "api_cls.php" && secret) {
        text = text.replace(/__PW_API_SECRET__/g, secret);
      }
      await navigator.clipboard.writeText(text);
      setCopied(file.name);
      setTimeout(() => setCopied(null), 2000);
      toast.success(
        file.name === "api_cls.php" && secret
          ? `${file.name} copiado (com secret embutido)`
          : `${file.name} copiado`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao copiar");
    }
  };

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const handleTest = async () => {
    if (!selected) return;
    setTesting(true);
    const r = await testServerConnection({ tenant_id: selected.id });
    setTesting(false);
    if (r.success) {
      toast.success(
        `Conexão OK${r.entries != null ? ` · ${r.entries} entries` : ""} (${r.elapsed_ms}ms)`,
      );
    } else {
      toast.error(`Falha: ${r.error ?? "erro desconhecido"}`);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/30">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold uppercase tracking-wider">
              Instalador da VPS
            </h1>
            <p className="text-xs text-muted-foreground">
              Arquivos para conectar sua VPS ao painel
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* ===== Credenciais do servidor selecionado ===== */}
        {session && servers.length > 0 && (
          <section className="mb-8 rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Credenciais para esta instalação
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cole estes valores no <code className="font-mono">api_cls.php</code> e em
                  "Meus Servidores".
                </p>
              </div>
              {servers.length > 1 && (
                <div className="min-w-[220px]">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Servidor
                  </Label>
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {servers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.server_name}
                          {s.is_active ? " · ativo" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* URL esperada */}
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <LinkIcon className="mr-1 inline h-3 w-3" />
                  URL esperada do api_cls.php
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    readOnly
                    value={apiUrl}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyValue("URL", apiUrl)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Secret */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <KeyRound className="mr-1 inline h-3 w-3" />
                  Secret deste servidor
                </Label>
                <div className="mt-1 flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      readOnly
                      type={showSecret ? "text" : "password"}
                      value={
                        secretLoading
                          ? "Carregando..."
                          : secret ?? (selected?.is_active ? "(sem secret configurado)" : "(ative este servidor para ver)")
                      }
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Mostrar/ocultar secret"
                      disabled={!secret}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => secret && copyValue("Secret", secret)}
                    disabled={!secret}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {selected && !selected.is_active && (
                  <p className="mt-1 text-[11px] text-amber-500">
                    Este servidor não é o ativo. Ative-o em <strong>Meus Servidores</strong>{" "}
                    para visualizar o secret aqui.
                  </p>
                )}
              </div>

              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                <strong>Não reutilize</strong> o secret de outro servidor. Cada VPS deve ter
                o seu próprio secret — assim, se um vazar, os outros continuam seguros.
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button onClick={handleTest} disabled={testing || !selected}>
                  {testing ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wifi className="mr-2 h-3.5 w-3.5" />
                  )}
                  Testar conexão depois da instalação
                </Button>
                <Button variant="outline" onClick={() => navigate("/servers")}>
                  Ir para Meus Servidores
                </Button>
              </div>
            </div>
          </section>
        )}

        {session && servers.length === 0 && !serversLoading && (
          <section className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Nenhum servidor cadastrado
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre uma VPS em <strong>Meus Servidores</strong> primeiro — assim o
              secret aparece aqui já pronto para colar no <code>api_cls.php</code>.
            </p>
            <Button className="mt-3" onClick={() => navigate("/servers")}>
              Ir para Meus Servidores
            </Button>
          </section>
        )}

        {/* ===== Passo a passo ===== */}
        <section className="mb-8 rounded-2xl border border-border bg-card/40 p-6">
          <h2 className="text-lg font-extrabold">Como instalar</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">1.</strong> Crie a pasta na VPS:{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">sudo mkdir -p /var/www/html/apicls</code>.
            </li>
            <li>
              <strong className="text-foreground">2.</strong> Suba o{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">api_cls.php</code> para essa pasta
              (ou use o botão <em>Copiar</em> abaixo — ele já cola o seu secret no lugar).
            </li>
            <li>
              <strong className="text-foreground">3.</strong> Se editou na VPS, abra o arquivo
              e troque{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">__PW_API_SECRET__</code> pelo
              secret mostrado acima.
            </li>
            <li>
              <strong className="text-foreground">4.</strong> Crie a pasta de backups:{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">sudo mkdir -p /var/backups/clsconfig</code>{" "}
              e ajuste o owner para o usuário do PHP.
            </li>
            <li>
              <strong className="text-foreground">5.</strong> Instale o{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">exportclsconfig-api.sh</code>{" "}
              em <code className="rounded bg-muted px-1 font-mono text-xs">/usr/local/sbin/</code>{" "}
              com <code className="rounded bg-muted px-1 font-mono text-xs">chmod 750</code>.
            </li>
            <li>
              <strong className="text-foreground">6.</strong> Adicione a linha de{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">sudoers.example</code> em{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">/etc/sudoers.d/apicls</code>{" "}
              e rode <code className="rounded bg-muted px-1 font-mono text-xs">sudo visudo -c</code>.
            </li>
            <li>
              <strong className="text-foreground">7.</strong> Valide com{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">php -l</code> e teste{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">?action=ping</code>,{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">?action=getClasses</code>{" "}
              e <code className="rounded bg-muted px-1 font-mono text-xs">?action=exportClsconfig</code>.
            </li>
            <li>
              <strong className="text-foreground">8.</strong> Volte aqui e clique em{" "}
              <em>Testar conexão depois da instalação</em>.
            </li>
          </ol>
        </section>

        {/* ===== Arquivos ===== */}
        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Arquivos do instalador
          </h2>
          <div className="space-y-3">
            {FILES.map((f) => {
              const Icon = f.icon;
              const willEmbedSecret = f.name === "api_cls.php" && !!secret;
              return (
                <div
                  key={f.name}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card/40 p-4"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                        {f.language}
                        {willEmbedSecret && (
                          <span className="ml-2 text-emerald-500">
                            · Copiar embute o secret automaticamente
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(f)}
                      className={cn(copied === f.name && "border-emerald-500/60 text-emerald-500")}
                    >
                      {copied === f.name ? (
                        <Check className="mr-2 h-3.5 w-3.5" />
                      ) : (
                        <Copy className="mr-2 h-3.5 w-3.5" />
                      )}
                      {copied === f.name ? "Copiado" : "Copiar"}
                    </Button>
                    <Button asChild size="sm">
                      <a href={f.path} download={f.name}>
                        <Download className="mr-2 h-3.5 w-3.5" /> Baixar
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 rounded-md border border-border bg-card/30 p-4 text-xs text-muted-foreground">
            💡 O download <strong>não</strong> embute o secret — o arquivo baixado vem com{" "}
            <code className="rounded bg-muted px-1 font-mono">__PW_API_SECRET__</code>{" "}
            como placeholder. Use o botão <strong>Copiar</strong> acima para que o secret
            já vá embutido, ou troque manualmente na VPS.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Install;
