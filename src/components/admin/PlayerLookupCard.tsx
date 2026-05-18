// Card reutilizável para buscar personagem por nick/userid/roleid.
// Usa pwApi.getPlayerTargetProfile e expõe o perfil resolvido via onResolved.
import { useState } from "react";
import { Crosshair, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { pwApi, type PlayerTargetProfile } from "@/lib/pwApiActions";

export interface PlayerLookupCardProps {
  /** Callback disparado quando o perfil é resolvido com sucesso. */
  onResolved?: (profile: PlayerTargetProfile) => void;
  /** Mensagem opcional logo abaixo do título. */
  hint?: string;
  /** Esconde o bloco "Alvo resolvido" (caso o parent renderize o resultado). */
  hideResult?: boolean;
}

type LookupKind = "name" | "userid" | "roleid";

export const PlayerLookupCard = ({
  onResolved,
  hint,
  hideResult,
}: PlayerLookupCardProps) => {
  const [lookup, setLookup] = useState<{ kind: LookupKind; value: string }>({
    kind: "name",
    value: "",
  });
  const [resolving, setResolving] = useState(false);
  const [profile, setProfile] = useState<PlayerTargetProfile | null>(null);

  const resolve = async () => {
    const raw = lookup.value.trim();
    if (!raw) {
      toast.error(
        lookup.kind === "name"
          ? "Informe o nick do personagem"
          : `Informe ${lookup.kind} válido`,
      );
      return;
    }
    const query: { name?: string; userid?: number; roleid?: number } = {};
    if (lookup.kind === "name") {
      query.name = raw;
    } else {
      const n = Number(raw);
      if (!n) {
        toast.error(`Informe ${lookup.kind} válido`);
        return;
      }
      query[lookup.kind] = n;
    }
    setResolving(true);
    try {
      const res = await pwApi.getPlayerTargetProfile(query);
      setProfile(res.profile);
      onResolved?.(res.profile);
      toast.success(`Resolvido: roleid ${res.profile.roleid}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  };

  return (
    <Card className="bg-card/40">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Search className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-extrabold uppercase tracking-wider">
                Buscar personagem (nick → roleid)
              </CardTitle>
              <Badge
                variant="outline"
                className="border-primary/40 text-primary text-[10px]"
              >
                Lookup
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {hint ??
                "Selecione nick, digite o nome do personagem e clique em Resolver. Também aceita userid ou roleid."}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
          <Select
            value={lookup.kind}
            onValueChange={(v) =>
              setLookup((c) => ({ ...c, kind: v as LookupKind }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">nick (nome)</SelectItem>
              <SelectItem value="userid">userid</SelectItem>
              <SelectItem value="roleid">roleid</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={lookup.value}
            onChange={(e) =>
              setLookup((c) => ({ ...c, value: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") void resolve();
            }}
            placeholder={
              lookup.kind === "name"
                ? "Digite o nick do personagem aqui…"
                : lookup.kind === "userid"
                  ? "Ex.: 1216"
                  : "Ex.: 1024"
            }
          />
          <Button onClick={() => void resolve()} disabled={resolving}>
            {resolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            Resolver
          </Button>
        </div>

        {!hideResult && profile && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Alvo resolvido
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-foreground">
                {profile.name || `roleid ${profile.roleid}`}
              </span>
              {profile.online ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-400"
                >
                  online
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  offline
                </Badge>
              )}
            </div>
            <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
              <span>
                roleid:{" "}
                <span className="font-mono text-foreground">
                  {profile.roleid}
                </span>
              </span>
              {profile.userid != null && (
                <span>
                  userid:{" "}
                  <span className="font-mono text-foreground">
                    {profile.userid}
                  </span>
                </span>
              )}
              {profile.class_name && (
                <span>
                  classe:{" "}
                  <span className="font-mono text-foreground">
                    {profile.class_name}
                  </span>
                </span>
              )}
              {profile.level != null && (
                <span>
                  level:{" "}
                  <span className="font-mono text-foreground">
                    {profile.level}
                  </span>
                </span>
              )}
              {profile.guild && (
                <span>
                  guild:{" "}
                  <span className="font-mono text-foreground">
                    {profile.guild}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
