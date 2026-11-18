import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
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
  parseProjectTeamConfig,
  type ProjectPersona,
  type ProjectTeamConfig,
  serializeProjectTeamConfig,
  suggestProjectTeam,
  summarizeAccountLiveStatus,
  T3_TEAM_FILE_PATH,
} from "./projectTeam.logic";

export type StudioModalKind = "team" | "dispatcher" | "product-map" | null;

interface ActivePersonaState {
  readonly activePersonaByThreadKey: Record<string, ProjectPersona | null>;
  readonly autoFallbackEnabled: boolean;
  readonly activeStudioDialog: StudioModalKind;
  readonly setActivePersona: (threadKey: string, persona: ProjectPersona | null) => void;
  readonly setAutoFallbackEnabled: (enabled: boolean) => void;
  readonly setActiveStudioDialog: (dialog: StudioModalKind) => void;
}

export const useActivePersonaStore = create<ActivePersonaState>((set) => ({
  activePersonaByThreadKey: {},
  autoFallbackEnabled: true,
  activeStudioDialog: null,
  setActivePersona: (threadKey, persona) =>
    set((state) => ({
      activePersonaByThreadKey: {
        ...state.activePersonaByThreadKey,
        [threadKey]: persona,
      },
    })),
  setAutoFallbackEnabled: (enabled) => set({ autoFallbackEnabled: enabled }),
  setActiveStudioDialog: (dialog) => set({ activeStudioDialog: dialog }),
}));

export function readActivePersonaForThread(threadKey: string): ProjectPersona | null {
  return useActivePersonaStore.getState().activePersonaByThreadKey[threadKey] ?? null;
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

export function useAccountLiveSummaries(
  providerInstanceEntries: ReadonlyArray<ProviderInstanceEntry>,
): ReadonlyArray<AccountLiveSummary> {
  const threadShells = useQuietThreadShells();
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);

  const activeCountByInstance = new Map<ProviderInstanceId, number>();
  for (const shell of threadShells) {
    if (!threadRuntimeIsActive(shell.runtime)) continue;
    const instanceId = shell.runtime?.providerInstanceId ?? shell.providerInstanceId;
    activeCountByInstance.set(instanceId, (activeCountByInstance.get(instanceId) ?? 0) + 1);
  }

  return providerInstanceEntries.map((entry) =>
    summarizeAccountLiveStatus({
      entry,
      activeAgentCount: activeCountByInstance.get(entry.instanceId) ?? 0,
      now,
    }),
  );
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
