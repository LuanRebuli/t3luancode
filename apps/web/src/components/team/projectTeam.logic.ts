import {
  type ModelSelection,
  type ProviderDriverKind,
  ProviderInstanceId,
  type ProviderOptionSelections,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import {
  exhaustedUsageWindow,
  formatResetsIn,
  remainingPercent,
} from "@t3tools/shared/usageLimits";
import type { ProviderInstanceEntry } from "../../providerInstances";
import {
  detectOfficialWorkspacePreset,
  materializePresetPersonas,
  OFFICIAL_WORKSPACE_PRESETS,
  type OfficialWorkspacePreset,
  type OfficialWorkspacePresetId,
} from "./agentesChatPresets";

export {
  detectOfficialWorkspacePreset,
  OFFICIAL_WORKSPACE_PRESETS,
  type OfficialWorkspacePreset,
  type OfficialWorkspacePresetId,
};

export const T3_TEAM_FILE_PATH = ".t3/team.json";

export type AccountAvailabilityState =
  | "available"
  | "in_use"
  | "near_limit"
  | "cooldown"
  | "unavailable";

export interface AccountLiveSummary {
  readonly instanceId: ProviderInstanceId;
  readonly displayName: string;
  readonly driverKind: ProviderDriverKind;
  readonly accentColor: string | undefined;
  readonly isAvailable: boolean;
  readonly activeAgentCount: number;
  readonly lowestRemainingPercent: number | null;
  readonly mostConstrainedWindow: ServerProviderUsageWindow | null;
  readonly resetsIn: string | null;
  readonly state: AccountAvailabilityState;
  readonly stateLabel: string;
  readonly models: ProviderInstanceEntry["models"];
}

export type SquadRoleKey =
  | "principal"
  | "produto"
  | "spec"
  | "critico"
  | "design"
  | "dev"
  | "qa"
  | "revisao"
  | "entrega"
  | "especialista";

export type PersonaCategory = "comando" | "planejamento" | "execucao" | "qualidade" | "dominio";

export interface ProjectLinkedRepoValidation {
  readonly id: string;
  readonly comando: string;
}

export interface ProjectLinkedRepo {
  readonly id: string;
  readonly label: string;
  readonly cwd: string;
  readonly baseBranch: string;
  readonly role?: "api" | "web" | "fullstack" | "shared" | undefined;
  readonly donoDoContrato: boolean;
  readonly leiaAntes: ReadonlyArray<string>;
  readonly validacao: ReadonlyArray<ProjectLinkedRepoValidation>;
}

export interface ProjectPersona {
  readonly id: string;
  readonly handle?: string | undefined;
  readonly specialtyId?: string | undefined;
  readonly squadRoleKey?: SquadRoleKey | undefined;
  readonly category?: PersonaCategory | undefined;
  readonly name: string;
  readonly role: string;
  readonly jeito?: string | undefined;
  readonly pele?: string | undefined;
  readonly cabelo?: string | undefined;
  readonly roda?: string | undefined;
  readonly aprova?: string | undefined;
  readonly reprova?: string | undefined;
  readonly scalable?: boolean | undefined;
  readonly icon: string;
  readonly color: string;
  readonly instanceId: ProviderInstanceId;
  readonly model: string;
  readonly effort: string | null;
  readonly allowedTools: ReadonlyArray<string>;
  readonly skills: ReadonlyArray<string>;
  readonly qualityChecklist: ReadonlyArray<string>;
  readonly systemPrompt: string;
}

export type SquadWorkflowMode = "direct" | "mockup_turbo" | "full_pipeline" | "creative_studio";

export type SquadPipelineStageId =
  | "produto_spec"
  | "design"
  | "dev"
  | "qa_e2e"
  | "prints_aprovacao";

export interface SquadWorkflowModeMeta {
  readonly id: SquadWorkflowMode;
  readonly label: string;
  readonly shortLabel: string;
  readonly badgeText: string;
  readonly description: string;
  readonly defaultLeadPersonaId: string;
}

export const SQUAD_WORKFLOW_MODES: ReadonlyArray<SquadWorkflowModeMeta> = [
  {
    id: "direct",
    label: "Conversa Direta",
    shortLabel: "Direto",
    badgeText: "Direto",
    description: "Conversa direta com o membro ativo sem burocracia de etapas.",
    defaultLeadPersonaId: "principal",
  },
  {
    id: "mockup_turbo",
    label: "Fechar Mockup / Fidelidade Turbo",
    shortLabel: "Mockup Turbo",
    badgeText: "Mockup Turbo",
    description:
      "Foco 100% em UI/Mockup sem passar por 5 pessoas: solta Designers/Devs UI em worktree respeitando travas do Mapa do Produto, tira print antes/depois via preview_* e pede aprovação da tela.",
    defaultLeadPersonaId: "design",
  },
  {
    id: "full_pipeline",
    label: "Feature Completa (Orquestrada pela Nina)",
    shortLabel: "Feature Completa",
    badgeText: "Ciclo Completo",
    description:
      "Fluxo completo com delegate_task real: 1. Produto & Spec (Portão 1) -> 2. Design (Portão 2) -> 3. Dev Multi-Repo (API antes do Web) -> 4. QA E2E Real & Variações -> 5. Prints Finais & Aprovação 100%.",
    defaultLeadPersonaId: "principal",
  },
  {
    id: "creative_studio",
    label: "Estúdio Criativo: HTML & Posts",
    shortLabel: "HTML & Posts",
    badgeText: "HTML & Posts",
    description:
      "Cria HTML interativo (html_preview + html_render) ou gera artes .png prontas para postar (1080x1080, 1080x1350, 1080x1920) salvas no projeto com preview no chat.",
    defaultLeadPersonaId: "conteudo",
  },
];

export interface SquadPipelineStageMeta {
  readonly id: SquadPipelineStageId;
  readonly stepNumber: number;
  readonly title: string;
  readonly shortTitle: string;
  readonly ownerHandles: ReadonlyArray<string>;
  readonly requiresUserApprovalGate: boolean;
  readonly gateLabel: string | null;
  readonly description: string;
}

export const SQUAD_PIPELINE_STAGES: ReadonlyArray<SquadPipelineStageMeta> = [
  {
    id: "produto_spec",
    stepNumber: 1,
    title: "Produto & Spec",
    shortTitle: "1. Produto/Spec",
    ownerHandles: ["@produto", "@spec", "@critico", "@surf"],
    requiresUserApprovalGate: true,
    gateLabel: "Portão 1: Escopo & Contrato",
    description:
      "Otto (@produto), Iris (@spec) e especialistas definem escopo enxuto e contrato da API.",
  },
  {
    id: "design",
    stepNumber: 2,
    title: "Design & Estados",
    shortTitle: "2. Design",
    ownerHandles: ["@design"],
    requiresUserApprovalGate: true,
    gateLabel: "Portão 2: Visual & Telas",
    description: "Dora (@design) cria/ajusta estados visuais, responsivo e fidelidade.",
  },
  {
    id: "dev",
    stepNumber: 3,
    title: "Dev Multi-Repo",
    shortTitle: "3. Dev Multi-Repo",
    ownerHandles: ["@dev-api", "@dev-web", "@dev-pedidos", "@dev"],
    requiresUserApprovalGate: false,
    gateLabel: null,
    description:
      "Davi API fecha o contrato primeiro; depois múltiplos Davi Web rodam em worktrees paralelos.",
  },
  {
    id: "qa_e2e",
    stepNumber: 4,
    title: "QA E2E & Variações",
    shortTitle: "4. QA E2E",
    ownerHandles: ["@qa", "@revisor"],
    requiresUserApprovalGate: false,
    gateLabel: null,
    description:
      "Quim (@qa) e Rui (@revisor) rodam typecheck/testes + E2E real no navegador (preview_*) com variações (vazio, erro, mobile, desktop) e checagem de travas do Mapa do Produto. Se quebrar, devolve pro Dev automaticamente.",
  },
  {
    id: "prints_aprovacao",
    stepNumber: 5,
    title: "Prints & Aprovação 100%",
    shortTitle: "5. Prints & 100%",
    ownerHandles: ["@entrega", "@lider"],
    requiresUserApprovalGate: true,
    gateLabel: "Portão Final: Aprovação 100%",
    description:
      "Lia (@entrega) tira prints reais desktop + mobile da feature pronta e apresenta no chat para aprovação final.",
  },
];

export function resolveProviderBrandColor(
  driverKind: string | null | undefined,
  customAccentColor?: string | null,
): string {
  const trimmedCustom = customAccentColor?.trim() ?? "";
  if (
    trimmedCustom.startsWith("#") &&
    trimmedCustom.length >= 4 &&
    trimmedCustom.toLowerCase() !== "#6366f1"
  ) {
    return trimmedCustom;
  }
  const normalizedDriver = (driverKind ?? "").toLowerCase();
  if (normalizedDriver.includes("claude")) {
    return "#D97757";
  }
  if (normalizedDriver.includes("codex") || normalizedDriver.includes("openai")) {
    return "#10A37F";
  }
  if (normalizedDriver.includes("antigravity") || normalizedDriver.includes("gemini")) {
    return "#4E86F6";
  }
  return "#6366f1";
}

export function resolveProviderBrandLabel(driverKind: string | null | undefined): string {
  const normalizedDriver = (driverKind ?? "").trim().toLowerCase();
  if (normalizedDriver.includes("claude")) {
    return "Claude";
  }
  if (normalizedDriver.includes("codex") || normalizedDriver.includes("openai")) {
    return "Codex";
  }
  if (normalizedDriver.includes("antigravity") || normalizedDriver.includes("gemini")) {
    return "Gemini";
  }
  return driverKind?.trim() || "IA";
}

const PERSONA_SHORT_ROLE_MAP: Readonly<Record<string, string>> = {
  principal: "Líder",
  lider: "Líder",
  produto: "Produto & CRO",
  conversao: "Produto & CRO",
  crescimento: "Produto & CRO",
  spec: "Spec & Arq",
  arquiteto: "Spec & Arq",
  critico: "Crítico",
  design: "Design",
  "dev-api": "Dev API",
  "dev-web": "Dev Web",
  "dev-pedidos": "Dev Pedidos",
  dev: "Dev",
  qa: "QA E2E",
  revisao: "Revisão",
  revisor: "Revisão",
  entrega: "Entrega & Prints",
  evidencia: "Entrega & Prints",
  surf: "Surf & Meteo",
  conteudo: "Instagram & Copy",
};

export function resolvePersonaShortRole(
  persona: Pick<ProjectPersona, "id" | "role" | "handle" | "specialtyId"> & {
    readonly name?: string | undefined;
  },
): string {
  const rawHandle = persona.handle?.trim().replace(/^@/, "").toLowerCase() ?? "";
  const rawId = persona.id?.trim().replace(/^@/, "").toLowerCase() ?? "";
  const rawSpecialty = persona.specialtyId?.trim().replace(/^@/, "").toLowerCase() ?? "";
  const inlineHandleMatch = persona.name?.match(/@([a-z0-9_-]+)/i);
  const inlineHandle = inlineHandleMatch?.[1]?.toLowerCase() ?? "";

  for (const key of [rawId, rawHandle, rawSpecialty, inlineHandle]) {
    if (key && PERSONA_SHORT_ROLE_MAP[key]) {
      return PERSONA_SHORT_ROLE_MAP[key]!;
    }
  }

  const firstSegment = (persona.role ?? "").split(/[(&]/)[0]?.trim() ?? "";
  if (!firstSegment) {
    return "Coworker";
  }
  return firstSegment.length > 16 ? firstSegment.slice(0, 16).trim() : firstSegment;
}

export interface ProjectTeamConfig {
  readonly version: 1;
  readonly autoFallbackOnRateLimit: boolean;
  readonly fallbackThresholdPercent: number;
  readonly workspacePresetId?: OfficialWorkspacePresetId | undefined;
  readonly workspaceContext?: string | undefined;
  readonly linkedRepos?: ReadonlyArray<ProjectLinkedRepo> | undefined;
  readonly personas: ReadonlyArray<ProjectPersona>;
}

export const DEFAULT_PROJECT_TEAM_CONFIG: ProjectTeamConfig = {
  version: 1,
  autoFallbackOnRateLimit: true,
  fallbackThresholdPercent: 15,
  linkedRepos: [],
  personas: [],
};

export const AVAILABLE_PERSONA_TOOLS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
}> = [
  { id: "preview_*", label: "Browser Preview (preview_*)" },
  { id: "git_worktree", label: "Git Worktree Isolado" },
  { id: "terminal", label: "Terminal & Testes ($SQ rodar)" },
  { id: "file_edit", label: "Edição de Código / Docs" },
  { id: "web_search", label: "Pesquisa Web / Referências" },
];

export const OFFICIAL_LUAN_SKILLS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly category: string;
}> = [
  {
    id: "lider-triagem",
    label: "lider-triagem (Triagem em Receitas & Cobrança de Prova)",
    category: "Comando & Receitas",
  },
  {
    id: "receitas-uarapoint",
    label: "receitas-uarapoint (Receitas Oficiais Uarapoint)",
    category: "Comando & Receitas",
  },
  {
    id: "receitas-mare",
    label: "receitas-mare (Receitas Oficiais Maré Decorações)",
    category: "Comando & Receitas",
  },
  {
    id: "receitas-dentro-do-tubo",
    label: "receitas-dentro-do-tubo (Receitas Estúdio & Pedidos)",
    category: "Comando & Receitas",
  },
  {
    id: "receitas-aerolito",
    label: "receitas-aerolito (Receitas Aerolito Surf House)",
    category: "Comando & Receitas",
  },
  {
    id: "receitas-vitor-construtora",
    label: "receitas-vitor-construtora (Receitas PAHALLA Residence)",
    category: "Comando & Receitas",
  },
  {
    id: "site-novo",
    label: "site-novo (Fábrica de Sites: Ficha SITE.md Etapas 0 a 8)",
    category: "Fábrica de Sites",
  },
  {
    id: "arquitetura-site",
    label: "arquitetura-site (Mapa de Páginas, CTAs & Inventário)",
    category: "Fábrica de Sites",
  },
  {
    id: "visual-site",
    label: "visual-site (Identidade Visual Derivada do Cliente)",
    category: "Fábrica de Sites",
  },
  {
    id: "seo-site-cliente",
    label: "seo-site-cliente (Plano de SEO Local, Hreflang & JSON-LD)",
    category: "Fábrica de Sites",
  },
  {
    id: "mockups-abc",
    label: "mockups-abc (3 Mockups A/B/C Realmente Diferentes)",
    category: "Design & Motion",
  },
  {
    id: "design-revisao",
    label: "design-revisao (Revisão Visual 360/390/768/1280)",
    category: "Design & Motion",
  },
  {
    id: "portar-mockup",
    label: "portar-mockup (Portar Mockup com Fidelidade Lado a Lado)",
    category: "Design & Motion",
  },
  { id: "impeccable", label: "impeccable (Craft Floor & Polish UI)", category: "Design & Motion" },
  {
    id: "better-ui",
    label: "better-ui (Refino de Superfícies, Sombras & Alinhamento)",
    category: "Design & Motion",
  },
  {
    id: "emil-design-eng",
    label: "emil-design-eng (Filosofia Emil Kowalski)",
    category: "Design & Motion",
  },
  {
    id: "apple-design",
    label: "apple-design (Padrões HIG & Física Apple)",
    category: "Design & Motion",
  },
  { id: "animate", label: "animate (Construção de Animações Web)", category: "Design & Motion" },
  {
    id: "animate-expo",
    label: "animate-expo (Animações Reanimated & Expo)",
    category: "Design & Motion",
  },
  {
    id: "gestures",
    label: "gestures (Drag, Swipe & Sheets 1:1 com o Dedo)",
    category: "Design & Motion",
  },
  {
    id: "mobile-native",
    label: "mobile-native (Web App com Sensação Nativa no Celular)",
    category: "Design & Motion",
  },
  {
    id: "choreograph",
    label: "choreograph (Coreografia & Stagger de Entrada)",
    category: "Design & Motion",
  },
  {
    id: "review-animations",
    label: "review-animations (Auditoria de Curvas & Duração)",
    category: "Design & Motion",
  },
  {
    id: "improve-animations",
    label: "improve-animations (Plano de Melhoria de Motion)",
    category: "Design & Motion",
  },
  {
    id: "animation-performance",
    label: "animation-performance (GPU 60/120fps Compositor)",
    category: "Design & Motion",
  },
  {
    id: "contrato-api",
    label: "contrato-api (Contrato Primeiro: API antes de Web)",
    category: "Engenharia",
  },
  {
    id: "dev-tarefa",
    label: "dev-tarefa (Execução TDD em Worktree com Prova de CA)",
    category: "Engenharia",
  },
  { id: "tdd", label: "tdd (Teste que Falha Primeiro)", category: "Engenharia" },
  { id: "diagnosing-bugs", label: "diagnosing-bugs (Caça a Causa-Raiz)", category: "Engenharia" },
  {
    id: "qa-evidencia",
    label: "qa-evidencia (QA Independente em Provedor Diferente)",
    category: "Qualidade & Revisão",
  },
  {
    id: "break-ui",
    label: "break-ui (Stress-Test de UI com Dados Extremos)",
    category: "Qualidade & Revisão",
  },
  {
    id: "revisao-entrega",
    label: "revisao-entrega (Julgamento em 3 Eixos antes do Merge)",
    category: "Qualidade & Revisão",
  },
  {
    id: " surf-meteo-revisao".trim(),
    label: "surf-meteo-revisao (Domínio de Previsão de Surf & Picos)",
    category: "Domínio & Negócio",
  },
  {
    id: "conversao-funil",
    label: "conversao-funil (Análise Semanal de Funil & Retenção)",
    category: "Domínio & Negócio",
  },
  {
    id: "gate-mobile",
    label: "gate-mobile (Verificação do Gate para App Nativo)",
    category: "Domínio & Negócio",
  },
  {
    id: "conversao-landing",
    label: "conversao-landing (Conversão de Leads & Reservas WhatsApp)",
    category: "Domínio & Negócio",
  },
  {
    id: "cro-loja",
    label: "cro-loja (CRO & Revenue-Centric Design para E-commerce)",
    category: "Domínio & Negócio",
  },
  {
    id: "seo-loja",
    label: "seo-loja (SEO de Produto & Categoria com Antes/Depois)",
    category: "Domínio & Negócio",
  },
  {
    id: "conteudo-instagram",
    label: "conteudo-instagram (Pacotes Instagram, WhatsApp & Orçamentos)",
    category: "Domínio & Negócio",
  },
  {
    id: "revenue-centric-design",
    label: "revenue-centric-design (Design Orientado a Receita)",
    category: "Domínio & Negócio",
  },
  {
    id: "humanizer",
    label: "humanizer (Copy Natural sem Clichês de IA)",
    category: "Domínio & Negócio",
  },
  { id: "squad", label: "squad (Equipe Base 9 Personagens)", category: "Squad" },
];

export const EFFORT_OPTIONS: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "", label: "Padrão do modelo" },
  { value: "low", label: "Econômico / Rápido (Low)" },
  { value: "medium", label: "Equilibrado (Medium)" },
  { value: "high", label: "Profundo (High)" },
  { value: "max", label: "Máximo / Difícil (Max / XHigh)" },
];

export const UARAPOINT_DEFAULT_LINKED_REPOS: ReadonlyArray<ProjectLinkedRepo> = [
  {
    id: "api",
    label: "uarapoint-api",
    cwd: "D:/Projects/uarapoint-api",
    baseBranch: "main",
    role: "api",
    donoDoContrato: true,
    leiaAntes: [
      "AGENTS.md",
      "CONTEXT.md",
      "docs/UARAPOINT_AGENT_EXECUTION_STANDARD.md",
      "docs/UARAPOINT_TEAM_OWNERSHIP.md",
      "docs/COMMIT_CONVENTION.md",
    ],
    validacao: [
      { id: "VAL-api-1", comando: "npm run typecheck" },
      { id: "VAL-api-2", comando: "npm run lint" },
      { id: "VAL-api-3", comando: "npm test" },
    ],
  },
  {
    id: "web",
    label: "uarapoint-web",
    cwd: "D:/Projects/uarapoint-web",
    baseBranch: "main",
    role: "web",
    donoDoContrato: false,
    leiaAntes: [
      "AGENTS.md",
      "design.md",
      "docs/UARAPOINT_AGENT_EXECUTION_STANDARD.md",
      "docs/UARAPOINT_TEAM_OWNERSHIP.md",
    ],
    validacao: [
      { id: "VAL-web-1", comando: "npm run typecheck" },
      { id: "VAL-web-2", comando: "npm run lint" },
      { id: "VAL-web-3", comando: "npm test" },
    ],
  },
];

export function summarizeAccountLiveStatus(input: {
  readonly entry: ProviderInstanceEntry;
  readonly activeAgentCount: number;
  readonly nearLimitThresholdPercent?: number;
  readonly now: number;
}): AccountLiveSummary {
  const { entry, activeAgentCount, nearLimitThresholdPercent = 15, now } = input;
  const windows = entry.snapshot.usageLimits?.windows ?? [];
  const exhausted = exhaustedUsageWindow(entry.snapshot, now);

  let mostConstrainedWindow: ServerProviderUsageWindow | null = null;
  let lowestRemainingPercent: number | null = null;

  for (const window of windows) {
    const rem = remainingPercent(window);
    if (lowestRemainingPercent === null || rem < lowestRemainingPercent) {
      lowestRemainingPercent = rem;
      mostConstrainedWindow = window;
    }
  }

  const targetWindow = exhausted ?? mostConstrainedWindow;
  const resetsIn = targetWindow ? formatResetsIn(targetWindow, now) : null;

  let state: AccountAvailabilityState = "available";
  let stateLabel = "Disponível";

  if (!entry.isAvailable || entry.status === "error" || entry.status === "disabled") {
    state = "unavailable";
    stateLabel = "Indisponível";
  } else if (
    exhausted !== undefined ||
    (lowestRemainingPercent !== null && lowestRemainingPercent <= 0)
  ) {
    state = "cooldown";
    stateLabel = resetsIn ? `Em cooldown (${resetsIn})` : "Limite atingido";
  } else if (
    lowestRemainingPercent !== null &&
    lowestRemainingPercent <= nearLimitThresholdPercent
  ) {
    state = "near_limit";
    stateLabel = `Perto do limite (${lowestRemainingPercent}%)`;
  } else if (activeAgentCount > 0) {
    state = "in_use";
    stateLabel =
      activeAgentCount === 1 ? "Em uso (1 agente)" : `Em uso (${activeAgentCount} agentes)`;
  }

  return {
    instanceId: entry.instanceId,
    displayName: entry.displayName,
    driverKind: entry.driverKind,
    accentColor: resolveProviderBrandColor(entry.driverKind, entry.accentColor),
    isAvailable: entry.isAvailable,
    activeAgentCount,
    lowestRemainingPercent,
    mostConstrainedWindow: targetWindow,
    resetsIn,
    state,
    stateLabel,
    models: entry.models,
  };
}

export function resolveFallbackAccountSelection(input: {
  readonly currentSelection: ModelSelection;
  readonly summaries: ReadonlyArray<AccountLiveSummary>;
  readonly autoFallbackEnabled: boolean;
  readonly fallbackThresholdPercent?: number;
}): {
  readonly selection: ModelSelection;
  readonly switchedFrom: AccountLiveSummary;
  readonly switchedTo: AccountLiveSummary;
  readonly reason: "cooldown" | "near_limit" | "unavailable";
} | null {
  const { currentSelection, summaries, autoFallbackEnabled, fallbackThresholdPercent = 15 } = input;
  if (!autoFallbackEnabled) return null;

  const currentSummary = summaries.find(
    (summary) => summary.instanceId === currentSelection.instanceId,
  );
  if (!currentSummary) return null;

  const isExhausted = currentSummary.state === "cooldown";
  const isUnavailable = currentSummary.state === "unavailable";
  const isBelowThreshold =
    currentSummary.lowestRemainingPercent !== null &&
    currentSummary.lowestRemainingPercent <= fallbackThresholdPercent;

  if (!isExhausted && !isUnavailable && !isBelowThreshold) {
    return null;
  }

  const candidates = summaries.filter(
    (candidate) =>
      candidate.instanceId !== currentSelection.instanceId &&
      candidate.isAvailable &&
      candidate.state !== "cooldown" &&
      candidate.state !== "unavailable" &&
      (candidate.lowestRemainingPercent === null ||
        candidate.lowestRemainingPercent > fallbackThresholdPercent),
  );

  if (candidates.length === 0) return null;

  const sortedCandidates = [...candidates].toSorted((left, right) => {
    const leftSameDriver = left.driverKind === currentSummary.driverKind ? 0 : 1;
    const rightSameDriver = right.driverKind === currentSummary.driverKind ? 0 : 1;
    if (leftSameDriver !== rightSameDriver) return leftSameDriver - rightSameDriver;
    if (left.activeAgentCount !== right.activeAgentCount) {
      return left.activeAgentCount - right.activeAgentCount;
    }
    const leftRemaining = left.lowestRemainingPercent ?? 100;
    const rightRemaining = right.lowestRemainingPercent ?? 100;
    return rightRemaining - leftRemaining;
  });

  const bestCandidate = sortedCandidates[0];
  if (!bestCandidate) return null;

  const matchingModel = bestCandidate.models.find((model) => model.slug === currentSelection.model);
  const fallbackModel = matchingModel?.slug ?? bestCandidate.models[0]?.slug;
  if (!fallbackModel) return null;

  const nextSelection = createModelSelection(
    bestCandidate.instanceId,
    fallbackModel,
    matchingModel ? currentSelection.options : undefined,
  );

  return {
    selection: nextSelection,
    switchedFrom: currentSummary,
    switchedTo: bestCandidate,
    reason: isExhausted ? "cooldown" : isUnavailable ? "unavailable" : "near_limit",
  };
}

export function buildEffortOptionSelections(
  entry: ProviderInstanceEntry | undefined,
  modelSlug: string,
  effortValue: string | null,
): ProviderOptionSelections | undefined {
  if (!effortValue || effortValue.trim().length === 0) return undefined;
  const trimmed = effortValue.trim();
  const modelDef = entry?.models.find((model) => model.slug === modelSlug);
  const effortOptionGroup = modelDef?.capabilities?.optionDescriptors?.find(
    (opt) =>
      (opt.type === "select" && opt.role === "reasoning") ||
      opt.id === "effort" ||
      opt.id === "reasoningEffort" ||
      opt.id === "thinking",
  );
  const optionId = effortOptionGroup?.id ?? "effort";
  return [{ id: optionId, value: trimmed }];
}

export function extractEffortFromSelection(
  options: ProviderOptionSelections | undefined,
): string | null {
  if (!options || options.length === 0) return null;
  const found = options.find(
    (opt) => opt.id === "effort" || opt.id === "reasoningEffort" || opt.id === "thinking",
  );
  return typeof found?.value === "string" ? found.value : null;
}

export function parseProjectTeamConfig(rawContents: string | undefined | null): ProjectTeamConfig {
  if (!rawContents || rawContents.trim().length === 0) {
    return DEFAULT_PROJECT_TEAM_CONFIG;
  }
  try {
    const parsed = JSON.parse(rawContents) as Partial<ProjectTeamConfig>;
    const personas = Array.isArray(parsed.personas)
      ? parsed.personas.flatMap((item): ProjectPersona[] => {
          if (!item || typeof item !== "object") return [];
          const candidate = item as Record<string, unknown>;
          const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
          const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
          const role = typeof candidate.role === "string" ? candidate.role.trim() : "";
          if (!id || !name || !role) return [];
          return [
            {
              id,
              ...(typeof candidate.squadRoleKey === "string"
                ? { squadRoleKey: candidate.squadRoleKey as SquadRoleKey }
                : {}),
              ...(typeof candidate.category === "string"
                ? { category: candidate.category as PersonaCategory }
                : {}),
              name,
              role,
              ...(typeof candidate.jeito === "string" ? { jeito: candidate.jeito } : {}),
              ...(typeof candidate.pele === "string" ? { pele: candidate.pele } : {}),
              ...(typeof candidate.cabelo === "string" ? { cabelo: candidate.cabelo } : {}),
              ...(typeof candidate.roda === "string" ? { roda: candidate.roda } : {}),
              ...(typeof candidate.aprova === "string" ? { aprova: candidate.aprova } : {}),
              ...(typeof candidate.reprova === "string" ? { reprova: candidate.reprova } : {}),
              ...(typeof candidate.scalable === "boolean" ? { scalable: candidate.scalable } : {}),
              icon: typeof candidate.icon === "string" && candidate.icon ? candidate.icon : "🤖",
              color:
                typeof candidate.color === "string" && candidate.color
                  ? candidate.color
                  : "#6366f1",
              instanceId: ProviderInstanceId.make(
                typeof candidate.instanceId === "string" && candidate.instanceId
                  ? candidate.instanceId
                  : "default-codex",
              ),
              model: typeof candidate.model === "string" ? candidate.model : "",
              effort: typeof candidate.effort === "string" ? candidate.effort : null,
              allowedTools: Array.isArray(candidate.allowedTools)
                ? candidate.allowedTools.filter((t): t is string => typeof t === "string")
                : ["preview_*", "git_worktree", "terminal", "file_edit"],
              skills: Array.isArray(candidate.skills)
                ? candidate.skills.filter((s): s is string => typeof s === "string")
                : [`.t3/skills/${id}.md`],
              qualityChecklist: Array.isArray(candidate.qualityChecklist)
                ? candidate.qualityChecklist.filter((q): q is string => typeof q === "string")
                : [],
              systemPrompt:
                typeof candidate.systemPrompt === "string" ? candidate.systemPrompt : "",
            },
          ];
        })
      : [];

    const linkedRepos = Array.isArray(parsed.linkedRepos)
      ? parsed.linkedRepos.flatMap((repo): ProjectLinkedRepo[] => {
          if (!repo || typeof repo !== "object") return [];
          const candidate = repo as Record<string, unknown>;
          const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
          const label = typeof candidate.label === "string" ? candidate.label.trim() : id;
          const cwd = typeof candidate.cwd === "string" ? candidate.cwd.trim() : "";
          if (!id || !cwd) return [];
          return [
            {
              id,
              label,
              cwd,
              baseBranch:
                typeof candidate.baseBranch === "string" && candidate.baseBranch
                  ? candidate.baseBranch
                  : "main",
              donoDoContrato: candidate.donoDoContrato === true,
              leiaAntes: Array.isArray(candidate.leiaAntes)
                ? candidate.leiaAntes.filter((item): item is string => typeof item === "string")
                : [],
              validacao: Array.isArray(candidate.validacao)
                ? candidate.validacao.flatMap((v): ProjectLinkedRepoValidation[] => {
                    if (!v || typeof v !== "object") return [];
                    const valObj = v as Record<string, unknown>;
                    if (typeof valObj.id === "string" && typeof valObj.comando === "string") {
                      return [{ id: valObj.id, comando: valObj.comando }];
                    }
                    return [];
                  })
                : [],
            },
          ];
        })
      : [];

    return {
      version: 1,
      autoFallbackOnRateLimit: parsed.autoFallbackOnRateLimit !== false,
      fallbackThresholdPercent:
        typeof parsed.fallbackThresholdPercent === "number"
          ? Math.max(0, Math.min(50, parsed.fallbackThresholdPercent))
          : 15,
      ...(typeof parsed.workspacePresetId === "string"
        ? { workspacePresetId: parsed.workspacePresetId as OfficialWorkspacePresetId }
        : {}),
      ...(typeof parsed.workspaceContext === "string"
        ? { workspaceContext: parsed.workspaceContext }
        : {}),
      linkedRepos,
      personas,
    };
  } catch {
    return DEFAULT_PROJECT_TEAM_CONFIG;
  }
}

export function serializeProjectTeamConfig(config: ProjectTeamConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function buildPersonaSkillMarkdown(persona: ProjectPersona, projectName: string): string {
  const toolsList =
    persona.allowedTools.length > 0
      ? persona.allowedTools.map((tool) => `- \`${tool}\``).join("\n")
      : "- Todas as ferramentas padrão do ambiente";
  const checklist =
    persona.qualityChecklist.length > 0
      ? persona.qualityChecklist.map((item) => `- [ ] ${item}`).join("\n")
      : "- [ ] Código testado e sem regressões visuais ou de tipagem";
  const voiceBlock = persona.jeito
    ? `\n## Personalidade & Vereditos Oficiais\n- **Jeito:** ${persona.jeito}\n- **Ao rodar:** "${persona.roda ?? ""}"\n- **Aprova:** "${persona.aprova ?? "Aprovado."}"\n- **Reprova:** "${persona.reprova ?? "Reprovado."}"\n`
    : "";

  return `---
name: ${persona.id}
role: ${persona.role}
persona: ${persona.name}
project: ${projectName}
---

# ${persona.icon} ${persona.name}: ${persona.role}
${voiceBlock}
## Diretriz Principal
${persona.systemPrompt}

## Ferramentas & Skills Vinculadas
${toolsList}
${persona.skills.map((s) => `- Skill: \`${s}\``).join("\n")}

## Critérios de Qualidade Obrigatórios (Portão Ship-It)
Antes de declarar qualquer entrega como concluída, valide e apresente evidência real de cada item:
${checklist}
`;
}

export function formatPersonaDirectModePrompt(
  persona: ProjectPersona,
  userMessageText: string,
  extraContextBlock?: string | null,
): string {
  const checklistInline =
    persona.qualityChecklist.length > 0
      ? persona.qualityChecklist.map((item) => `  - ${item}`).join("\n")
      : "  - Validar compilação/tipagem e integridade visual antes de concluir.";
  const skillsInline =
    persona.skills.length > 0 ? `\n- Skills ativas: ${persona.skills.join(", ")}` : "";
  const voiceInline = persona.jeito
    ? `\n- Personalidade: ${persona.jeito} (Veredito aprova: "${persona.aprova ?? "OK"}" | reprova: "${persona.reprova ?? "Volta"}")`
    : "";

  return [
    `[COWORKER EM MODO DIRETO: ${persona.icon} ${persona.name} (${persona.role})]${voiceInline}`,
    `- Papel & Diretriz: ${persona.systemPrompt}`,
    `- Ferramentas foco: ${persona.allowedTools.join(", ") || "padrão"}${skillsInline}`,
    `- Portão de Evidência (Ship-It):\n${checklistInline}`,
    ...(extraContextBlock ? [extraContextBlock] : []),
    `---`,
    userMessageText,
  ].join("\n");
}

function resolvePersonaHandleString(persona: ProjectPersona): string {
  if (persona.handle && persona.handle.trim().length > 0) {
    const clean = persona.handle.trim();
    return clean.startsWith("@") ? clean : `@${clean}`;
  }
  const match = persona.name.match(/@([a-z0-9_-]+)/i);
  if (match?.[1]) {
    return `@${match[1]}`;
  }
  return `@${persona.id}`;
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatSquadWorkflowPrompt(input: {
  readonly mode: SquadWorkflowMode;
  readonly activePersona: ProjectPersona | null;
  readonly teamConfig: ProjectTeamConfig;
  readonly userMessageText: string;
  readonly currentStage?: SquadPipelineStageId | null | undefined;
}): string {
  const { mode, activePersona, teamConfig, userMessageText, currentStage } = input;
  const modeMeta =
    SQUAD_WORKFLOW_MODES.find((item) => item.id === mode) ?? SQUAD_WORKFLOW_MODES[0]!;
  const effectiveStage: SquadPipelineStageId | null =
    mode === "full_pipeline" ? (currentStage ?? "produto_spec") : (currentStage ?? null);

  const defaultPersona =
    teamConfig.personas.find(
      (item) =>
        item.id === modeMeta.defaultLeadPersonaId ||
        resolvePersonaHandleString(item) === `@${modeMeta.defaultLeadPersonaId}`,
    ) ??
    teamConfig.personas[0] ??
    null;

  const leadPersona = activePersona ?? defaultPersona;
  const personaId = leadPersona?.id ?? modeMeta.defaultLeadPersonaId;
  const personaName = leadPersona?.name ?? "Nina Prado (@lider)";
  const personaRole = leadPersona
    ? resolvePersonaShortRole(leadPersona)
    : mode === "mockup_turbo"
      ? "Design"
      : mode === "creative_studio"
        ? "Instagram & Copy"
        : "Líder";
  const personaHandle = leadPersona ? resolvePersonaHandleString(leadPersona) : "@lider";
  const personaIcon = leadPersona?.icon ?? "👑";
  const personaColor = leadPersona?.color ?? "#6366f1";

  const linkedRepos = teamConfig.linkedRepos ?? [];
  const contractOwnerRepo = linkedRepos.find((repo) => repo.donoDoContrato);

  const rosterLines =
    teamConfig.personas.length > 0
      ? teamConfig.personas
          .map((member) => {
            const handle = resolvePersonaHandleString(member);
            const shortRole = resolvePersonaShortRole(member);
            const isContractOwner =
              member.id.includes("api") ||
              member.id === "spec" ||
              Boolean(contractOwnerRepo && member.role.toLowerCase().includes("api"));
            return `  - ${member.icon} ${member.name} (${shortRole} · ${handle}) | providerInstanceId="${member.instanceId}" | model="${member.model}" | donoDoContrato=${isContractOwner ? "true" : "false"} | vereditos: roda="${member.roda ?? ""}", aprova="${member.aprova ?? "Aprovado."}", reprova="${member.reprova ?? "Volta."}" | diretriz: ${member.systemPrompt}`;
          })
          .join("\n")
      : "  - Equipe padrão ativa no workspace.";

  const reposLines =
    linkedRepos.length > 0
      ? linkedRepos
          .map(
            (repo) =>
              `  - ${repo.label} (${repo.cwd}) | branch="${repo.baseBranch}" | donoDoContrato=${repo.donoDoContrato ? "true" : "false"}`,
          )
          .join("\n")
      : "";

  const modeInstructions: string[] = [];

  if (mode === "mockup_turbo") {
    modeInstructions.push(
      "MODO ATIVO: Modo Fechar Mockup / Fidelidade Turbo (Zero burocracia de 5 pessoas).",
      "- Foco 100% em fechar UI/Mockup e fidelidade visual com agilidade.",
      '- Se múltiplas telas ou seções forem pedidas, você pode delegar workers de UI em paralelo via `delegate_task` com `isolation: "worktree"` usando as contas configuradas (`providerInstanceId` + `model`).',
      "- Respeite rigorosamente todos os itens travados (`code_truth`) de `.t3/product-map.json`.",
      "- Assim que uma tela estiver pronta, use `preview_status` / `preview_open` / `preview_snapshot` (ou `html_render`) para capturar evidência visual real, incorpore o print em Markdown e finalize a mensagem com `[PORTAO_APROVACAO: mockup_tela]` para exibir os botões de aprovação de tela no chat.",
    );
  } else if (mode === "full_pipeline") {
    const stageMeta =
      SQUAD_PIPELINE_STAGES.find((s) => s.id === effectiveStage) ?? SQUAD_PIPELINE_STAGES[0]!;
    modeInstructions.push(
      `MODO ATIVO: Feature Completa Orquestrada pela Nina Prado (@lider) · Etapa Atual: ${stageMeta.stepNumber}. ${stageMeta.title} (${stageMeta.id}).`,
      "- Antes do primeiro `delegate_task`, chame `orchestrator_capabilities` uma única vez na thread.",
      '- Use `delegate_task` passando `target: { providerInstanceId, model, options }` da configuração de cada especialista em `.t3/team.json` e `isolation: "worktree"` para tarefas de implementação e QA.',
      "- Etapas e Portões Obrigatórios:",
      "  1. Etapa 1 (`produto_spec`): Otto (@produto) e Iris (@spec) definem escopo enxuto e contrato da API -> finalize com `[PORTAO_APROVACAO: escopo_contrato]`.",
      "  2. Etapa 2 (`design`): Dora (@design) fecha os estados visuais e responsividade -> finalize com `[PORTAO_APROVACAO: design_visual]`.",
      "  3. Etapa 3 (`dev`): Repositório `donoDoContrato: true` (API) primeiro; depois múltiplos workers Web em worktrees paralelos.",
      "  4. Etapa 4 (`qa_e2e`): Quim (@qa) e Rui (@revisor) rodam `typecheck`/`lint`/`test` E teste E2E real no navegador via `preview_*` testando fluxo principal + variações (vazio, erro, mobile, desktop) + checagem de regressão do `.t3/product-map.json`. Se achar qualquer bug, corrija ou redelegue ao Dev antes de acionar o usuário.",
      "  5. Etapa 5 (`prints_aprovacao`): Lia (@entrega) captura prints desktop + mobile da feature pronta, incorpora em Markdown e finaliza com `[PORTAO_APROVACAO: aprovacao_final_100]`.",
    );
  } else if (mode === "creative_studio") {
    modeInstructions.push(
      "MODO ATIVO: Modo Estúdio Criativo (HTML Interativo & Imagens para Postar).",
      "- Para mockups ou comparativos HTML interativos: use `html_preview` e `html_render` para renderizar comparativos visuais direto no workspace.",
      "- Para posts de redes sociais / Instagram / marketing: gere HTML/canvas de alta resolução ou use geração de imagem + `html_render` nas dimensões exatas (`1080x1080` Feed, `1080x1350` Retrato/Carrossel, `1080x1920` Story), salve os arquivos `.png` dentro do projeto, incorpore no chat com Markdown `![titulo](/caminho/absoluto.png)` e link clicável do arquivo, e finalize com `[PORTAO_APROVACAO: arte_criativa]`.",
    );
  } else if (leadPersona) {
    modeInstructions.push(
      `MODO ATIVO: Conversa Direta com ${leadPersona.icon} ${leadPersona.name} (${leadPersona.role}).`,
      `- Diretriz Principal: ${leadPersona.systemPrompt}`,
      ...(leadPersona.jeito ? [`- Guia de Voz (Jeito): ${leadPersona.jeito}`] : []),
      `- Vereditos Oficiais: Ao rodar="${leadPersona.roda ?? ""}" | Aprova="${leadPersona.aprova ?? "Aprovado."}" | Reprova="${leadPersona.reprova ?? "Volta."}"`,
    );
  }

  const contextTag = [
    `<squad_workflow_context mode="${escapeXmlAttr(mode)}" personaId="${escapeXmlAttr(personaId)}" personaName="${escapeXmlAttr(personaName)}" personaRole="${escapeXmlAttr(personaRole)}" personaHandle="${escapeXmlAttr(personaHandle)}" personaIcon="${escapeXmlAttr(personaIcon)}" personaColor="${escapeXmlAttr(personaColor)}" stage="${escapeXmlAttr(effectiveStage ?? "")}">`,
    `REGRA DE ASSINATURA VISUAL OBRIGATÓRIA: Sempre inicie sua resposta visível com a linha exata:`,
    `[COWORKER: ${personaName} | ${personaRole} | ${personaHandle}]`,
    ...(modeInstructions.length > 0 ? ["", ...modeInstructions] : []),
    "",
    "SQUAD CONFIGURADO NESTE PROJETO (.t3/team.json):",
    rosterLines,
    ...(reposLines ? ["", "REPOSITÓRIOS VINCULADOS:", reposLines] : []),
    `</squad_workflow_context>`,
  ].join("\n");

  return `${contextTag}\n\n${userMessageText}`;
}

function createProviderBrainPicker(providerEntries: ReadonlyArray<ProviderInstanceEntry>) {
  const availableEntries = providerEntries.filter((entry) => entry.isAvailable);
  const pool = availableEntries.length > 0 ? availableEntries : providerEntries;

  return (
    preferredDrivers: ReadonlyArray<string>,
    preferredModelSubstrings: ReadonlyArray<string>,
    accountIndexOffset = 0,
  ) => {
    for (const driver of preferredDrivers) {
      const driverEntries = pool.filter((entry) => entry.driverKind === driver);
      if (driverEntries.length > 0) {
        const chosenEntry = driverEntries[accountIndexOffset % driverEntries.length]!;
        const matchedModel =
          chosenEntry.models.find((m) =>
            preferredModelSubstrings.some((sub) => m.slug.toLowerCase().includes(sub)),
          )?.slug ??
          chosenEntry.models[0]?.slug ??
          "default";
        return { instanceId: chosenEntry.instanceId, model: matchedModel };
      }
    }
    const fallbackEntry = pool[accountIndexOffset % Math.max(1, pool.length)];
    return {
      instanceId: fallbackEntry?.instanceId ?? ProviderInstanceId.make("default-codex"),
      model: fallbackEntry?.models[0]?.slug ?? "gpt-5-codex",
    };
  };
}

export function applyOfficialWorkspacePreset(input: {
  readonly presetId: OfficialWorkspacePresetId;
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
}): ProjectTeamConfig {
  const preset =
    OFFICIAL_WORKSPACE_PRESETS.find((item) => item.id === input.presetId) ??
    OFFICIAL_WORKSPACE_PRESETS[0]!;
  const pickBrain = createProviderBrainPicker(input.providerEntries);
  const personas = materializePresetPersonas({ preset, pickBrain });

  return {
    version: 1,
    autoFallbackOnRateLimit: true,
    fallbackThresholdPercent: 15,
    workspacePresetId: preset.id,
    workspaceContext: preset.workspaceContext,
    linkedRepos: preset.linkedRepos,
    personas,
  };
}

export function buildOfficialSquadPersonas(input: {
  readonly projectName: string;
  readonly projectCwd?: string | null | undefined;
  readonly filePaths: ReadonlyArray<string>;
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
}): ReadonlyArray<ProjectPersona> {
  const { projectName, projectCwd, filePaths, providerEntries } = input;
  const pickBrain = createProviderBrainPicker(providerEntries);

  const detectedPreset = detectOfficialWorkspacePreset({
    projectName,
    projectCwd,
    filePaths,
  });

  if (detectedPreset) {
    return materializePresetPersonas({
      preset: detectedPreset,
      pickBrain,
    });
  }

  const ninaBrain = pickBrain(["claudeAgent", "codex"], ["sonnet", "opus", "sol"], 0);
  const ottoBrain = pickBrain(["claudeAgent", "codex"], ["sonnet", "opus", "sol"], 0);
  const irisBrain = pickBrain(["codex", "claudeAgent"], ["sol", "sonnet", "opus"], 0);
  const caioBrain = pickBrain(["codex", "claudeAgent"], ["luna", "sol", "haiku"], 1);
  const doraBrain = pickBrain(["claudeAgent"], ["sonnet", "opus"], 0);
  const daviBrain = pickBrain(["codex", "claudeAgent"], ["sol", "luna", "sonnet"], 0);
  const quimBrain = pickBrain(["codex", "claudeAgent"], ["sol", "sonnet"], 1);
  const ruiBrain = pickBrain(["codex", "claudeAgent"], ["sol", "sonnet", "opus"], 0);
  const liaBrain = pickBrain(["codex", "claudeAgent"], ["luna", "haiku"], 1);

  return [
    {
      id: "principal",
      squadRoleKey: "principal",
      category: "comando",
      name: "Nina Prado (@lider)",
      role: "Coordenadora Principal (Chief of Staff)",
      jeito: "Organizada e direta. Odeia retrabalho.",
      pele: "#e9c3a3",
      cabelo: "#3a2a22",
      roda: "Organizei aqui:",
      aprova: "Fechado.",
      reprova: "Volta.",
      icon: "👑",
      color: "#6366f1",
      instanceId: ninaBrain.instanceId,
      model: ninaBrain.model,
      effort: "high",
      allowedTools: ["preview_*", "git_worktree", "terminal", "file_edit"],
      skills: ["lider-triagem", "squad", ".t3/skills/principal.md"],
      qualityChecklist: [
        "Escrever a ordem clara respeitando quem é o dono do contrato (api antes de web)",
        "Respeitar o Mapa do Produto (.t3/product-map.json) sem regredir componentes evoluídos",
        "Acionar spec/produto/crítico/revisão apenas quando agregar valor real sem burocracia",
      ],
      systemPrompt: `Você é Nina Prado, Coordenadora Principal (Chief of Staff) de ${projectName}. Organizada e direta, você odeia retrabalho. Em modo direto você resolve ou coordena a ordem sem burocracia, respeitando o perfil do projeto e os repositórios vinculados.`,
    },
    {
      id: "produto",
      squadRoleKey: "produto",
      category: "planejamento",
      name: "Otto Maia (@produto)",
      role: "Estrategista de Produto & Conversão",
      jeito: "Desconfiado de ideia bonita. Pergunta 'pra quem?' antes de tudo.",
      pele: "#c98f6b",
      cabelo: "#1f1a17",
      roda: "Avaliei o valor:",
      aprova: "Vale fazer.",
      reprova: "Não me convenceu.",
      icon: "🧭",
      color: "#f59e0b",
      instanceId: ottoBrain.instanceId,
      model: ottoBrain.model,
      effort: "medium",
      allowedTools: ["preview_*", "web_search", "file_edit"],
      skills: ["revenue-centric-design", "conversao-funil", ".t3/skills/produto.md"],
      qualityChecklist: [
        "Definir Hipótese de Valor: Para <segmento>, <mudança> deve mover <métrica> de <base> para <alvo>",
        "Encontrar a menor versão que testa a hipótese e o sinal para matar",
      ],
      systemPrompt: `Você é Otto Maia, responsável por Produto em ${projectName}. Desconfiado de ideia bonita, pergunta 'pra quem?' antes de tudo.`,
    },
    {
      id: "spec",
      squadRoleKey: "spec",
      category: "planejamento",
      name: "Iris Tanaka (@spec)",
      role: "Arquiteta de Spec & Contratos",
      jeito: "Lê o código inteiro antes de abrir a boca. Detalhista.",
      pele: "#f0d2b4",
      cabelo: "#15131a",
      roda: "Mapeei no código:",
      aprova: "Plano fechado.",
      reprova: "Plano ainda tem buraco.",
      icon: "📐",
      color: "#0ea5e9",
      instanceId: irisBrain.instanceId,
      model: irisBrain.model,
      effort: "high",
      allowedTools: ["terminal", "file_edit"],
      skills: ["contrato-api", ".t3/skills/spec.md"],
      qualityChecklist: [
        "Escrever Critérios de Aceite exatos: CA-n [repo] <dado/quando/então>",
        "Citar arquivo:linha reais e o vizinho-padrão a reutilizar",
      ],
      systemPrompt: `Você é Iris Tanaka, responsável por Spec em ${projectName}. Você lê o código real antes de abrir a boca e produz ordens executáveis com arquivo:linha, vizinho a imitar e critérios verificáveis.`,
    },
    {
      id: "critico",
      squadRoleKey: "critico",
      category: "planejamento",
      name: "Caio Brandão (@critico)",
      role: "Crítico de Plano & Guardião de Escopo",
      jeito: "Do contra por profissão. Só fala com prova na mão.",
      pele: "#b97a56",
      cabelo: "#5a2d1a",
      roda: "Tentei derrubar o plano:",
      aprova: "Procurei furo e não achei.",
      reprova: "Achei furo.",
      icon: "⚡",
      color: "#ef4444",
      instanceId: caioBrain.instanceId,
      model: caioBrain.model,
      effort: "medium",
      allowedTools: ["terminal"],
      skills: ["contrato-api", ".t3/skills/critico.md"],
      qualityChecklist: [
        "Conferir se o plano recria algo que já existe no repositório",
        "Conferir se API e Web descrevem exatamente o mesmo payload/contrato",
      ],
      systemPrompt: `Você é Caio Brandão, Crítico do squad em ${projectName}. Do contra por profissão, só fala com prova na mão.`,
    },
    {
      id: "design",
      squadRoleKey: "design",
      category: "execucao",
      name: "Dora Lins (@design)",
      role: "Diretora de Design & Mockups A/B/C",
      jeito: "Olho clínico. Não aprova tela que não viu funcionando.",
      pele: "#f3d9c4",
      cabelo: "#a23b5e",
      roda: "Olhei no navegador:",
      aprova: "Tá bonito e funciona.",
      reprova: "Ainda não tá no nível.",
      icon: "🎨",
      color: "#ec4899",
      instanceId: doraBrain.instanceId,
      model: doraBrain.model,
      effort: "high",
      allowedTools: ["preview_*", "file_edit"],
      skills: [
        "design-revisao",
        "mockups-abc",
        "impeccable",
        "better-ui",
        "emil-design-eng",
        ".t3/skills/design.md",
      ],
      qualityChecklist: [
        "Abrir o navegador embutido (preview_open -> preview_snapshot) em 360/390, 768 e 1280px",
        "Respeitar as rejeições do dono (proibido faixas decorativas/gradientes com cara de IA)",
      ],
      systemPrompt: `Você é Dora Lins, Designer de Fidelidade Visual em ${projectName}. Olho clínico: você nunca aprova tela que não viu funcionando no preview_* em 360px, 768px e 1280px.`,
    },
    {
      id: "dev",
      squadRoleKey: "dev",
      category: "execucao",
      name: "Davi Rocha (@dev)",
      role: "Engenheiro de Implementação Full-Stack",
      jeito: "Prático. Reaproveita antes de criar e testa antes de falar.",
      pele: "#d6a27e",
      cabelo: "#2b2118",
      roda: "Implementei e rodei:",
      aprova: "Entregue.",
      reprova: "Travou.",
      scalable: true,
      icon: "🛠️",
      color: "#10b981",
      instanceId: daviBrain.instanceId,
      model: daviBrain.model,
      effort: "high",
      allowedTools: ["preview_*", "git_worktree", "terminal", "file_edit"],
      skills: ["dev-tarefa", "portar-mockup", "contrato-api", ".t3/skills/dev.md"],
      qualityChecklist: [
        "Ler leiaAntes do repositório alvo e reaproveitar o vizinho-padrão antes de criar código novo",
        "Escrever/rodar teste primeiro e executar typecheck + lint + test antes de concluir",
      ],
      systemPrompt: `Você é Davi Rocha, Desenvolvedor Prático de ${projectName}. Reaproveita antes de criar e testa antes de falar.`,
    },
    {
      id: "qa",
      squadRoleKey: "qa",
      category: "qualidade",
      name: "Quim Barros (@qa)",
      role: "Engenheiro de QA & Testes de Ataque",
      jeito: "Parte do princípio de que tá quebrado. Feliz quando quebra.",
      pele: "#8f5d43",
      cabelo: "#111111",
      roda: "Tentei quebrar:",
      aprova: "Não consegui quebrar.",
      reprova: "Quebrei.",
      icon: "🧪",
      color: "#14b8a6",
      instanceId: quimBrain.instanceId,
      model: quimBrain.model,
      effort: "high",
      allowedTools: ["preview_*", "terminal", "file_edit"],
      skills: ["qa-evidencia", "break-ui", ".t3/skills/qa.md"],
      qualityChecklist: [
        "Reexecutar cada CA e validação no HEAD atual em provedor diferente do dev",
        "Executar bateria de ataques: limites, ausência, auth, 500/429, duplo clique e 360px",
      ],
      systemPrompt: `Você é Quim Barros, QA Independente de ${projectName}. Parte do princípio de que está quebrado e fica feliz quando quebra.`,
    },
    {
      id: "revisao",
      squadRoleKey: "revisao",
      category: "qualidade",
      name: "Rui Sampaio (@revisor)",
      role: "Revisor de Código & Experiência em 3 Eixos",
      jeito: "Compara linha por linha com o combinado. Sem pressa.",
      pele: "#e2b796",
      cabelo: "#7a7f86",
      roda: "Comparei com o plano:",
      aprova: "Bate com o combinado.",
      reprova: "Não bate com o combinado.",
      icon: "🔍",
      color: "#8b5cf6",
      instanceId: ruiBrain.instanceId,
      model: ruiBrain.model,
      effort: "medium",
      allowedTools: ["terminal", "preview_*"],
      skills: ["revisao-entrega", "design-revisao", ".t3/skills/revisao.md"],
      qualityChecklist: [
        "Julgar nos 3 eixos: aderência ao pedido, qualidade do código e experiência do usuário",
        "Citar arquivo:linha exato e regra violada em qualquer achado",
      ],
      systemPrompt: `Você é Rui Sampaio, Revisor de ${projectName}. Compara linha por linha o git diff com o combinado, sem pressa.`,
    },
    {
      id: "entrega",
      squadRoleKey: "entrega",
      category: "qualidade",
      name: "Lia Ferraz (@entrega)",
      role: "Especialista em Release & Pull Requests",
      jeito: "Capricha no PR. Nunca aperta merge.",
      pele: "#f1cfae",
      cabelo: "#c9892e",
      roda: "Empacotei:",
      aprova: "PR no jeito.",
      reprova: "Não dá pra abrir PR ainda.",
      icon: "📦",
      color: "#d97706",
      instanceId: liaBrain.instanceId,
      model: liaBrain.model,
      effort: "low",
      allowedTools: ["terminal"],
      skills: ["revisao-entrega", ".t3/skills/entrega.md"],
      qualityChecklist: [
        "Empacotar PR no formato do Luan: Em uma frase · Antes/Depois · O que foi pedido e aplicado",
        "Nunca apertar merge: a palavra final é sempre do Luan",
      ],
      systemPrompt: `Você é Lia Ferraz, responsável por Entrega e PRs em ${projectName}. Capricha na documentação do PR com evidências reais, mas nunca faz merge.`,
    },
  ];
}

export function suggestProjectTeam(input: {
  readonly projectName: string;
  readonly projectCwd?: string | null | undefined;
  readonly filePaths: ReadonlyArray<string>;
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
}): ProjectTeamConfig {
  const { projectName, projectCwd, filePaths, providerEntries } = input;
  const detectedPreset = detectOfficialWorkspacePreset({
    projectName,
    projectCwd,
    filePaths,
  });

  const personas = buildOfficialSquadPersonas({
    projectName,
    projectCwd,
    filePaths,
    providerEntries,
  });

  const linkedRepos: ReadonlyArray<ProjectLinkedRepo> = detectedPreset
    ? detectedPreset.linkedRepos
    : projectCwd
      ? [
          {
            id: "main",
            label: projectName,
            cwd: projectCwd,
            baseBranch: "main",
            donoDoContrato: true,
            leiaAntes: ["AGENTS.md", "README.md"],
            validacao: [
              { id: "VAL-1", comando: "npm run typecheck" },
              { id: "VAL-2", comando: "npm test" },
            ],
          },
        ]
      : [];

  return {
    version: 1,
    autoFallbackOnRateLimit: true,
    fallbackThresholdPercent: 15,
    ...(detectedPreset
      ? {
          workspacePresetId: detectedPreset.id,
          workspaceContext: detectedPreset.workspaceContext,
        }
      : {}),
    linkedRepos,
    personas,
  };
}

export const OFFICIAL_SQUAD_PERSONAS: ReadonlyArray<ProjectPersona> = (() => {
  const base = buildOfficialSquadPersonas({
    projectName: "Projeto",
    filePaths: [],
    providerEntries: [],
  });
  const byId = new Map<string, ProjectPersona>();
  for (const persona of base) {
    byId.set(persona.id, persona);
  }
  const pickBrain = createProviderBrainPicker([]);
  for (const preset of OFFICIAL_WORKSPACE_PRESETS) {
    for (const persona of materializePresetPersonas({ preset, pickBrain })) {
      if (!byId.has(persona.id)) {
        byId.set(persona.id, persona);
      }
    }
  }
  return Array.from(byId.values());
})();
