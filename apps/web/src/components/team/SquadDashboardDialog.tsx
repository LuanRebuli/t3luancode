import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import {
  BotIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FolderGit2Icon,
  LayersIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  RocketIcon,
  ShieldCheckIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { buildThreadRouteParams } from "../../threadRoutes";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import {
  type DispatchedEmployeeRecord,
  type LiveEmployeeViewItem,
  useDispatchedEmployeesStore,
} from "./ActiveEmployeesPanel";
import { CoworkerAvatar } from "./CoworkerAvatar";
import {
  type AccountLiveSummary,
  type ProjectPersona,
  type ProjectTeamConfig,
  resolvePersonaShortRole,
  resolveProviderBrandColor,
  resolveProviderBrandLabel,
  SQUAD_PIPELINE_STAGES,
  SQUAD_WORKFLOW_MODES,
  type SquadPipelineStageId,
  type SquadWorkflowMode,
} from "./projectTeam.logic";
import { useActivePersonaStore } from "./useProjectTeam";

export {
  resolvePersonaShortRole,
  resolveProviderBrandColor,
  resolveProviderBrandLabel,
  SQUAD_PIPELINE_STAGES,
  SQUAD_WORKFLOW_MODES,
  type SquadPipelineStageId,
  type SquadWorkflowMode,
};

export interface SquadWorkflowRecipeDefinition {
  readonly id: Exclude<SquadWorkflowMode, "direct">;
  readonly shortLabel: string;
  readonly title: string;
  readonly badge: string;
  readonly description: string;
  readonly ctaLabel: string;
}

export const DASHBOARD_WORKFLOW_RECIPES: ReadonlyArray<SquadWorkflowRecipeDefinition> = [
  {
    id: "mockup_turbo",
    shortLabel: "⚡ Mockup Turbo",
    title: "⚡ Fechar Mockup / Fidelidade Turbo",
    badge: "Worktrees Paralelos + Locks 🔒",
    description:
      "Solta Designers/Devs UI em paralelo por tela em git worktree respeitando travas 🔒 do Mapa do Produto + print antes/depois via preview_*.",
    ctaLabel: "Ativar Mockup Turbo",
  },
  {
    id: "full_pipeline",
    shortLabel: "🚀 Feature Completa",
    title: "🚀 Feature Completa (Orquestrada pela Nina)",
    badge: "delegate_task + 5 Etapas",
    description:
      "Ciclo completo com delegate_task real: Produto/Spec (Portão 1) -> Design (Portão 2) -> Dev Multi-Repo (API antes do Web) -> QA E2E & Variações -> Prints & Aprovação 100%.",
    ctaLabel: "Ativar Ciclo Completo",
  },
  {
    id: "creative_studio",
    shortLabel: "🎨 HTML & Posts",
    title: "🎨 Estúdio Criativo: HTML & Posts",
    badge: "html_preview + html_render",
    description:
      "Cria HTML interativo (html_preview + html_render) ou imagens .png prontas para postar (1080x1080, 1080x1350, 1080x1920).",
    ctaLabel: "Ativar Estúdio Criativo",
  },
];

export function extractPersonaFirstName(persona: ProjectPersona): string {
  const withoutHandle = persona.name.replace(/\s*\([^)]*\)\s*/g, "").trim();
  return withoutHandle.split(/\s+/)[0] || persona.name;
}

export function extractPersonaHandle(persona: ProjectPersona): string {
  if (persona.handle && persona.handle.trim().length > 0) {
    return persona.handle.startsWith("@") ? persona.handle : `@${persona.handle}`;
  }
  const match = persona.name.match(/\((@[^)]+)\)/);
  if (match?.[1]) return match[1];
  return `@${persona.id}`;
}

interface SquadDashboardDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly environmentId: EnvironmentId;
  readonly routeThreadKey: string;
  readonly projectName: string | null;
  readonly teamConfig: ProjectTeamConfig;
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
  readonly accountSummaries: ReadonlyArray<AccountLiveSummary>;
  readonly liveEmployees: ReadonlyArray<LiveEmployeeViewItem>;
  readonly activePersonaId: string | null;
  readonly autoFallbackEnabled: boolean;
  readonly onToggleAutoFallback: (enabled: boolean) => void;
  readonly onSelectDirectPersona: (persona: ProjectPersona | null) => void;
  readonly onActivateWorkflowRecipe: (mode: SquadWorkflowMode) => void;
  readonly onOpenDispatcher: () => void;
  readonly onOpenProductMap: () => void;
  readonly onOpenTeamConfig: () => void;
}

export function SquadDashboardDialog({
  open,
  onOpenChange,
  routeThreadKey,
  projectName,
  teamConfig,
  providerEntries,
  accountSummaries,
  liveEmployees,
  activePersonaId,
  autoFallbackEnabled,
  onToggleAutoFallback,
  onSelectDirectPersona,
  onActivateWorkflowRecipe,
  onOpenDispatcher,
  onOpenProductMap,
  onOpenTeamConfig,
}: SquadDashboardDialogProps) {
  const navigate = useNavigate();

  const currentWorkflowMode = useActivePersonaStore(
    (s) => (routeThreadKey ? s.workflowModeByThreadKey[routeThreadKey] : undefined) ?? "direct",
  );
  const currentPipelineStage = useActivePersonaStore(
    (s) =>
      (routeThreadKey ? s.pipelineStageByThreadKey[routeThreadKey] : undefined) ?? "produto_spec",
  );
  const setPipelineStage = useActivePersonaStore((s) => s.setPipelineStage);

  const dispatchedByKey = useDispatchedEmployeesStore((s) => s.recordsByThreadKey);
  const dispatchedRecords = Object.values(dispatchedByKey);

  const workingCount = liveEmployees.filter((item) => item.status === "working").length;

  const handleOpenDispatchedThread = (
    envId: EnvironmentId,
    threadId: LiveEmployeeViewItem["threadId"],
  ) => {
    const ref = scopeThreadRef(envId, threadId);
    onOpenChange(false);
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(ref),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex max-h-[88vh] max-w-5xl flex-col">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-2">
              <LayoutDashboardIcon className="size-5 text-primary" />
              <DialogTitle>
                Sala do Squad · Visão Geral em Tempo Real ({projectName ?? "Estúdio"})
              </DialogTitle>
              {workingCount > 0 ? (
                <Badge variant="default" size="sm">
                  {workingCount} trabalhando agora
                </Badge>
              ) : (
                <Badge variant="secondary" size="sm">
                  {teamConfig.personas.length} especialistas prontos
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  onOpenChange(false);
                  onOpenDispatcher();
                }}
              >
                <RocketIcon className="size-3.5 text-primary" />
                Escalar Squad
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  onOpenChange(false);
                  onOpenProductMap();
                }}
              >
                <ShieldCheckIcon className="size-3.5 text-primary" />
                Mapa 🔒
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  onOpenChange(false);
                  onOpenTeamConfig();
                }}
              >
                <UsersIcon className="size-3.5" />
                Configurar Equipe
              </Button>
            </div>
          </div>
          <DialogDescription>
            Acompanhe o consumo oficial das contas de IA, ative receitas de fluxo em 1 clique,
            controle as etapas do pipeline e converse direto ou inspecione qualquer membro do Squad.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 pr-1">
            {/* 1. Top Strip: Consumo & Saúde das Contas de IA */}
            <section className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/60 p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ZapIcon className="size-4 text-warning" />
                  <h3 className="font-semibold text-foreground text-xs">
                    1. Consumo &amp; Saúde das Contas de IA Conectadas
                  </h3>
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-2.5 py-1 text-2xs">
                  <span className="font-medium text-foreground">Auto-Fallback de Cota (85%)</span>
                  <input
                    type="checkbox"
                    checked={autoFallbackEnabled}
                    onChange={(e) => onToggleAutoFallback(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {accountSummaries.map((summary) => {
                  const brandColor = resolveProviderBrandColor(
                    summary.driverKind,
                    summary.accentColor,
                  );
                  const brandLabel = resolveProviderBrandLabel(summary.driverKind);
                  const cleanName =
                    summary.displayName.replace(/\s*\([^)]*\)\s*/g, "").trim() ||
                    summary.displayName;
                  const remaining = summary.lowestRemainingPercent;
                  const isCooldown = summary.state === "cooldown";
                  const isLow =
                    summary.state === "near_limit" || (remaining !== null && remaining <= 15);

                  return (
                    <div
                      key={summary.instanceId}
                      className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/75 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            aria-hidden
                            className={`size-2.5 shrink-0 rounded-full ${
                              isCooldown ? "bg-error" : isLow ? "bg-warning" : ""
                            }`}
                            style={
                              !isCooldown && !isLow ? { backgroundColor: brandColor } : undefined
                            }
                          />
                          <span className="truncate font-semibold text-foreground text-xs">
                            {cleanName}
                          </span>
                          <span
                            className="rounded px-1.5 py-0.5 font-semibold text-3xs"
                            style={{
                              color: brandColor,
                              backgroundColor: `${brandColor}1a`,
                            }}
                          >
                            {brandLabel}
                          </span>
                        </div>
                        {summary.activeAgentCount > 0 ? (
                          <Badge variant="default" size="sm">
                            {summary.activeAgentCount} trabalhando agora
                          </Badge>
                        ) : (
                          <span className="text-3xs text-muted-foreground">
                            {summary.stateLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-2xs">
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className={`absolute inset-y-0 left-0 rounded-full ${
                              isCooldown ? "bg-error" : isLow ? "bg-warning" : ""
                            }`}
                            style={{
                              width: `${Math.max(0, Math.min(100, remaining ?? 100))}%`,
                              ...(!isCooldown && !isLow ? { backgroundColor: brandColor } : {}),
                            }}
                          />
                        </div>
                        <span
                          className={
                            isCooldown
                              ? "font-semibold text-error tabular-nums"
                              : isLow
                                ? "font-semibold text-warning tabular-nums"
                                : "font-medium text-foreground tabular-nums"
                          }
                        >
                          {remaining !== null ? `${remaining}% livre` : "100% livre"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-3xs text-muted-foreground">
                        <span>
                          {summary.mostConstrainedWindow
                            ? `Janela: ${summary.mostConstrainedWindow.label}`
                            : `Modelos: ${summary.models.length}`}
                        </span>
                        {summary.resetsIn ? <span>Reseta em {summary.resetsIn}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 2. 3 Receitas de Fluxo de 1 Clique (Cards Interativos) */}
            <section className="flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RocketIcon className="size-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-xs">
                    2. Receitas de Fluxo de 1 Clique (Modos de Trabalho do Estúdio)
                  </h3>
                </div>
                {currentWorkflowMode !== "direct" ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onActivateWorkflowRecipe("direct")}
                  >
                    Voltar ao Modo Direto Padrão
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {DASHBOARD_WORKFLOW_RECIPES.map((recipe) => {
                  const isActive = currentWorkflowMode === recipe.id;
                  return (
                    <div
                      key={recipe.id}
                      className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                        isActive
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border/80 bg-card/60 hover:border-border"
                      }`}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground text-xs">
                            {recipe.title}
                          </span>
                          <Badge variant={isActive ? "default" : "outline"} size="sm">
                            {isActive ? "Ativo" : recipe.badge}
                          </Badge>
                        </div>
                        <p className="text-2xs text-muted-foreground leading-relaxed">
                          {recipe.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Button
                          variant={isActive ? "default" : "secondary"}
                          size="xs"
                          onClick={() => onActivateWorkflowRecipe(isActive ? "direct" : recipe.id)}
                        >
                          {recipe.id === "mockup_turbo" ? (
                            <ZapIcon className="size-3.5" />
                          ) : recipe.id === "full_pipeline" ? (
                            <RocketIcon className="size-3.5" />
                          ) : (
                            <PaletteIcon className="size-3.5" />
                          )}
                          {isActive ? "Receita Ativa (Desativar)" : recipe.ctaLabel}
                        </Button>
                        {recipe.id === "mockup_turbo" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              onActivateWorkflowRecipe("mockup_turbo");
                              onOpenChange(false);
                              onOpenDispatcher();
                            }}
                          >
                            Escalar Telas em Paralelo
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. Visual 5-Stage Pipeline Stepper */}
            <section className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/50 p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LayersIcon className="size-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-xs">
                    3. Pipeline Oficial de 5 Etapas &amp; Portões de Qualidade
                  </h3>
                </div>
                <span className="text-2xs text-muted-foreground">
                  Clique em qualquer etapa para sincronizar o estágio ativo da thread atual
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                {SQUAD_PIPELINE_STAGES.map((stage) => {
                  const isCurrentStage = currentPipelineStage === stage.id;
                  const normalizedOwnerHandles = stage.ownerHandles.map((h) =>
                    h.replace(/^@/, "").toLowerCase(),
                  );
                  const stageOwners = teamConfig.personas.filter((p) => {
                    const pid = p.id.toLowerCase();
                    const phandle = extractPersonaHandle(p).replace(/^@/, "").toLowerCase();
                    return (
                      normalizedOwnerHandles.includes(pid) ||
                      normalizedOwnerHandles.includes(phandle)
                    );
                  });

                  const badgeText =
                    stage.gateLabel ?? (stage.id === "dev" ? "API -> Web" : "QA & Revisão");

                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => {
                        if (routeThreadKey) {
                          setPipelineStage(routeThreadKey, stage.id);
                        }
                      }}
                      className={`flex flex-col justify-between gap-2 rounded-lg border p-2.5 text-left transition-all ${
                        isCurrentStage
                          ? "border-primary bg-primary/15 text-foreground shadow-2xs"
                          : "border-border/60 bg-background/70 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-semibold text-2xs text-foreground">
                            {stage.shortTitle}
                          </span>
                          <Badge variant={isCurrentStage ? "default" : "outline"} size="sm">
                            {badgeText}
                          </Badge>
                        </div>
                        <p className="text-3xs text-muted-foreground leading-snug">
                          {stage.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {stageOwners.length > 0 ? (
                          stageOwners.map((owner) => (
                            <span
                              key={owner.id}
                              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-1.5 py-0.5 text-3xs text-foreground"
                            >
                              <CoworkerAvatar
                                color={owner.color}
                                shape={owner.id === "principal" ? "orb" : "cube"}
                                size="xs"
                              />
                              {extractPersonaFirstName(owner)}
                            </span>
                          ))
                        ) : (
                          <span className="text-3xs text-muted-foreground">
                            {stage.ownerHandles.join(" · ")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 4. Grid de Membros do Squad em Tempo Real */}
            <section className="flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BotIcon className="size-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-xs">
                    4. Grid de Membros do Squad em Tempo Real ({teamConfig.personas.length})
                  </h3>
                </div>
                <span className="text-2xs text-muted-foreground">
                  Veja qual IA equipa cada especialista, status ao vivo e vereditos oficiais
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {teamConfig.personas.map((persona) => {
                  const shortRole = resolvePersonaShortRole(persona);
                  const handle = extractPersonaHandle(persona);
                  const cleanDisplayName = persona.name.replace(/\s*\([^)]*\)\s*/g, "").trim();

                  const accountEntry = providerEntries.find(
                    (entry) => entry.instanceId === persona.instanceId,
                  );
                  const brandColor = resolveProviderBrandColor(
                    accountEntry?.driverKind,
                    accountEntry?.accentColor,
                  );
                  const brandLabel = resolveProviderBrandLabel(accountEntry?.driverKind);

                  const runningLiveItem = liveEmployees.find(
                    (item) => item.personaId === persona.id && item.status === "working",
                  );
                  const anyLiveItem =
                    runningLiveItem ?? liveEmployees.find((item) => item.personaId === persona.id);
                  const dispatchedRecord: DispatchedEmployeeRecord | undefined =
                    dispatchedRecords.find((rec) => rec.personaId === persona.id);

                  const isDirectInCurrentChat = activePersonaId === persona.id;

                  const liveStatusKind: "working" | "active_chat" | "completed" | "idle" =
                    runningLiveItem
                      ? "working"
                      : isDirectInCurrentChat
                        ? "active_chat"
                        : anyLiveItem || dispatchedRecord
                          ? "completed"
                          : "idle";

                  const liveStatusLabel =
                    liveStatusKind === "working"
                      ? "Trabalhando agora"
                      : liveStatusKind === "active_chat"
                        ? "Ativo neste chat"
                        : liveStatusKind === "completed"
                          ? "Concluído recentemente"
                          : "Ocioso / Pronto";

                  return (
                    <div
                      key={persona.id}
                      className={`flex flex-col justify-between gap-3 rounded-xl border p-3 transition-all ${
                        liveStatusKind === "working" || liveStatusKind === "active_chat"
                          ? "border-primary/80 bg-card shadow-2xs"
                          : "border-border/80 bg-card/60"
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        {/* Header: Avatar + Name + Role Badge + Handle */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <CoworkerAvatar
                              color={persona.color}
                              shape={
                                persona.id === "principal" || persona.id === "lider"
                                  ? "orb"
                                  : "cube"
                              }
                              size="md"
                              status={
                                liveStatusKind === "working"
                                  ? "working"
                                  : liveStatusKind === "active_chat"
                                    ? "ready"
                                    : "idle"
                              }
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate font-semibold text-foreground text-xs">
                                  {persona.icon} {cleanDisplayName}
                                </span>
                                <Badge variant="secondary" size="sm">
                                  {shortRole}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 text-3xs text-muted-foreground">
                                <span className="font-mono">{handle}</span>
                                <span>·</span>
                                <span className="truncate">{persona.role}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Conta / IA Vinculada pill */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-border/60 bg-background/70 px-2 py-1 text-2xs">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: brandColor }}
                            />
                            <span className="font-semibold text-3xs" style={{ color: brandColor }}>
                              {brandLabel}
                            </span>
                            <span className="truncate text-3xs text-foreground">
                              {accountEntry?.displayName ?? persona.instanceId}
                            </span>
                          </div>
                          <span className="truncate font-mono text-3xs text-muted-foreground">
                            {persona.model}
                            {persona.effort ? ` (${persona.effort})` : ""}
                          </span>
                        </div>

                        {/* Status ao Vivo */}
                        <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/30 p-2 text-2xs">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-medium text-3xs text-muted-foreground uppercase">
                              Status ao Vivo
                            </span>
                            <Badge
                              variant={
                                liveStatusKind === "working"
                                  ? "default"
                                  : liveStatusKind === "active_chat"
                                    ? "secondary"
                                    : "outline"
                              }
                              size="sm"
                            >
                              {liveStatusLabel}
                            </Badge>
                          </div>

                          {anyLiveItem ? (
                            <div className="flex flex-col gap-0.5 pt-0.5 text-3xs">
                              <span className="truncate font-medium text-foreground">
                                {anyLiveItem.taskTitle}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                                <span className="inline-flex items-center gap-1 text-primary">
                                  <FolderGit2Icon className="size-3" />
                                  {anyLiveItem.repoLabel}
                                </span>
                                {anyLiveItem.branchLabel ? (
                                  <span className="font-mono">({anyLiveItem.branchLabel})</span>
                                ) : null}
                              </div>
                            </div>
                          ) : dispatchedRecord ? (
                            <div className="flex flex-col gap-0.5 pt-0.5 text-3xs">
                              <span className="truncate font-medium text-foreground">
                                {dispatchedRecord.taskSummary}
                              </span>
                              <span className="text-muted-foreground">
                                Repo: {dispatchedRecord.repoLabel}
                              </span>
                            </div>
                          ) : (
                            <span className="text-3xs text-muted-foreground italic">
                              {persona.jeito ?? "Pronto para assumir tarefa ou revisão."}
                            </span>
                          )}
                        </div>

                        {/* Official verdicts preview */}
                        <div className="flex flex-wrap items-center gap-1.5 text-3xs">
                          <span className="inline-flex items-center gap-1 rounded bg-success/15 px-1.5 py-0.5 font-medium text-success">
                            <CheckCircle2Icon className="size-2.5" />
                            Aprova: &ldquo;{persona.aprova ?? "Aprovado."}&rdquo;
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-error/15 px-1.5 py-0.5 font-medium text-error">
                            Reprova: &ldquo;{persona.reprova ?? "Volta."}&rdquo;
                          </span>
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center justify-end gap-1.5 border-t border-border/50 pt-2">
                        {anyLiveItem ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              handleOpenDispatchedThread(
                                anyLiveItem.environmentId,
                                anyLiveItem.threadId,
                              )
                            }
                          >
                            <ExternalLinkIcon className="size-3" />
                            Abrir Thread
                          </Button>
                        ) : dispatchedRecord ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              handleOpenDispatchedThread(
                                dispatchedRecord.environmentId,
                                dispatchedRecord.threadId,
                              )
                            }
                          >
                            <ExternalLinkIcon className="size-3" />
                            Abrir Thread
                          </Button>
                        ) : null}
                        <Button
                          variant={isDirectInCurrentChat ? "default" : "secondary"}
                          size="xs"
                          onClick={() => {
                            onSelectDirectPersona(isDirectInCurrentChat ? null : persona);
                            onOpenChange(false);
                          }}
                        >
                          {isDirectInCurrentChat ? "Ativo neste Chat" : "Falar Direto"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Fechar Sala do Squad</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
