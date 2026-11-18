import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  type EnvironmentProject,
  threadRuntimeIsActive,
} from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { ShieldCheckIcon, WrenchIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { DraftId } from "~/composerDraftStore";
import { useComposerDraftStore } from "~/composerDraftStore";
import { deriveProviderInstanceEntries } from "~/providerInstances";
import { useProjects, useQuietThreadShells } from "~/state/entities";
import { useEnvironmentProviders } from "~/state/environments";
import { toastManager } from "../ui/toast";
import { CoworkerAvatar, CoworkerAvatarStack } from "./CoworkerAvatar";
import {
  buildEffortOptionSelections,
  type ProjectPersona,
  suggestProjectTeam,
} from "./projectTeam.logic";
import { useActivePersonaStore, useProjectTeam } from "./useProjectTeam";

interface CoworkerStudioHeroProps {
  readonly draftId?: DraftId | null;
  readonly activeProject?: EnvironmentProject | null;
  readonly environmentId?: EnvironmentId;
  readonly projectCwd?: string;
  readonly projectName?: string;
  readonly headingNode?: ReactNode;
  readonly secondaryAction?: ReactNode;
}

export function CoworkerStudioHero({
  draftId = null,
  activeProject: activeProjectProp = null,
  environmentId: environmentIdProp,
  projectCwd: projectCwdProp,
  projectName: projectNameProp,
  headingNode,
  secondaryAction,
}: CoworkerStudioHeroProps) {
  const projects = useProjects();
  const providersByEnvironment = useEnvironmentProviders();
  const threadShells = useQuietThreadShells();
  const setActivePersona = useActivePersonaStore((s) => s.setActivePersona);
  const setActiveStudioDialog = useActivePersonaStore((s) => s.setActiveStudioDialog);
  const setComposerDraftModelSelection = useComposerDraftStore((store) => store.setModelSelection);
  const setStickyComposerModelSelection = useComposerDraftStore(
    (store) => store.setStickyModelSelection,
  );

  const activeProject =
    activeProjectProp ??
    (environmentIdProp && projectCwdProp
      ? (projects.find(
          (p) =>
            p.environmentId === environmentIdProp &&
            p.workspaceRoot.toLowerCase() === projectCwdProp.toLowerCase(),
        ) ?? null)
      : null);

  const environmentId = activeProject?.environmentId ?? environmentIdProp;
  const projectCwd = activeProject?.workspaceRoot ?? projectCwdProp ?? null;
  const projectName = activeProject?.title ?? projectNameProp ?? null;

  const providerInstanceEntries = environmentId
    ? deriveProviderInstanceEntries(providersByEnvironment.get(environmentId) ?? [])
    : [];

  const routeThreadRef =
    environmentId && draftId ? scopeThreadRef(environmentId, draftId as unknown as ThreadId) : null;
  const routeThreadKey = routeThreadRef ? scopedThreadKey(routeThreadRef) : "";

  const activePersona = useActivePersonaStore((s) =>
    routeThreadKey
      ? (s.activePersonaByThreadKey[routeThreadKey] ?? null)
      : (Object.values(s.activePersonaByThreadKey).find(Boolean) ?? null),
  );

  const { teamConfig, productMapConfig } = useProjectTeam({
    environmentId: (environmentId ?? "local") as NonNullable<typeof environmentId>,
    projectCwd,
    projectName,
    providerInstanceEntries,
  });

  const effectivePersonas =
    teamConfig.personas.length > 0
      ? teamConfig.personas
      : suggestProjectTeam({
          projectName: projectName ?? "Projeto",
          projectCwd: projectCwd ?? "",
          filePaths: [],
          providerEntries: providerInstanceEntries,
        }).personas;

  const chiefPersona =
    effectivePersonas.find((p) => p.id === "principal" || p.id === "lider") ??
    effectivePersonas[0]!;
  const heroPersona = activePersona ?? chiefPersona;

  const featuredSpecialist =
    effectivePersonas.find((p) => p.category === "dominio") ??
    effectivePersonas.find((p) => p.id === "design") ??
    effectivePersonas.find((p) => p.id === "dev" || p.id === "dev-web") ??
    chiefPersona;

  const daviPersona =
    effectivePersonas.find((p) => p.id === "dev" || p.id === "dev-web") ?? featuredSpecialist;

  const runningProjectThreads = activeProject
    ? threadShells.filter(
        (shell) =>
          shell.environmentId === activeProject.environmentId &&
          shell.projectId === activeProject.id &&
          threadRuntimeIsActive(shell.runtime),
      )
    : [];
  const runningCount = runningProjectThreads.length;

  const codeTruthCount = productMapConfig.items.filter(
    (item) => item.status === "code_truth",
  ).length;

  const handleSelectPersona = (persona: ProjectPersona | null) => {
    if (routeThreadKey) {
      setActivePersona(routeThreadKey, persona);
    }
    if (!persona) return;

    const entry = providerInstanceEntries.find((item) => item.instanceId === persona.instanceId);
    const resolvedModel =
      entry?.models.find((m) => m.slug === persona.model)?.slug ??
      entry?.models[0]?.slug ??
      persona.model;
    if (resolvedModel && routeThreadRef) {
      const options = buildEffortOptionSelections(entry, resolvedModel, persona.effort);
      const nextSelection = options
        ? { instanceId: persona.instanceId, model: resolvedModel, options }
        : { instanceId: persona.instanceId, model: resolvedModel };
      setComposerDraftModelSelection(routeThreadRef, nextSelection, {
        explicit: true,
        replaceOptions: true,
      });
      setStickyComposerModelSelection(nextSelection);
    }

    toastManager.add({
      type: "info",
      title: `${persona.icon} Modo Direto: ${persona.name}`,
      description: `${persona.role}: "${persona.jeito ?? "Pronto para agir."}"`,
      timeout: 3_000,
    });
  };

  return (
    <div
      data-coworker-studio-hero="true"
      className="mx-auto flex w-full max-w-2xl flex-col items-center px-3 text-center select-none"
    >
      {/* Top 3D Glossy Orb / Cube Avatar */}
      <div className="mb-2.5 flex flex-col items-center">
        <CoworkerAvatar
          variant={heroPersona.id === "principal" || heroPersona.id === "lider" ? "orb" : "cube"}
          colorHex={heroPersona.color}
          size="xl"
          status={runningCount > 0 ? "working" : "ready"}
        />
      </div>

      {/* Chief of Staff / Active Coworker Greeting */}
      <p className="mb-1 font-medium text-muted-foreground text-xs sm:text-sm">
        {activePersona ? (
          <>
            Olá Luan, você está falando direto com{" "}
            <strong className="text-foreground">{activePersona.name}</strong> ({activePersona.role}
            ).
          </>
        ) : (
          <>
            Olá Luan, sou <strong className="text-foreground">{chiefPersona.name}</strong>, sua
            Chief of Staff. Aqui está sua equipe.
          </>
        )}
      </p>

      {/* Main Heading with Project Selector */}
      {headingNode}

      {/* Rerun-style Stacked Mini Cubes + Live Status Line */}
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-muted-foreground text-xs">
        <CoworkerAvatarStack
          items={effectivePersonas.slice(0, 6).map((p) => ({ id: p.id, color: p.color }))}
          maxVisible={6}
        />
        <span>{effectivePersonas.length} coworkers</span>
        <span>·</span>
        <span className="font-medium text-success">
          {runningCount > 0 ? `${runningCount} em trabalho` : "prontos para escalar"}
        </span>
        {codeTruthCount > 0 ? (
          <>
            <span>·</span>
            <button
              type="button"
              onClick={() => setActiveStudioDialog("product-map")}
              className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-primary transition-colors hover:bg-primary/10"
            >
              <ShieldCheckIcon className="size-3" />
              <span>{codeTruthCount} módulos blindados</span>
            </button>
          </>
        ) : null}
      </div>

      {/* Quick Coworker Direct Selector Pills */}
      <div className="pointer-events-auto mt-3 flex max-w-xl flex-wrap items-center justify-center gap-1.5">
        {effectivePersonas.slice(0, 9).map((persona) => {
          const isSelected = activePersona?.id === persona.id;
          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => handleSelectPersona(isSelected ? null : persona)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs transition-all ${
                isSelected
                  ? "border-primary bg-primary/15 font-semibold text-foreground shadow-xs"
                  : "border-border/50 bg-card/40 text-muted-foreground hover:border-border hover:bg-card/80 hover:text-foreground"
              }`}
            >
              <CoworkerAvatar
                variant={persona.id === "principal" || persona.id === "lider" ? "orb" : "cube"}
                colorHex={persona.color}
                size="xs"
              />
              <span>{persona.name.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* 3 Rerun-style Dark Glass Action Cards */}
      <div className="pointer-events-auto mt-4 flex w-full max-w-md flex-col gap-2 text-left">
        {/* Card 1: Escalar Funcionários em Paralelo / O que está rodando */}
        <button
          type="button"
          onClick={() => setActiveStudioDialog("dispatcher")}
          className="group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-border/60 bg-card/50 px-4 py-2.5 backdrop-blur-md transition-all hover:border-border hover:bg-card/85"
        >
          <CoworkerAvatar
            variant="cube"
            colorHex={daviPersona.color}
            size="md"
            status={runningCount > 0 ? "working" : "warning"}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground text-xs sm:text-sm">
              {runningCount > 0
                ? `O que seus ${runningCount} funcionários estão fazendo?`
                : `Escalar ${daviPersona.name} #1, #2, Dora e Quim em paralelo`}
            </div>
            <div className="truncate text-2xs text-muted-foreground sm:text-xs">
              {runningCount > 0
                ? "Em trabalho em worktrees isolados · Acompanhar diff e preview"
                : "Disparar múltiplos especialistas em worktrees isolados (API + Web)"}
            </div>
          </div>
        </button>

        {/* Card 2: Confiar tarefa direta a um especialista */}
        <button
          type="button"
          onClick={() => handleSelectPersona(featuredSpecialist)}
          className="group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-border/60 bg-card/50 px-4 py-2.5 backdrop-blur-md transition-all hover:border-border hover:bg-card/85"
        >
          <CoworkerAvatar
            variant="cube"
            colorHex={featuredSpecialist.color}
            size="md"
            status="ready"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground text-xs sm:text-sm">
              Confiar uma tarefa a {featuredSpecialist.name} ({featuredSpecialist.role})
            </div>
            <div className="truncate text-2xs text-muted-foreground sm:text-xs">
              Eu passo o briefing em Modo Direto · &ldquo;{featuredSpecialist.jeito}&rdquo;
            </div>
          </div>
        </button>

        {/* Card 3: Criar novo coworker / Configurar Equipe & Mapa */}
        <div className="flex w-full items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveStudioDialog("team")}
            className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 rounded-xl border border-border/60 bg-card/50 px-4 py-2.5 backdrop-blur-md transition-all hover:border-border hover:bg-card/85"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground group-hover:text-foreground">
              <WrenchIcon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground text-xs sm:text-sm">
                Criar novo coworker ou vincular Multi-Repo
              </div>
              <div className="truncate text-2xs text-muted-foreground sm:text-xs">
                Para uma tarefa ou especialidade que ninguém faz ainda (.t3/team.json)
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStudioDialog("product-map")}
            aria-label="Abrir Mapa da Fonte da Verdade (.t3/product-map.json)"
            className="flex h-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-muted-foreground backdrop-blur-md transition-all hover:border-primary/50 hover:bg-card/85 hover:text-primary"
          >
            <ShieldCheckIcon className="size-4 text-primary" />
            <span className="font-medium text-3xs">Mapa</span>
          </button>
        </div>
      </div>

      {secondaryAction ? (
        <div className="mt-2 flex h-6 w-full items-center justify-center text-xs">
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
