import {
  type EnvironmentId,
  type ModelSelection,
  ProviderInstanceId,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import {
  BotIcon,
  CpuIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  RocketIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { useComposerDraftStore } from "../../composerDraftStore";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { useProjects } from "../../state/entities";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  ActiveEmployeesPanel,
  useDispatchedEmployeesStore,
  useLiveEmployeesList,
} from "./ActiveEmployeesPanel";
import { CoworkerAvatar } from "./CoworkerAvatar";
import { ProductMapDialog } from "./ProductMapDialog";
import {
  type AccountLiveSummary,
  buildEffortOptionSelections,
  EFFORT_OPTIONS,
  extractEffortFromSelection,
  type ProjectPersona,
  resolvePersonaShortRole,
  resolveProviderBrandColor,
  resolveProviderBrandLabel,
  type SquadWorkflowMode,
} from "./projectTeam.logic";
import { ProjectTeamDialog } from "./ProjectTeamDialog";
import { extractPersonaFirstName, SquadDashboardDialog } from "./SquadDashboardDialog";
import { SquadDispatcherDialog } from "./SquadDispatcherDialog";
import {
  type StudioModalKind,
  useAccountLiveSummaries,
  useActivePersonaStore,
  useProjectTeam,
} from "./useProjectTeam";

interface StudioAccountsAndTeamBarProps {
  readonly environmentId: EnvironmentId;
  readonly routeThreadKey: string;
  readonly activeThreadRef: ScopedThreadRef | null;
  readonly projectCwd: string | null;
  readonly projectName: string | null;
  readonly providerInstanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  readonly activeProviderInstanceId: ProviderInstanceId | null;
  readonly currentModelSelection: ModelSelection | null;
  readonly onProviderModelSelect: (
    instanceId: ProviderInstanceId,
    model: string,
    options?: { focusComposer?: boolean },
  ) => void;
  readonly onOpenProviderSetup: (instanceId: ProviderInstanceId) => void;
}

const WORKFLOW_RECIPE_BUTTONS: ReadonlyArray<{
  readonly mode: Exclude<SquadWorkflowMode, "direct">;
  readonly label: string;
  readonly description: string;
}> = [
  {
    mode: "mockup_turbo",
    label: "⚡ Mockup Turbo",
    description:
      "Solta Designers/Devs UI em paralelo por tela respeitando travas 🔒 do Mapa do Produto + print antes/depois via preview_*.",
  },
  {
    mode: "full_pipeline",
    label: "🚀 Feature Completa",
    description:
      "Ciclo completo com delegate_task real: Produto/Spec -> Design -> Dev Multi-Repo (API antes do Web) -> QA E2E -> Prints 100%.",
  },
  {
    mode: "creative_studio",
    label: "🎨 HTML & Posts",
    description:
      "Estúdio Criativo: gera HTML interativo (html_preview + html_render) ou imagens .png prontas para Instagram.",
  },
];

export function StudioAccountsAndTeamBar(props: StudioAccountsAndTeamBarProps) {
  const {
    environmentId,
    routeThreadKey,
    activeThreadRef,
    projectCwd,
    projectName,
    providerInstanceEntries,
    activeProviderInstanceId,
    currentModelSelection,
    onProviderModelSelect,
    onOpenProviderSetup,
  } = props;

  const projects = useProjects();
  const activeProject =
    projectCwd !== null
      ? (projects.find(
          (p) =>
            p.environmentId === environmentId &&
            p.workspaceRoot.toLowerCase().replace(/\\/g, "/") ===
              projectCwd.toLowerCase().replace(/\\/g, "/"),
        ) ?? null)
      : null;

  const accountSummaries = useAccountLiveSummaries(providerInstanceEntries);
  const {
    teamConfig,
    productMapConfig,
    saveTeamConfig,
    saveProductMapConfig,
    suggestAndSaveTeam,
    suggestAndSaveProductMap,
  } = useProjectTeam({
    environmentId,
    projectCwd,
    projectName,
    providerInstanceEntries,
  });

  const activePersona = useActivePersonaStore(
    (state) => state.activePersonaByThreadKey[routeThreadKey] ?? null,
  );
  const currentWorkflowMode = useActivePersonaStore(
    (s) => (routeThreadKey ? s.workflowModeByThreadKey[routeThreadKey] : undefined) ?? "direct",
  );
  const setWorkflowMode = useActivePersonaStore((s) => s.setWorkflowMode);
  const autoFallbackEnabled = useActivePersonaStore((state) => state.autoFallbackEnabled);
  const activeStudioDialog = useActivePersonaStore((state) => state.activeStudioDialog);
  const setActivePersona = useActivePersonaStore((state) => state.setActivePersona);
  const setAutoFallbackEnabled = useActivePersonaStore((state) => state.setAutoFallbackEnabled);
  const setActiveStudioDialog = useActivePersonaStore((state) => state.setActiveStudioDialog);

  const dispatchedByKey = useDispatchedEmployeesStore((s) => s.recordsByThreadKey);
  const dispatchedPersonaIds = new Set(Object.values(dispatchedByKey).map((rec) => rec.personaId));

  const setComposerDraftModelSelection = useComposerDraftStore((store) => store.setModelSelection);
  const setStickyComposerModelSelection = useComposerDraftStore(
    (store) => store.setStickyModelSelection,
  );

  const [isSuggestingInline, setIsSuggestingInline] = useState(false);
  const [localDashboardOpen, setLocalDashboardOpen] = useState(false);

  const isDashboardDialogOpen =
    localDashboardOpen ||
    activeStudioDialog === "dashboard" ||
    activeStudioDialog === "squad-dashboard";

  const handleOpenDashboardChange = (nextOpen: boolean) => {
    setLocalDashboardOpen(nextOpen);
    if (
      !nextOpen &&
      (activeStudioDialog === "dashboard" || activeStudioDialog === "squad-dashboard")
    ) {
      setActiveStudioDialog(null);
    }
  };

  const linkedRepos = teamConfig.linkedRepos ?? [];
  const liveEmployees = useLiveEmployeesList({
    activeProjectCwd: projectCwd,
    linkedRepoCwds: linkedRepos.map((r) => r.cwd),
    personas: teamConfig.personas,
    providerEntries: providerInstanceEntries,
  });
  const workingEmployeesCount = liveEmployees.filter((e) => e.status === "working").length;

  const activeAccountSummary =
    accountSummaries.find((summary) => summary.instanceId === activeProviderInstanceId) ??
    accountSummaries[0] ??
    null;

  const activeEntry =
    providerInstanceEntries.find((entry) => entry.instanceId === activeProviderInstanceId) ??
    providerInstanceEntries[0];

  const currentModelSlug = currentModelSelection?.model ?? activeEntry?.models[0]?.slug ?? "";
  const currentEffort = extractEffortFromSelection(currentModelSelection?.options);

  const applyAccountModelAndEffort = (
    instanceId: ProviderInstanceId,
    modelSlug: string,
    effortValue: string | null,
  ) => {
    const entry = providerInstanceEntries.find((item) => item.instanceId === instanceId);
    const resolvedModel =
      entry?.models.find((m) => m.slug === modelSlug)?.slug ?? entry?.models[0]?.slug ?? modelSlug;
    if (!resolvedModel) return;

    onProviderModelSelect(instanceId, resolvedModel, { focusComposer: true });

    const options = buildEffortOptionSelections(entry, resolvedModel, effortValue);
    if (activeThreadRef) {
      const nextSelection: ModelSelection = options
        ? { instanceId, model: resolvedModel, options }
        : { instanceId, model: resolvedModel };
      setComposerDraftModelSelection(activeThreadRef, nextSelection, {
        explicit: true,
        replaceOptions: true,
      });
      setStickyComposerModelSelection(nextSelection);
    }
  };

  const handleSelectAccountChip = (summary: AccountLiveSummary) => {
    const targetModel =
      summary.models.find((m) => m.slug === currentModelSlug)?.slug ?? summary.models[0]?.slug;
    if (!targetModel) {
      onOpenProviderSetup(summary.instanceId);
      return;
    }
    applyAccountModelAndEffort(summary.instanceId, targetModel, currentEffort);
  };

  const handleActivateDirectPersona = (persona: ProjectPersona | null) => {
    setActivePersona(routeThreadKey, persona);
    if (!persona) return;
    applyAccountModelAndEffort(persona.instanceId, persona.model, persona.effort);
    const assignedAccount = providerInstanceEntries.find(
      (entry) => entry.instanceId === persona.instanceId,
    );
    toastManager.add({
      type: "info",
      title: `${persona.icon} Modo Direto: ${persona.name}`,
      description: `Cérebro ativo: ${assignedAccount?.displayName ?? persona.instanceId} · ${persona.model}${
        persona.effort ? ` (${persona.effort})` : ""
      }`,
      timeout: 3_500,
    });
  };

  const handleToggleWorkflowRecipe = (targetMode: SquadWorkflowMode) => {
    const nextMode: SquadWorkflowMode = currentWorkflowMode === targetMode ? "direct" : targetMode;

    if (routeThreadKey) {
      setWorkflowMode(routeThreadKey, nextMode);
    }

    if (nextMode === "direct") {
      toastManager.add({
        type: "info",
        title: "Modo Direto Padrão ativado",
        description: "Converse diretamente com qualquer membro do Squad.",
        timeout: 2_500,
      });
      return;
    }

    if (!activePersona && teamConfig.personas.length > 0) {
      let autoLead: ProjectPersona | undefined;
      if (nextMode === "full_pipeline") {
        autoLead =
          teamConfig.personas.find(
            (p) => p.id === "principal" || p.id === "lider" || p.squadRoleKey === "principal",
          ) ?? teamConfig.personas[0];
      } else if (nextMode === "mockup_turbo") {
        autoLead =
          teamConfig.personas.find((p) => p.id === "design" || p.squadRoleKey === "design") ??
          teamConfig.personas[0];
      } else if (nextMode === "creative_studio") {
        autoLead =
          teamConfig.personas.find(
            (p) =>
              p.id.includes("conteudo") ||
              p.id.includes("insta") ||
              p.id === "design" ||
              p.squadRoleKey === "design",
          ) ?? teamConfig.personas[0];
      }
      if (autoLead) {
        handleActivateDirectPersona(autoLead);
      }
    }

    const recipeLabel = WORKFLOW_RECIPE_BUTTONS.find((r) => r.mode === nextMode)?.label ?? nextMode;
    toastManager.add({
      type: "success",
      title: `Receita Ativa: ${recipeLabel}`,
      description:
        nextMode === "full_pipeline"
          ? "Ciclo completo em 5 etapas com portões de aprovação e delegate_task ativo."
          : nextMode === "mockup_turbo"
            ? "Foco em fidelidade visual, travas do Mapa 🔒 e prints antes/depois no preview_*."
            : "Estúdio Criativo ativo para HTML interativo e posts .png.",
      timeout: 3_500,
    });
  };

  const handleToggleAutoFallback = (checked: boolean) => {
    setAutoFallbackEnabled(checked);
    if (projectCwd) {
      void saveTeamConfig({
        ...teamConfig,
        autoFallbackOnRateLimit: checked,
      });
    }
  };

  const handleQuickSuggest = async () => {
    setIsSuggestingInline(true);
    try {
      const created = await suggestAndSaveTeam();
      if (created && created.personas[0]) {
        handleActivateDirectPersona(created.personas[0]);
      }
    } finally {
      setIsSuggestingInline(false);
    }
  };

  if (providerInstanceEntries.length === 0 && !projectCwd) {
    return null;
  }

  return (
    <div
      data-studio-accounts-team-bar="true"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/25 px-3 py-1.5 text-xs sm:px-5"
    >
      {/* Left Side: Sleek Official AI Brand Provider Account Pills (no "Contas:" label) */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {accountSummaries.map((summary) => {
          const isSelected = summary.instanceId === activeProviderInstanceId;
          const remaining = summary.lowestRemainingPercent;
          const brandColor = resolveProviderBrandColor(summary.driverKind, summary.accentColor);
          const brandLabel = resolveProviderBrandLabel(summary.driverKind);
          const cleanName =
            summary.displayName.replace(/\s*\([^)]*\)\s*/g, "").trim() || summary.displayName;
          const isCooldown = summary.state === "cooldown";
          const isLow = summary.state === "near_limit" || (remaining !== null && remaining <= 15);
          const isLowOrCooldown = isCooldown || isLow;
          const percent = Math.max(0, Math.min(100, remaining ?? 100));

          return (
            <Tooltip key={summary.instanceId}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => handleSelectAccountChip(summary)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-2xs transition-colors ${
                      isSelected
                        ? "border-primary/80 bg-primary/10 font-semibold text-foreground shadow-2xs"
                        : "border-border/60 bg-background/70 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  />
                }
              >
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${
                    isCooldown ? "bg-error" : isLow ? "bg-warning" : ""
                  }`}
                  style={
                    !isLowOrCooldown
                      ? {
                          backgroundColor: brandColor,
                          boxShadow: isSelected ? `0 0 6px ${brandColor}` : undefined,
                        }
                      : undefined
                  }
                />
                <span className="max-w-28 truncate text-foreground">{cleanName}</span>
                <span
                  className="font-semibold text-3xs tracking-tight"
                  style={{ color: brandColor }}
                >
                  {brandLabel}
                </span>
                {remaining !== null ? (
                  <span className="flex items-center gap-1 tabular-nums">
                    <span className="relative h-1 w-8 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`absolute inset-y-0 left-0 rounded-full ${
                          isCooldown ? "bg-error" : isLow ? "bg-warning" : ""
                        }`}
                        style={{
                          width: `${percent}%`,
                          backgroundColor: isLowOrCooldown ? undefined : brandColor,
                        }}
                      />
                    </span>
                    <span
                      className={
                        isCooldown
                          ? "font-semibold text-3xs text-error"
                          : isLow
                            ? "font-semibold text-3xs text-warning"
                            : "text-3xs text-muted-foreground"
                      }
                    >
                      {remaining}%
                    </span>
                  </span>
                ) : null}
                {summary.activeAgentCount > 0 ? (
                  <span className="rounded bg-info/15 px-1 py-px font-semibold text-3xs text-info tabular-nums">
                    {summary.activeAgentCount} on
                  </span>
                ) : null}
              </TooltipTrigger>
              <TooltipPopup side="bottom">
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-semibold text-foreground">
                    {cleanName} · {brandLabel}
                  </span>
                  <span className="text-muted-foreground">Status: {summary.stateLabel}</span>
                  {summary.mostConstrainedWindow ? (
                    <span className="text-muted-foreground">
                      Janela ({summary.mostConstrainedWindow.label}):{" "}
                      {summary.lowestRemainingPercent}% livre
                      {summary.resetsIn ? ` · reseta ${summary.resetsIn}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Clique para usar esta conta no chat atual
                    </span>
                  )}
                </div>
              </TooltipPopup>
            </Tooltip>
          );
        })}

        {/* Seletor Explícito de Conta + Modelo + Esforço + Auto-Fallback */}
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="xs" />}>
            <CpuIcon className="size-3.5" />
            <span>
              {activeAccountSummary?.displayName.replace(/\s*\([^)]*\)\s*/g, "").trim() ?? "Conta"}
              {currentEffort ? ` · ${currentEffort}` : ""}
            </span>
            {autoFallbackEnabled ? <ZapIcon className="size-3 text-warning" /> : null}
          </PopoverTrigger>
          <PopoverPopup width="md" align="start" side="bottom">
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-semibold text-foreground">
                  Seletor Rápido: Conta + Modelo + Esforço
                </span>
                {activeAccountSummary ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onOpenProviderSetup(activeAccountSummary.instanceId)}
                  >
                    <Settings2Icon className="size-3.5" />
                    Contas
                  </Button>
                ) : null}
              </div>

              <label className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">Conta Conectada</span>
                <select
                  value={activeProviderInstanceId ?? ""}
                  onChange={(e) => {
                    const nextId = ProviderInstanceId.make(e.target.value);
                    const nextEntry = providerInstanceEntries.find(
                      (item) => item.instanceId === nextId,
                    );
                    const nextModel = nextEntry?.models[0]?.slug ?? currentModelSlug;
                    applyAccountModelAndEffort(nextId, nextModel, currentEffort);
                  }}
                  className="h-8 rounded-md border bg-background px-2 text-foreground text-xs"
                >
                  {accountSummaries.map((summary) => (
                    <option key={summary.instanceId} value={summary.instanceId}>
                      {summary.displayName}: {summary.stateLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">Modelo</span>
                <select
                  value={currentModelSlug}
                  onChange={(e) => {
                    if (!activeProviderInstanceId) return;
                    applyAccountModelAndEffort(
                      activeProviderInstanceId,
                      e.target.value,
                      currentEffort,
                    );
                  }}
                  className="h-8 rounded-md border bg-background px-2 text-foreground text-xs"
                >
                  {(activeEntry?.models ?? []).map((model) => (
                    <option key={model.slug} value={model.slug}>
                      {model.name || model.slug}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">
                  Nível de Esforço / Thinking
                </span>
                <select
                  value={currentEffort ?? ""}
                  onChange={(e) => {
                    if (!activeProviderInstanceId) return;
                    applyAccountModelAndEffort(
                      activeProviderInstanceId,
                      currentModelSlug,
                      e.target.value || null,
                    );
                  }}
                  className="h-8 rounded-md border bg-background px-2 text-foreground text-xs"
                >
                  {EFFORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border bg-muted/40 p-2">
                <div className="flex items-center gap-1.5">
                  <ZapIcon className="size-3.5 text-warning" />
                  <span className="font-medium text-foreground">
                    Auto-Fallback se atingir Rate Limit (85%)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoFallbackEnabled}
                  onChange={(e) => handleToggleAutoFallback(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
              </label>
            </div>
          </PopoverPopup>
        </Popover>
      </div>

      {/* Center / Right: 3 One-Click Workflow Recipe Modes + Coworker Pills + Sala do Squad + Actions */}
      {projectCwd ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {/* 3-Recipe Mode Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 p-0.5">
            {WORKFLOW_RECIPE_BUTTONS.map((recipe) => {
              const isRecipeActive = currentWorkflowMode === recipe.mode;
              return (
                <Tooltip key={recipe.mode}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => handleToggleWorkflowRecipe(recipe.mode)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-3xs transition-colors ${
                          isRecipeActive
                            ? "bg-primary font-semibold text-primary-foreground shadow-2xs"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        }`}
                      />
                    }
                  >
                    {recipe.mode === "mockup_turbo" ? (
                      <ZapIcon className="size-3" />
                    ) : recipe.mode === "full_pipeline" ? (
                      <RocketIcon className="size-3" />
                    ) : (
                      <PaletteIcon className="size-3" />
                    )}
                    <span>{recipe.label}</span>
                  </TooltipTrigger>
                  <TooltipPopup side="bottom">
                    <div className="flex max-w-xs flex-col gap-0.5 text-xs">
                      <span className="font-semibold text-foreground">{recipe.label}</span>
                      <span className="text-muted-foreground">{recipe.description}</span>
                    </div>
                  </TooltipPopup>
                </Tooltip>
              );
            })}
          </div>

          {teamConfig.personas.length === 0 ? (
            <Button
              variant="outline"
              size="xs"
              disabled={isSuggestingInline}
              onClick={() => void handleQuickSuggest()}
            >
              <BotIcon className="size-3.5 text-warning" />
              {isSuggestingInline ? "Sincronizando..." : "Importar Squad Oficial"}
            </Button>
          ) : (
            <>
              {teamConfig.personas.slice(0, 6).map((persona) => {
                const isDirect = activePersona?.id === persona.id;
                const isChief = persona.id === "principal" || persona.id === "lider";
                const firstName = extractPersonaFirstName(persona);
                const shortRole = resolvePersonaShortRole(persona);
                const isRunningInLive = liveEmployees.some(
                  (emp) => emp.personaId === persona.id && emp.status === "working",
                );
                const hasDispatched = isRunningInLive || dispatchedPersonaIds.has(persona.id);

                return (
                  <Tooltip key={persona.id}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => handleActivateDirectPersona(isDirect ? null : persona)}
                          className={`flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 text-2xs transition-colors ${
                            isDirect
                              ? "border-primary bg-primary/15 font-semibold text-foreground shadow-2xs"
                              : "border-border/60 bg-background/70 text-foreground/85 hover:bg-accent/60 hover:text-foreground"
                          }`}
                        />
                      }
                    >
                      <CoworkerAvatar
                        color={persona.color}
                        shape={isChief ? "orb" : "cube"}
                        size="sm"
                        status={
                          isRunningInLive
                            ? "working"
                            : isDirect
                              ? "ready"
                              : hasDispatched
                                ? "warning"
                                : "idle"
                        }
                      />
                      <span className="max-w-36 truncate">
                        {firstName} · {shortRole}
                      </span>
                      {hasDispatched ? (
                        <span
                          aria-hidden
                          className={`size-1.5 shrink-0 rounded-full ${
                            isRunningInLive ? "bg-success" : "bg-info"
                          }`}
                        />
                      ) : null}
                    </TooltipTrigger>
                    <TooltipPopup side="bottom">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="font-semibold text-foreground">
                          {persona.icon} {persona.name}: {persona.role}
                        </span>
                        {persona.jeito ? (
                          <span className="text-muted-foreground italic">
                            &ldquo;{persona.jeito}&rdquo;
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">
                          Cérebro: {persona.instanceId} · {persona.model}
                          {persona.effort ? ` (${persona.effort})` : ""}
                        </span>
                        <span className="text-primary">
                          {isDirect
                            ? "Ativo no Modo Direto (clique para sair)"
                            : "Clique para falar direto com este especialista sem fila"}
                        </span>
                      </div>
                    </TooltipPopup>
                  </Tooltip>
                );
              })}

              {teamConfig.personas.length > 6 ? (
                <Button variant="ghost" size="xs" onClick={() => handleOpenDashboardChange(true)}>
                  +{teamConfig.personas.length - 6}
                </Button>
              ) : null}

              {activePersona ? (
                <button
                  type="button"
                  onClick={() => handleActivateDirectPersona(null)}
                  aria-label="Sair do Modo Direto"
                  className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 font-medium text-3xs text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3" />
                  Livre
                </button>
              ) : null}
            </>
          )}

          {/* Prominent 1-Click Button: Sala do Squad */}
          <Button variant="secondary" size="xs" onClick={() => handleOpenDashboardChange(true)}>
            <LayoutDashboardIcon className="size-3.5 text-primary" />
            <span>Sala do Squad</span>
            {workingEmployeesCount > 0 ? (
              <Badge variant="default" size="sm">
                {workingEmployeesCount}
              </Badge>
            ) : null}
          </Button>

          {/* Quick Action: Escalar Squad */}
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="xs" />}>
              <RocketIcon className="size-3.5 text-primary" />
              <span>Escalar Squad</span>
              {liveEmployees.length > 0 ? (
                <Badge variant={workingEmployeesCount > 0 ? "default" : "secondary"} size="sm">
                  {workingEmployeesCount > 0
                    ? `${workingEmployeesCount} ativos`
                    : `${liveEmployees.length}`}
                </Badge>
              ) : null}
            </PopoverTrigger>
            <PopoverPopup width="lg" align="end" side="bottom">
              <ActiveEmployeesPanel
                employees={liveEmployees}
                onOpenDispatcher={() => setActiveStudioDialog("dispatcher")}
              />
            </PopoverPopup>
          </Popover>

          {/* Quick Action: Mapa 🔒 */}
          <Button variant="ghost" size="xs" onClick={() => setActiveStudioDialog("product-map")}>
            <ShieldCheckIcon className="size-3.5 text-primary" />
            <span>Mapa 🔒 ({productMapConfig.items.length})</span>
          </Button>

          {/* Quick Action: Configurar Equipe */}
          <Button variant="ghost" size="xs" onClick={() => setActiveStudioDialog("team")}>
            <UsersIcon className="size-3.5" />
            <span>Configurar Equipe ({teamConfig.personas.length})</span>
            {linkedRepos.length > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-3xs text-muted-foreground">
                <LayersIcon className="size-2.5" />
                {linkedRepos.length}
              </span>
            ) : null}
          </Button>

          <SquadDashboardDialog
            open={isDashboardDialogOpen}
            onOpenChange={handleOpenDashboardChange}
            environmentId={environmentId}
            routeThreadKey={routeThreadKey}
            projectName={projectName}
            teamConfig={teamConfig}
            providerEntries={providerInstanceEntries}
            accountSummaries={accountSummaries}
            liveEmployees={liveEmployees}
            activePersonaId={activePersona?.id ?? null}
            autoFallbackEnabled={autoFallbackEnabled}
            onToggleAutoFallback={handleToggleAutoFallback}
            onSelectDirectPersona={handleActivateDirectPersona}
            onActivateWorkflowRecipe={handleToggleWorkflowRecipe}
            onOpenDispatcher={() => setActiveStudioDialog("dispatcher")}
            onOpenProductMap={() => setActiveStudioDialog("product-map")}
            onOpenTeamConfig={() => setActiveStudioDialog("team")}
          />

          <ProjectTeamDialog
            open={activeStudioDialog === ("team" as StudioModalKind)}
            onOpenChange={(open) => setActiveStudioDialog(open ? "team" : null)}
            projectName={projectName}
            teamConfig={teamConfig}
            providerEntries={providerInstanceEntries}
            activePersonaId={activePersona?.id ?? null}
            onSelectDirectPersona={handleActivateDirectPersona}
            onSaveTeamConfig={saveTeamConfig}
            onSuggestTeam={suggestAndSaveTeam}
          />

          <SquadDispatcherDialog
            open={activeStudioDialog === ("dispatcher" as StudioModalKind)}
            onOpenChange={(open) => setActiveStudioDialog(open ? "dispatcher" : null)}
            environmentId={environmentId}
            activeProjectId={activeProject?.id ?? null}
            activeProjectName={projectName}
            activeProjectCwd={projectCwd}
            personas={teamConfig.personas}
            linkedRepos={linkedRepos}
            providerEntries={providerInstanceEntries}
            accountSummaries={accountSummaries}
            liveEmployees={liveEmployees}
          />

          <ProductMapDialog
            open={activeStudioDialog === ("product-map" as StudioModalKind)}
            onOpenChange={(open) => setActiveStudioDialog(open ? "product-map" : null)}
            projectName={projectName}
            productMap={productMapConfig}
            onSave={(nextMap) =>
              saveProductMapConfig(nextMap, {
                toastTitle: "Mapa da Fonte da Verdade atualizado!",
              })
            }
            onSuggestMap={suggestAndSaveProductMap}
          />
        </div>
      ) : null}
    </div>
  );
}
