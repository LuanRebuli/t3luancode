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
import { ActiveEmployeesPanel, useLiveEmployeesList } from "./ActiveEmployeesPanel";
import { CoworkerAvatar } from "./CoworkerAvatar";
import { ProductMapDialog } from "./ProductMapDialog";
import {
  type AccountLiveSummary,
  buildEffortOptionSelections,
  EFFORT_OPTIONS,
  extractEffortFromSelection,
  type ProjectPersona,
} from "./projectTeam.logic";
import { ProjectTeamDialog } from "./ProjectTeamDialog";
import { SquadDispatcherDialog } from "./SquadDispatcherDialog";
import { useAccountLiveSummaries, useActivePersonaStore, useProjectTeam } from "./useProjectTeam";

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

function accountStateDotClass(state: AccountLiveSummary["state"]): string {
  switch (state) {
    case "available":
      return "bg-emerald-500";
    case "in_use":
      return "bg-sky-500 animate-pulse";
    case "near_limit":
      return "bg-amber-500";
    case "cooldown":
      return "bg-rose-500";
    case "unavailable":
      return "bg-zinc-400";
  }
}

function accountQuotaBarColor(state: AccountLiveSummary["state"]): string {
  switch (state) {
    case "cooldown":
      return "#f43f5e";
    case "near_limit":
      return "#f59e0b";
    case "in_use":
      return "#0ea5e9";
    case "available":
      return "#10b981";
    case "unavailable":
      return "#71717a";
  }
}

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
  const autoFallbackEnabled = useActivePersonaStore((state) => state.autoFallbackEnabled);
  const activeStudioDialog = useActivePersonaStore((state) => state.activeStudioDialog);
  const setActivePersona = useActivePersonaStore((state) => state.setActivePersona);
  const setAutoFallbackEnabled = useActivePersonaStore((state) => state.setAutoFallbackEnabled);
  const setActiveStudioDialog = useActivePersonaStore((state) => state.setActiveStudioDialog);

  const setComposerDraftModelSelection = useComposerDraftStore((store) => store.setModelSelection);
  const setStickyComposerModelSelection = useComposerDraftStore(
    (store) => store.setStickyModelSelection,
  );

  const [isSuggestingInline, setIsSuggestingInline] = useState(false);

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
      {/* Etapa 1: Barra de Limites e Contas em Tempo Real */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="font-semibold text-2xs text-muted-foreground tracking-tight uppercase">
          Contas:
        </span>
        {accountSummaries.map((summary) => {
          const isSelected = summary.instanceId === activeProviderInstanceId;
          const remaining = summary.lowestRemainingPercent;
          return (
            <Tooltip key={summary.instanceId}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => handleSelectAccountChip(summary)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-2xs transition-colors ${
                      isSelected
                        ? "border-primary/80 bg-primary/10 font-semibold text-foreground shadow-2xs"
                        : "border-border/60 bg-background/70 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  />
                }
              >
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${accountStateDotClass(summary.state)}`}
                />
                <span className="max-w-32 truncate">{summary.displayName}</span>
                {summary.activeAgentCount > 0 ? (
                  <span className="rounded bg-info/15 px-1 py-px font-semibold text-3xs text-info tabular-nums">
                    {summary.activeAgentCount} ag
                  </span>
                ) : null}
                {remaining !== null ? (
                  <span className="flex items-center gap-1 tabular-nums">
                    <span className="relative h-1.5 w-8 overflow-hidden rounded-full bg-muted">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, remaining))}%`,
                          backgroundColor: accountQuotaBarColor(summary.state),
                        }}
                      />
                    </span>
                    <span
                      className={
                        summary.state === "cooldown"
                          ? "font-semibold text-error"
                          : summary.state === "near_limit"
                            ? "font-semibold text-warning"
                            : "text-3xs text-muted-foreground"
                      }
                    >
                      {remaining}%
                    </span>
                  </span>
                ) : null}
              </TooltipTrigger>
              <TooltipPopup side="bottom">
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-semibold text-foreground">
                    {summary.displayName} ({summary.driverKind})
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
              {activeAccountSummary?.displayName ?? "Conta"}
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
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoFallbackEnabled(checked);
                    if (projectCwd) {
                      void saveTeamConfig({
                        ...teamConfig,
                        autoFallbackOnRateLimit: checked,
                      });
                    }
                  }}
                  className="size-3.5 accent-primary"
                />
              </label>
            </div>
          </PopoverPopup>
        </Popover>
      </div>

      {/* Etapas 2, 3 e 4: Coworkers (Modo Direto), Escalador Paralelo e Mapa da Fonte da Verdade */}
      {projectCwd ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
              <span className="font-semibold text-2xs text-muted-foreground tracking-tight uppercase">
                Squad:
              </span>
              {teamConfig.personas.slice(0, 6).map((persona) => {
                const isDirect = activePersona?.id === persona.id;
                const isChief = persona.id === "principal";
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
                        size="xs"
                        status={isDirect ? "working" : "idle"}
                      />
                      <span className="max-w-24 truncate">{persona.name.split(" ")[0]}</span>
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
                <Button variant="ghost" size="xs" onClick={() => setActiveStudioDialog("team")}>
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

          {/* Etapa 3: Painel Rápido de Funcionários Ativos + Escalador Multi-Dev */}
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

          {/* Etapa 4: Mapa da Fonte da Verdade (.t3/product-map.json) */}
          <Button variant="ghost" size="xs" onClick={() => setActiveStudioDialog("product-map")}>
            <ShieldCheckIcon className="size-3.5 text-primary" />
            <span>Fonte da Verdade ({productMapConfig.items.length})</span>
          </Button>

          {/* Etapa 2: Editor Completo de Squad, Skills & Multi-Repo */}
          <Button variant="ghost" size="xs" onClick={() => setActiveStudioDialog("team")}>
            <UsersIcon className="size-3.5" />
            <span>Equipe ({teamConfig.personas.length})</span>
            {linkedRepos.length > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-3xs text-muted-foreground">
                <LayersIcon className="size-2.5" />
                {linkedRepos.length}
              </span>
            ) : null}
          </Button>

          <ProjectTeamDialog
            open={activeStudioDialog === "team"}
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
            open={activeStudioDialog === "dispatcher"}
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
            open={activeStudioDialog === "product-map"}
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
