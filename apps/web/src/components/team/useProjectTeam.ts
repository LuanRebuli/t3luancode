import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId } from "@t3tools/contracts";
import { create } from "zustand";
import { useNowMinute } from "../../hooks/useNowMinute";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { useQuietThreadShells } from "../../state/entities";
import { projectEnvironment } from "../../state/projects";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  confirmProjectFileQueryData,
  getProjectFileContents,
  setProjectFileQueryData,
  useProjectEntriesQuery,
  useProjectFileQuery,
} from "../files/projectFilesQueryState";
import { toastManager } from "../ui/toast";
import {
  formatProductMapGuardrailsPrompt,
  parseProductMapConfig,
  type ProductMapConfig,
  serializeProductMapConfig,
  suggestProductMap,
  T3_PRODUCT_MAP_FILE_PATH,
} from "./productMap.logic";
import {
  type AccountLiveSummary,
  buildPersonaSkillMarkdown,
  OFFICIAL_SQUAD_PERSONAS,
  parseProjectTeamConfig,
  type ProjectPersona,
  type ProjectTeamConfig,
  resolveProviderBrandColor,
  serializeProjectTeamConfig,
  type SquadPipelineStageId,
  type SquadWorkflowMode,
  suggestProjectTeam,
  summarizeAccountLiveStatus,
  T3_TEAM_FILE_PATH,
} from "./projectTeam.logic";

export const ACTIVE_PERSONA_STORAGE_KEY = "t3_squad_active_persona_store_v2";

export type StudioModalKind =
  | "team"
  | "dispatcher"
  | "product-map"
  | "dashboard"
  | "squad-dashboard"
  | null;

export type StoredActivePersona = ProjectPersona & string;

function resolvePersonaValue(
  personaOrId: ProjectPersona | string | null | undefined,
  pool: ReadonlyArray<ProjectPersona> = OFFICIAL_SQUAD_PERSONAS,
): StoredActivePersona | null {
  if (!personaOrId) return null;
  if (typeof personaOrId === "object" && typeof personaOrId.id === "string") {
    return personaOrId as StoredActivePersona;
  }
  if (typeof personaOrId === "string") {
    const trimmed = personaOrId.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/^@/, "").toLowerCase();
    const matched =
      pool.find(
        (item) =>
          item.id.toLowerCase() === normalized ||
          item.handle?.replace(/^@/, "").toLowerCase() === normalized ||
          item.name.toLowerCase().includes(`@${normalized}`),
      ) ??
      OFFICIAL_SQUAD_PERSONAS.find(
        (item) =>
          item.id.toLowerCase() === normalized ||
          item.handle?.replace(/^@/, "").toLowerCase() === normalized ||
          item.name.toLowerCase().includes(`@${normalized}`),
      ) ??
      OFFICIAL_SQUAD_PERSONAS[0] ??
      null;
    if (!matched) return null;
    return {
      ...matched,
      id: matched.id || trimmed,
    } as StoredActivePersona;
  }
  return null;
}

interface PersistedActivePersonaStoreV2 {
  readonly activePersonaByThreadKey?: Record<string, ProjectPersona | string | null>;
  readonly workflowModeByThreadKey?: Record<string, SquadWorkflowMode>;
  readonly pipelineStageByThreadKey?: Record<string, SquadPipelineStageId>;
  readonly autoFallbackEnabled?: boolean;
}

function loadPersistedActivePersonaState(): {
  readonly activePersonaByThreadKey: Record<string, StoredActivePersona | null>;
  readonly workflowModeByThreadKey: Record<string, SquadWorkflowMode>;
  readonly pipelineStageByThreadKey: Record<string, SquadPipelineStageId>;
  readonly autoFallbackEnabled: boolean;
} {
  const fallback = {
    activePersonaByThreadKey: {} as Record<string, StoredActivePersona | null>,
    workflowModeByThreadKey: {} as Record<string, SquadWorkflowMode>,
    pipelineStageByThreadKey: {} as Record<string, SquadPipelineStageId>,
    autoFallbackEnabled: true,
  };
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(ACTIVE_PERSONA_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedActivePersonaStoreV2 | null;
    if (!parsed || typeof parsed !== "object") return fallback;

    const activePersonaByThreadKey: Record<string, StoredActivePersona | null> = {};
    if (parsed.activePersonaByThreadKey && typeof parsed.activePersonaByThreadKey === "object") {
      for (const [key, value] of Object.entries(parsed.activePersonaByThreadKey)) {
        activePersonaByThreadKey[key] = resolvePersonaValue(value);
      }
    }

    const workflowModeByThreadKey: Record<string, SquadWorkflowMode> = {};
    if (parsed.workflowModeByThreadKey && typeof parsed.workflowModeByThreadKey === "object") {
      for (const [key, value] of Object.entries(parsed.workflowModeByThreadKey)) {
        if (
          value === "direct" ||
          value === "mockup_turbo" ||
          value === "full_pipeline" ||
          value === "creative_studio"
        ) {
          workflowModeByThreadKey[key] = value;
        }
      }
    }

    const pipelineStageByThreadKey: Record<string, SquadPipelineStageId> = {};
    if (parsed.pipelineStageByThreadKey && typeof parsed.pipelineStageByThreadKey === "object") {
      for (const [key, value] of Object.entries(parsed.pipelineStageByThreadKey)) {
        if (
          value === "produto_spec" ||
          value === "design" ||
          value === "dev" ||
          value === "qa_e2e" ||
          value === "prints_aprovacao"
        ) {
          pipelineStageByThreadKey[key] = value;
        }
      }
    }

    return {
      activePersonaByThreadKey,
      workflowModeByThreadKey,
      pipelineStageByThreadKey,
      autoFallbackEnabled: parsed.autoFallbackEnabled !== false,
    };
  } catch {
    return fallback;
  }
}

function savePersistedActivePersonaState(state: {
  readonly activePersonaByThreadKey: Record<string, StoredActivePersona | null>;
  readonly workflowModeByThreadKey: Record<string, SquadWorkflowMode>;
  readonly pipelineStageByThreadKey: Record<string, SquadPipelineStageId>;
  readonly autoFallbackEnabled: boolean;
}): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedActivePersonaStoreV2 = {
      activePersonaByThreadKey: state.activePersonaByThreadKey,
      workflowModeByThreadKey: state.workflowModeByThreadKey,
      pipelineStageByThreadKey: state.pipelineStageByThreadKey,
      autoFallbackEnabled: state.autoFallbackEnabled,
    };
    window.localStorage.setItem(ACTIVE_PERSONA_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

interface ActivePersonaState {
  readonly activePersonaByThreadKey: Record<string, StoredActivePersona | null>;
  readonly workflowModeByThreadKey: Record<string, SquadWorkflowMode>;
  readonly pipelineStageByThreadKey: Record<string, SquadPipelineStageId>;
  readonly autoFallbackEnabled: boolean;
  readonly activeStudioDialog: StudioModalKind;
  readonly setActivePersona: (threadKey: string, persona: ProjectPersona | string | null) => void;
  readonly setWorkflowMode: (threadKey: string, mode: SquadWorkflowMode) => void;
  readonly setPipelineStage: (threadKey: string, stage: SquadPipelineStageId) => void;
  readonly setAutoFallbackEnabled: (enabled: boolean) => void;
  readonly setActiveStudioDialog: (dialog: StudioModalKind) => void;
}

const initialPersistedState = loadPersistedActivePersonaState();

export const useActivePersonaStore = create<ActivePersonaState>((set) => ({
  activePersonaByThreadKey: initialPersistedState.activePersonaByThreadKey,
  workflowModeByThreadKey: initialPersistedState.workflowModeByThreadKey,
  pipelineStageByThreadKey: initialPersistedState.pipelineStageByThreadKey,
  autoFallbackEnabled: initialPersistedState.autoFallbackEnabled,
  activeStudioDialog: null,
  setActivePersona: (threadKey, persona) =>
    set((state) => {
      const nextActivePersonaByThreadKey = {
        ...state.activePersonaByThreadKey,
        [threadKey]: resolvePersonaValue(persona),
      };
      savePersistedActivePersonaState({
        activePersonaByThreadKey: nextActivePersonaByThreadKey,
        workflowModeByThreadKey: state.workflowModeByThreadKey,
        pipelineStageByThreadKey: state.pipelineStageByThreadKey,
        autoFallbackEnabled: state.autoFallbackEnabled,
      });
      return {
        activePersonaByThreadKey: nextActivePersonaByThreadKey,
      };
    }),
  setWorkflowMode: (threadKey, mode) =>
    set((state) => {
      const nextWorkflowModeByThreadKey = {
        ...state.workflowModeByThreadKey,
        [threadKey]: mode,
      };
      savePersistedActivePersonaState({
        activePersonaByThreadKey: state.activePersonaByThreadKey,
        workflowModeByThreadKey: nextWorkflowModeByThreadKey,
        pipelineStageByThreadKey: state.pipelineStageByThreadKey,
        autoFallbackEnabled: state.autoFallbackEnabled,
      });
      return {
        workflowModeByThreadKey: nextWorkflowModeByThreadKey,
      };
    }),
  setPipelineStage: (threadKey, stage) =>
    set((state) => {
      const nextPipelineStageByThreadKey = {
        ...state.pipelineStageByThreadKey,
        [threadKey]: stage,
      };
      savePersistedActivePersonaState({
        activePersonaByThreadKey: state.activePersonaByThreadKey,
        workflowModeByThreadKey: state.workflowModeByThreadKey,
        pipelineStageByThreadKey: nextPipelineStageByThreadKey,
        autoFallbackEnabled: state.autoFallbackEnabled,
      });
      return {
        pipelineStageByThreadKey: nextPipelineStageByThreadKey,
      };
    }),
  setAutoFallbackEnabled: (enabled) =>
    set((state) => {
      savePersistedActivePersonaState({
        activePersonaByThreadKey: state.activePersonaByThreadKey,
        workflowModeByThreadKey: state.workflowModeByThreadKey,
        pipelineStageByThreadKey: state.pipelineStageByThreadKey,
        autoFallbackEnabled: enabled,
      });
      return { autoFallbackEnabled: enabled };
    }),
  setActiveStudioDialog: (dialog) => set({ activeStudioDialog: dialog }),
}));

export function readActivePersonaForThread(
  threadKey: string,
  personas?: ReadonlyArray<ProjectPersona>,
): ProjectPersona | null {
  const stored = useActivePersonaStore.getState().activePersonaByThreadKey[threadKey] ?? null;
  if (!stored) return null;
  if (personas && personas.length > 0) {
    return personas.find((p) => p.id === stored.id) ?? stored;
  }
  return stored;
}

export function readWorkflowModeForThread(threadKey: string): SquadWorkflowMode {
  return useActivePersonaStore.getState().workflowModeByThreadKey[threadKey] ?? "direct";
}

export function readPipelineStageForThread(threadKey: string): SquadPipelineStageId {
  return useActivePersonaStore.getState().pipelineStageByThreadKey[threadKey] ?? "produto_spec";
}

export function readProductGuardrailsForProject(
  environmentId: EnvironmentId,
  projectCwd: string | null | undefined,
): string {
  const cwd = projectCwd?.trim() ?? "";
  if (!cwd) return "";
  const rawTeam = getProjectFileContents(environmentId, cwd, T3_TEAM_FILE_PATH);
  const rawMap = getProjectFileContents(environmentId, cwd, T3_PRODUCT_MAP_FILE_PATH);
  const teamConfig = parseProjectTeamConfig(rawTeam);
  const productMap = parseProductMapConfig(rawMap);
  return formatProductMapGuardrailsPrompt({
    productMap,
    linkedRepos: teamConfig.linkedRepos,
    workspaceContext: teamConfig.workspaceContext,
  });
}

export function readProjectGuardrailsForTurn(input: {
  readonly environmentId: EnvironmentId;
  readonly projectCwd: string | null | undefined;
}): string {
  return readProductGuardrailsForProject(input.environmentId, input.projectCwd);
}

export function computeActiveAgentsByProviderInstanceId(
  threadShells: ReadonlyArray<{
    readonly providerInstanceId?: string | null | undefined;
    readonly status?: string | null | undefined;
    readonly isRunning?: boolean | undefined;
    readonly latestTurn?: { readonly state?: string | null | undefined } | null | undefined;
    readonly runtime?: unknown;
  }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shell of threadShells) {
    const runtimeObj =
      shell.runtime && typeof shell.runtime === "object"
        ? (shell.runtime as {
            readonly providerInstanceId?: string | null | undefined;
          })
        : null;
    const isRuntimeActive = shell.runtime
      ? threadRuntimeIsActive(shell.runtime as Parameters<typeof threadRuntimeIsActive>[0])
      : false;
    const statusLower = (shell.status ?? "").toLowerCase();
    const turnStateLower = (shell.latestTurn?.state ?? "").toLowerCase();
    const isFallbackRunning =
      shell.isRunning === true ||
      statusLower === "running" ||
      statusLower === "working" ||
      statusLower === "active" ||
      turnStateLower === "running" ||
      turnStateLower === "in_progress" ||
      turnStateLower === "streaming";

    if (!isRuntimeActive && !isFallbackRunning) {
      continue;
    }

    const instanceId = (runtimeObj?.providerInstanceId ?? shell.providerInstanceId ?? "").trim();
    if (!instanceId) {
      continue;
    }
    counts.set(instanceId, (counts.get(instanceId) ?? 0) + 1);
  }
  return counts;
}

export function useAccountLiveSummaries(
  providerInstanceEntries: ReadonlyArray<ProviderInstanceEntry>,
): ReadonlyArray<AccountLiveSummary> {
  const threadShells = useQuietThreadShells();
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);

  const activeCountByInstance = computeActiveAgentsByProviderInstanceId(threadShells);

  return providerInstanceEntries.map((entry) => {
    const summary = summarizeAccountLiveStatus({
      entry,
      activeAgentCount: activeCountByInstance.get(entry.instanceId) ?? 0,
      now,
    });
    return {
      ...summary,
      accentColor: resolveProviderBrandColor(entry.driverKind, entry.accentColor),
    };
  });
}

export function useProjectTeam(input: {
  readonly environmentId: EnvironmentId;
  readonly projectCwd: string | null;
  readonly projectName: string | null;
  readonly providerInstanceEntries: ReadonlyArray<ProviderInstanceEntry>;
}) {
  const { environmentId, projectCwd, projectName, providerInstanceEntries } = input;
  const enabled = Boolean(projectCwd && projectCwd.trim().length > 0);
  const cwd = projectCwd ?? "";

  const teamFileQuery = useProjectFileQuery(environmentId, cwd, T3_TEAM_FILE_PATH, enabled);
  const productMapQuery = useProjectFileQuery(
    environmentId,
    cwd,
    T3_PRODUCT_MAP_FILE_PATH,
    enabled,
  );
  const entriesQuery = useProjectEntriesQuery(environmentId, cwd);
  const writeFileCommand = useAtomCommand(projectEnvironment.writeFile, {
    label: "save project team config",
    reportFailure: false,
  });

  const rawContents =
    teamFileQuery.data?.exists === false ? undefined : teamFileQuery.data?.contents;
  const teamConfig = parseProjectTeamConfig(rawContents);
  const hasSavedTeamFile =
    teamFileQuery.data !== null &&
    teamFileQuery.data.exists !== false &&
    teamConfig.personas.length > 0;

  const rawMapContents =
    productMapQuery.data?.exists === false ? undefined : productMapQuery.data?.contents;
  const productMapConfig = parseProductMapConfig(rawMapContents);
  const hasSavedProductMapFile =
    productMapQuery.data !== null &&
    productMapQuery.data.exists !== false &&
    productMapConfig.items.length > 0;

  const saveTeamConfig = async (
    nextConfig: ProjectTeamConfig,
    options?: { readonly writeSkillFiles?: boolean; readonly toastTitle?: string },
  ): Promise<boolean> => {
    if (!enabled) return false;
    const contents = serializeProjectTeamConfig(nextConfig);
    setProjectFileQueryData(environmentId, cwd, T3_TEAM_FILE_PATH, contents);
    const result = await writeFileCommand({
      environmentId,
      input: {
        cwd,
        relativePath: T3_TEAM_FILE_PATH,
        contents,
      },
    });
    if (result._tag === "Failure") {
      toastManager.add({
        type: "error",
        title: "Não foi possível salvar .t3/team.json",
        description: "Verifique as permissões de escrita do projeto.",
      });
      return false;
    }
    confirmProjectFileQueryData(environmentId, cwd, T3_TEAM_FILE_PATH, contents);

    if (options?.writeSkillFiles) {
      const displayProject = projectName ?? "Projeto";
      for (const persona of nextConfig.personas) {
        const skillPath = `.t3/skills/${persona.id}.md`;
        const skillMarkdown = buildPersonaSkillMarkdown(persona, displayProject);
        setProjectFileQueryData(environmentId, cwd, skillPath, skillMarkdown);
        const skillWrite = await writeFileCommand({
          environmentId,
          input: {
            cwd,
            relativePath: skillPath,
            contents: skillMarkdown,
          },
        });
        if (skillWrite._tag === "Success") {
          confirmProjectFileQueryData(environmentId, cwd, skillPath, skillMarkdown);
        }
      }
    }

    if (options?.toastTitle) {
      toastManager.add({
        type: "success",
        title: options.toastTitle,
        description: `Salvo em ${T3_TEAM_FILE_PATH}${
          options.writeSkillFiles ? " e .t3/skills/*.md" : ""
        }`,
      });
    }
    return true;
  };

  const saveProductMapConfig = async (
    nextMap: ProductMapConfig,
    options?: { readonly toastTitle?: string },
  ): Promise<boolean> => {
    if (!enabled) return false;
    const contents = serializeProductMapConfig(nextMap);
    setProjectFileQueryData(environmentId, cwd, T3_PRODUCT_MAP_FILE_PATH, contents);
    const result = await writeFileCommand({
      environmentId,
      input: {
        cwd,
        relativePath: T3_PRODUCT_MAP_FILE_PATH,
        contents,
      },
    });
    if (result._tag === "Failure") {
      toastManager.add({
        type: "error",
        title: "Não foi possível salvar .t3/product-map.json",
        description: "Verifique as permissões de escrita do projeto.",
      });
      return false;
    }
    confirmProjectFileQueryData(environmentId, cwd, T3_PRODUCT_MAP_FILE_PATH, contents);
    if (options?.toastTitle) {
      toastManager.add({
        type: "success",
        title: options.toastTitle,
        description: `Salvo em ${T3_PRODUCT_MAP_FILE_PATH}`,
      });
    }
    return true;
  };

  const suggestAndSaveTeam = async (): Promise<ProjectTeamConfig | null> => {
    if (!enabled) return null;
    const entryPaths = entriesQuery.data?.entries.map((entry) => entry.path) ?? [];
    const suggested = suggestProjectTeam({
      projectName: projectName ?? "Projeto",
      projectCwd: cwd,
      filePaths: entryPaths,
      providerEntries: providerInstanceEntries,
    });
    useActivePersonaStore.getState().setAutoFallbackEnabled(suggested.autoFallbackOnRateLimit);
    const saved = await saveTeamConfig(suggested, {
      writeSkillFiles: true,
      toastTitle: `Squad oficial de ${suggested.personas.length} coworkers sincronizado!`,
    });
    if (saved && !hasSavedProductMapFile) {
      const suggestedMap = suggestProductMap({
        projectName: projectName ?? "Projeto",
        projectCwd: cwd,
      });
      await saveProductMapConfig(suggestedMap);
    }
    return saved ? suggested : null;
  };

  const suggestAndSaveProductMap = async (): Promise<ProductMapConfig | null> => {
    if (!enabled) return null;
    const suggestedMap = suggestProductMap({
      projectName: projectName ?? "Projeto",
      projectCwd: cwd,
    });
    const saved = await saveProductMapConfig(suggestedMap, {
      toastTitle: `Mapa da Fonte da Verdade (${suggestedMap.items.length} módulos) gerado!`,
    });
    return saved ? suggestedMap : null;
  };

  return {
    teamConfig,
    hasSavedTeamFile,
    productMapConfig,
    hasSavedProductMapFile,
    isLoading: teamFileQuery.isPending || productMapQuery.isPending,
    saveTeamConfig,
    saveProductMapConfig,
    suggestAndSaveTeam,
    suggestAndSaveProductMap,
  };
}
