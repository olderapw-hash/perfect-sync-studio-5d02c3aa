const WORLD_TAG_NAMES: Record<number, string> = {
  1: "Mundo Principal",
  121: "Paraiso",
  122: "Inferno",
  137: "Morai",
  143: "Guerra das Nacoes - Base",
  144: "Guerra das Nacoes - Bandeira",
  145: "Guerra das Nacoes - Cristal",
  146: "Guerra das Nacoes - Ponte",
  161: "Vale Celestial",
  163: "Mundo Primitivo",
  178: "Quedanunca",
  179: "Arena de Guan Yu",
  187: "Arena de Guan Yu",
  188: "Arena de Guan Yu",
  189: "Arena de Guan Yu",
  194: "Mapa de GVG",
};

const INSTANCE_CATEGORY_NAMES: Record<string, string> = {
  arena: "Arena",
  battle: "Batalha",
  instance: "Instancia",
  random: "Aleatorio",
  unassigned: "Nao atribuido",
  world: "Mundo",
};

const INSTANCE_SCOPE_NAMES: Record<string, string> = {
  instance_server: "Servidor de instancia",
  unassigned: "Nao atribuido",
  world_server: "Servidor de mundo",
};

const INSTANCE_SECTION_TYPE_NAMES: Record<string, string> = {
  instance: "Instancia",
  world: "Mundo",
};

const INSTANCE_STATE_NAMES: Record<string, string> = {
  error: "Erro",
  running: "Rodando",
  starting: "Iniciando",
  stopped: "Parada",
  stopping: "Parando",
};

const INSTANCE_CODE_NAMES: Record<string, string> = {
  a91: "Terra da Aventura de Cheero",
  arena01: "Arena da Cidade das Espadas",
  arena02: "Arena da Cidade Universal",
  arena03: "Arena da Cidade das Plumas",
  arena04: "Arena da Cidade do Dragao",
  arena05: "Nirvana (antigo)",
  bg01: "Guerra Territorial 3 PvP",
  bg02: "Guerra Territorial 3 PvE",
  bg03: "Guerra Territorial 2 PvP",
  bg04: "Guerra Territorial 2 PvE",
  bg05: "Guerra Territorial 1 PvP",
  bg06: "Guerra Territorial 1 PvE",
  gs01: "Mundo Principal",
  is01: "Cidade Fantasma",
  is02: "Passagem Secreta (PWIC-Arena)",
  is05: "Gruta da Rocha de Fogo (19-Pessoas)",
  is06: "Covil dos Lobos Raivosos (19-Zoo)",
  is07: "Caverna dos Crueis (19-Sid)",
  is08: "Salao da Decepcao (29)",
  is09: "Portao do Delirio (39)",
  is10: "Terras Secretas da Cidade do Gelo (51)",
  is11: "Vale do Desastre (59)",
  is12: "Ruinas da Selva",
  is13: "Caverna da Alegria Sadica",
  is14: "Portal dos Espectros (69)",
  is15: "Antiga Capital de Loulan (79)",
  is16: "Eden (89-Ceu-1)",
  is17: "Poco de Enxofre (89-Inferno-1)",
  is18: "Templo do Dragao",
  is19: "Ilha dos Piratas (Passagem no 79)",
  is20: "Ilha das Serpentes (racas)",
  is21: "Sabio (Ceu)",
  is22: "Demonio (Inferno)",
  is23: "Assento do Tormento (99-Ceu-2)",
  is24: "Abaddon (99-Inferno-2)",
  is25: "Cidade Errante",
  is26: "Prisao Amaldicoada",
  is27: "Clareira Lunar",
  is28: "Vale da Reciprocidade",
  is29: "Cidade do Gelo",
  is31: "Templo do Crepusculo (XX)",
  is32: "Cubo do Destino",
  is33: "Punicao do Deus Tiannu",
  is34: "Igreja do Casamento",
  is35: "Base da Faccao",
  is37: "Morai",
  is38: "Vale da Fenix",
  is39: "Universo Sem Fim",
  is40: "Masmorra de Morai",
  is41: "Universo Sem Fim - Supermodo",
  is42: "Desfiladeiro do Deus da Guerra",
  is43: "Cinco Imperadores",
  is44: "Cena de Teste",
  is45: "Cena de Teste",
  is46: "Cena de Teste",
  is47: "Vale do Por do Sol",
  is48: "Palacio do Obturador",
  is49: "Refugio do Dragao",
  is50: "Ilha BOT",
  is61: "Vale Celestial",
  is62: "Origem (Inicio 1.5.1)",
  is63: "Mundo Primitivo",
  is64: "Salao do Despertar",
  is66: "Palacio do Rio de Prata",
  is67: "Salao da Corrente Subterranea",
  is68: "Mundo Primitivo - Modo Historia",
  is69: "Caverna Vela de Luz",
  is70: "Cubo do Destino",
  is71: "Vale do Dragao",
  is72: "Torre de Buda (1)",
  is73: "Torre de Buda (2)",
  is74: "Torre de Buda (3)",
  is75: "Torre de Buda (4)",
  is76: "Oceano da Miragem",
  is77: "Torneio",
  is78: "Continente Ocidental",
  is79: "Arena 1",
  is80: "Santuario do Topo das Nuvens (1)",
  is81: "Santuario do Topo das Nuvens (2)",
  is82: "Santuario do Topo das Nuvens (3)",
  is83: "Santuario do Topo das Nuvens (4)",
  is86: "Saloes da Luz da Alvorada",
  is87: "Arena 2",
  is88: "Arena 3",
  is89: "Arena 4",
  is90: "Saloes da Luz da Alvorada (Evento)",
  is94: "GVG",
  is113: "Mapa Teste",
  is122: "Novo Mapa",
  ms01: "Localizacao Mobile",
  rand03: "Desertos da Miragem",
  rand04: "Labirinto de Areia Movedica",
  rand06: "RAND06",
};

const INSTANCE_NAME_NAMES: Record<string, string> = {
  "Abaddon (99-Hell-2)": "Abaddon (99-Inferno-2)",
  "Adventure Land of Cheero": "Terra da Aventura de Cheero",
  "Archosaur Arena": "Arena da Cidade do Dragao",
  Arena1: "Arena 1",
  Arena2: "Arena 2",
  Arena3: "Arena 3",
  Arena4: "Arena 4",
  "BOT Island": "Ilha BOT",
  "Brimstone Pit (89-Hell-1)": "Poco de Enxofre (89-Inferno-1)",
  "Buddha Tower(1)": "Torre de Buda (1)",
  "Buddha Tower(2)": "Torre de Buda (2)",
  "Buddha Tower(3)": "Torre de Buda (3)",
  "Buddha Tower(4)": "Torre de Buda (4)",
  "Cave of Sadistic Glee": "Caverna da Alegria Sadica",
  "Cave of the Vicious (19-Sid)": "Caverna dos Crueis (19-Sid)",
  "Celestial Vale": "Vale Celestial",
  "Cloudtop Sanctuary(1)": "Santuario do Topo das Nuvens (1)",
  "Cloudtop Sanctuary(2)": "Santuario do Topo das Nuvens (2)",
  "Cloudtop Sanctuary(3)": "Santuario do Topo das Nuvens (3)",
  "Cloudtop Sanctuary(4)": "Santuario do Topo das Nuvens (4)",
  "Cube of Fate": "Cubo do Destino",
  "Cursed Jail": "Prisao Amaldicoada",
  "Dawnlight Halls": "Saloes da Luz da Alvorada",
  "Dawnlight Halls(Event)": "Saloes da Luz da Alvorada (Evento)",
  "Demon (Hell)": "Demonio (Inferno)",
  "Den of Rabid Wolves (19-Zoo)": "Covil dos Lobos Raivosos (19-Zoo)",
  "Dragon refuge": "Refugio do Dragao",
  "Dragon Temple": "Templo do Dragao",
  "Dragon Valley": "Vale do Dragao",
  "Eden (89-Heaven-1)": "Eden (89-Ceu-1)",
  "Endless Universe": "Universo Sem Fim",
  "Endless Universe Super Mode": "Universo Sem Fim - Supermodo",
  "Etherblade Arena": "Arena da Cidade das Espadas",
  "Faction Base": "Base da Faccao",
  "Firecrag Grotto (19-People)": "Gruta da Rocha de Fogo (19-Pessoas)",
  "Five Emperors": "Cinco Imperadores",
  "Flowsilver Palace": "Palacio do Rio de Prata",
  "Frostcovered City": "Cidade do Gelo",
  "Ghost town": "Cidade Fantasma",
  gvg: "GVG",
  "Hall of Awakening": "Salao do Despertar",
  "Hall of Deception (29)": "Salao da Decepcao (29)",
  "Jungle Ruins": "Ruinas da Selva",
  "Lightsail Cave": "Caverna Vela de Luz",
  "Lost City Arena": "Arena da Cidade Universal",
  "Loulan ancient capital (79)": "Antiga Capital de Loulan (79)",
  mauteste: "Mapa Teste",
  "Mirage Deserts": "Desertos da Miragem",
  "Mirage Ocean": "Oceano da Miragem",
  "Mobile location": "Localizacao Mobile",
  "Morai Dungeon": "Masmorra de Morai",
  newmap: "Novo Mapa",
  "Nirvana (old)": "Nirvana (antigo)",
  "Origination(Start 1.5.1)": "Origem (Inicio 1.5.1)",
  "Phoenix Valley": "Vale da Fenix",
  "Pirate Island (Passage in 79)": "Ilha dos Piratas (Passagem no 79)",
  "Plume City Arena": "Arena da Cidade das Plumas",
  "Primal World": "Mundo Primitivo",
  "Primal World Story Mode": "Mundo Primitivo - Modo Historia",
  "Quicksand Maze": "Labirinto de Areia Movedica",
  "Sage (Heaven)": "Sabio (Ceu)",
  "Seat of Torment (99-Heaven-2)": "Assento do Tormento (99-Ceu-2)",
  "Secret Frostcover Grounds (51)": "Terras Secretas da Cidade do Gelo (51)",
  "Secret Passage (PWIC-Arena)": "Passagem Secreta (PWIC-Arena)",
  "Shutter Palace": "Palacio do Obturador",
  "Snake Isle (races)": "Ilha das Serpentes (racas)",
  "Snowchill Ruins": "Ruinas da Frialma",
  "Sunset Valley": "Vale do Por do Sol",
  "Test Scene": "Cena de Teste",
  "Territory War 1 PvE": "Guerra Territorial 1 PvE",
  "Territory War 1 PvP": "Guerra Territorial 1 PvP",
  "Territory War 2 PvE": "Guerra Territorial 2 PvE",
  "Territory War 2 PvP": "Guerra Territorial 2 PvP",
  "Territory War 3 PvE": "Guerra Territorial 3 PvE",
  "Territory War 3 PvP": "Guerra Territorial 3 PvP",
  "The Gate of Delirium (39)": "Portao do Delirio (39)",
  "The Lunar Glade": "Clareira Lunar",
  "Tiannu God punished": "Punicao do Deus Tiannu",
  Tournament: "Torneio",
  "Twilight Temple (XX)": "Templo do Crepusculo (XX)",
  "Undercurrent Hall": "Salao da Corrente Subterranea",
  "Valley of Disaster (59)": "Vale do Desastre (59)",
  "Valley of Reciprocity": "Vale da Reciprocidade",
  "Wandering the city": "Cidade Errante",
  "Wargod Gulch": "Desfiladeiro do Deus da Guerra",
  "Wedding Church": "Igreja do Casamento",
  "Western Continent": "Continente Ocidental",
  World: "Mundo Principal",
  "Wraithgate (69)": "Portal dos Espectros (69)",
  "[Morai]": "Morai",
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function localizeInstanceName(
  code: string | null | undefined,
  name: string | null | undefined,
): string {
  const codeKey = normalizeKey(code);
  const nameKey = normalizeKey(name);
  return (
    (codeKey ? INSTANCE_CODE_NAMES[codeKey] : undefined) ??
    (nameKey ? INSTANCE_NAME_NAMES[nameKey] : undefined) ??
    nameKey ??
    codeKey
  );
}

export function getOriginalInstanceName(
  code: string | null | undefined,
  name: string | null | undefined,
): string | null {
  const localized = localizeInstanceName(code, name);
  const original = normalizeKey(name);
  return original && original !== localized ? original : null;
}

export function localizeInstanceCategory(category: string | null | undefined): string {
  const key = normalizeKey(category);
  return INSTANCE_CATEGORY_NAMES[key] ?? key ?? "";
}

export function localizeInstanceScope(scope: string | null | undefined): string {
  const key = normalizeKey(scope);
  return INSTANCE_SCOPE_NAMES[key] ?? key ?? "";
}

export function localizeInstanceSectionType(sectionType: string | null | undefined): string {
  const key = normalizeKey(sectionType);
  return INSTANCE_SECTION_TYPE_NAMES[key] ?? key ?? "";
}

export function localizeInstanceState(state: string | null | undefined): string {
  const key = normalizeKey(state);
  return INSTANCE_STATE_NAMES[key] ?? key ?? "";
}

export function getWorldTagName(worldTag: number | null | undefined): string | null {
  if (worldTag == null || !Number.isFinite(worldTag)) return null;
  return WORLD_TAG_NAMES[worldTag] ?? null;
}

export function formatWorldTagLabel(worldTag: number | null | undefined): string {
  if (worldTag == null || !Number.isFinite(worldTag)) return "—";
  const name = getWorldTagName(worldTag);
  return name ? `${worldTag} · ${name}` : String(worldTag);
}
