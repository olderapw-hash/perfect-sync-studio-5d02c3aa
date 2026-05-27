import { useCallback, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { pwApi, type GuildDirectoryEntry } from "@/lib/pwApiActions";

export interface SelectedGuild {
  guild_id: number;
  guild_name: string;
}

interface GuildMultiSelectProps {
  selected: SelectedGuild[];
  onChange: (guilds: SelectedGuild[]) => void;
  disabled?: boolean;
}

export function GuildMultiSelect({ selected, onChange, disabled }: GuildMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [manualId, setManualId] = useState("");
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState(false);
  const [results, setResults] = useState<GuildDirectoryEntry[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const isSelected = useCallback(
    (guildId: number) => selected.some(g => g.guild_id === guildId),
    [selected],
  );

  const addGuild = useCallback(
    (entry: GuildDirectoryEntry) => {
      const guildId = Number(entry.guild_id);
      if (!Number.isFinite(guildId) || guildId <= 0 || isSelected(guildId)) return;
      onChange([
        ...selected,
        {
          guild_id: guildId,
          guild_name: entry.guild_name?.trim() || `Guild #${guildId}`,
        },
      ]);
    },
    [isSelected, onChange, selected],
  );

  const removeGuild = useCallback(
    (guildId: number) => {
      onChange(selected.filter(g => g.guild_id !== guildId));
    },
    [onChange, selected],
  );

  const searchGuilds = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await pwApi.searchGuildDirectory({ q, limit: 20 });
      setResults(res.entries || []);
      if (!res.entries?.length) {
        setSearchError("Nenhuma guild encontrada");
      }
    } catch (e) {
      setResults([]);
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, [query]);

  const addManualGuild = useCallback(async () => {
    const id = parseInt(manualId, 10);
    if (Number.isNaN(id) || id <= 0) {
      setSearchError("Informe um Guild ID válido");
      return;
    }
    if (isSelected(id)) {
      setManualId("");
      return;
    }

    setAddingId(true);
    setSearchError(null);
    try {
      const res = await pwApi.searchGuildDirectory({ guild_id: id });
      const entry = res.entries?.[0];
      if (entry) {
        addGuild(entry);
      } else {
        onChange([...selected, { guild_id: id, guild_name: `Guild #${id}` }]);
      }
      setManualId("");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setAddingId(false);
    }
  }, [addGuild, isSelected, manualId, onChange, selected]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Buscar guild por nome</Label>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nome da guild"
            disabled={disabled}
            className="h-9 text-xs border-border/60 bg-card/60"
            onKeyDown={e => e.key === "Enter" && void searchGuilds()}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || searching || !query.trim()}
            onClick={() => void searchGuilds()}
            className="h-9 px-3 border-border/60"
          >
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-border/50 bg-card/40">
          {results.map(entry => {
            const picked = isSelected(Number(entry.guild_id));
            return (
              <button
                key={entry.guild_id}
                type="button"
                disabled={disabled || picked}
                onClick={() => addGuild(entry)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-b border-border/30 px-3 py-2 text-left text-xs last:border-b-0",
                  picked
                    ? "cursor-default bg-primary/5 text-muted-foreground"
                    : "hover:bg-primary/10 hover:text-primary",
                )}
              >
                <span className="truncate font-medium">{entry.guild_name || `Guild #${entry.guild_id}`}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  #{entry.guild_id}
                  {entry.member_count != null && entry.member_count > 0 ? ` · ${entry.member_count} membros` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Ou adicionar por Guild ID</Label>
        <div className="flex gap-2">
          <Input
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            placeholder="ID numérico"
            disabled={disabled}
            className="h-9 text-xs border-border/60 bg-card/60"
            onKeyDown={e => e.key === "Enter" && void addManualGuild()}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || addingId || !manualId.trim()}
            onClick={() => void addManualGuild()}
            className="h-9 px-3 border-border/60"
          >
            {addingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {searchError && (
        <p className="text-[10px] text-destructive">{searchError}</p>
      )}

      {selected.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            Guilds selecionadas ({selected.length})
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {selected.map(guild => (
              <Badge
                key={guild.guild_id}
                variant="outline"
                className="gap-1 border-primary/30 bg-primary/5 pr-1 text-[10px] text-primary"
              >
                {guild.guild_name} (#{guild.guild_id})
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeGuild(guild.guild_id)}
                    className="rounded p-0.5 hover:bg-primary/20"
                    aria-label={`Remover ${guild.guild_name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
