import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { BotIcon, ExternalLinkIcon, EyeIcon, FileDiffIcon, FolderGit2Icon } from "lucide-react";
import { create } from "zustand";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { useRightPanelStore } from "../../rightPanelStore";
import { useProjects, useQuietThreadShells } from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { CoworkerAvatar } from "./CoworkerAvatar";
import type { ProjectPersona } from "./projectTeam.logic";
import { useActivePersonaStore } from "./useProjectTeam";

export interface DispatchedEmployeeRecord {
  readonly threadKey: string;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly employeeLabel: string;
  readonly personaId: string;
  readonly personaName: string;
  readonly personaRole: string;
  readonly personaColor: string;
  readonly repoLabel: string;
  readonly repoCwd: string;
  readonly instanceId: ProviderInstanceId;
  readonly model: string;
  readonly taskSummary: string;
  readonly dispatchedAt: string;
}

interface DispatchedEmployeesState {
  readonly recordsByThreadKey: Record<string, DispatchedEmployeeRecord>;
  readonly registerDispatchedEmployee: (record: DispatchedEmployeeRecord) => void;
}

export const useDispatchedEmployeesStore = create<DispatchedEmployeesState>((set) => ({
  recordsByThreadKey: {},
  registerDispatchedEmployee: (record) =>
    set((state) => ({
      recordsByThreadKey: {
        ...state.recordsByThreadKey,
        [record.threadKey]: record,
      },
    })),
}));

export interface LiveEmployeeViewItem {
  readonly threadKey: string;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly employeeLabel: string;
  readonly personaId: string;
  readonly roleLabel: string;
  readonly color: string;
  readonly repoLabel: string;
  readonly branchLabel: string | null;
  readonly isWorktree: boolean;
  readonly accountLabel: string;
  readonly model: string;
  readonly taskTitle: string;
  readonly status: "working" | "waiting" | "error" | "ready";
  readonly statusText: string;
  readonly updatedAt: string;
}

export function useLiveEmployeesList(input: {
  readonly activeProjectCwd: string | null;
  readonly linkedRepoCwds: ReadonlyArray<string>;
  readonly personas: ReadonlyArray<ProjectPersona>;
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
}): ReadonlyArray<LiveEmployeeViewItem> {
  const { activeProjectCwd, linkedRepoCwds, personas, providerEntries } = input;
  const threadShells = useQuietThreadShells();
  const projects = useProjects();
  const dispatchedByKey = useDispatchedEmployeesStore((s) => s.recordsByThreadKey);
  const activePersonaByKey = useActivePersonaStore((s) => s.activePersonaByThreadKey);

  const relevantCwds = new Set(
    [activeProjectCwd, ...linkedRepoCwds]
      .filter((cwd): cwd is string => Boolean(cwd && cwd.trim().length > 0))
      .map((cwd) => cwd.toLowerCase().replace(/\\/g, "/")),
  );

  const projectByIdKey = new Map(
    projects.map((proj) => [`${proj.environmentId}:${proj.id}`, proj] as const),
  );
  const providerByInstanceId = new Map(
    providerEntries.map((entry) => [entry.instanceId, entry] as const),
  );

  const items: LiveEmployeeViewItem[] = [];

  for (const shell of threadShells) {
    if (shell.archivedAt !== null) continue;
    const threadRef = scopeThreadRef(shell.environmentId, shell.id);
    const threadKey = scopedThreadKey(threadRef);
    const dispatched = dispatchedByKey[threadKey];
    const directPersona = activePersonaByKey[threadKey];
    const proj = projectByIdKey.get(`${shell.environmentId}:${shell.projectId}`);
    const normalizedProjCwd = proj?.workspaceRoot.toLowerCase().replace(/\\/g, "/") ?? "";

    const belongsToProductGroup =
      Boolean(dispatched) ||
      Boolean(directPersona) ||
      (relevantCwds.size > 0 && relevantCwds.has(normalizedProjCwd));

    if (!belongsToProductGroup) continue;

    const isWorking = threadRuntimeIsActive(shell.runtime);
    const hasPendingApproval = shell.hasPendingApprovals;
    const hasPendingUserInput = shell.hasPendingUserInput;
    const hasError = Boolean(shell.runtime?.lastError);

    const status: LiveEmployeeViewItem["status"] = hasError
      ? "error"
      : hasPendingApproval || hasPendingUserInput
        ? "waiting"
        : isWorking
          ? "working"
          : "ready";

    const statusText = hasError
      ? "Com erro"
      : hasPendingApproval
        ? "Aguardando aprovação"
        : hasPendingUserInput
          ? "Aguardando resposta"
          : isWorking
            ? "Trabalhando agora"
            : "Entrega pronta";

    const matchedPersona =
      (dispatched ? personas.find((p) => p.id === dispatched.personaId) : undefined) ??
      directPersona ??
      personas.find((p) => shell.title.toLowerCase().includes(p.name.toLowerCase())) ??
      personas[0];

    const instanceId =
      shell.runtime?.providerInstanceId ??
      shell.providerInstanceId ??
      dispatched?.instanceId ??
      matchedPersona?.instanceId;
    const accountEntry = instanceId ? providerByInstanceId.get(instanceId) : undefined;

    items.push({
      threadKey,
      environmentId: shell.environmentId,
      threadId: shell.id,
      employeeLabel: dispatched?.employeeLabel ?? matchedPersona?.name ?? "Coworker",
      personaId: dispatched?.personaId ?? matchedPersona?.id ?? "dev",
      roleLabel: dispatched?.personaRole ?? matchedPersona?.role ?? "Especialista",
      color: dispatched?.personaColor ?? matchedPersona?.color ?? "#6366f1",
      repoLabel: dispatched?.repoLabel ?? proj?.title ?? "Repositório",
      branchLabel: shell.branch,
      isWorktree: shell.worktreePath !== null,
      accountLabel: accountEntry?.displayName ?? String(instanceId ?? "Conta padrão"),
      model: shell.modelSelection.model || dispatched?.model || matchedPersona?.model || "modelo",
      taskTitle: shell.title || dispatched?.taskSummary || "Tarefa em andamento",
      status,
      statusText,
      updatedAt: shell.updatedAt,
    });
  }

  return items.sort((a, b) => {
    if (a.status === "working" && b.status !== "working") return -1;
    if (b.status === "working" && a.status !== "working") return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

interface ActiveEmployeesPanelProps {
  readonly employees: ReadonlyArray<LiveEmployeeViewItem>;
  readonly onOpenDispatcher: () => void;
  readonly onCloseContainer?: () => void;
}

export function ActiveEmployeesPanel({
  employees,
  onOpenDispatcher,
  onCloseContainer,
}: ActiveEmployeesPanelProps) {
  const navigate = useNavigate();

  const openEmployeeThread = (item: LiveEmployeeViewItem, panelKind?: "diff" | "preview") => {
    const ref = scopeThreadRef(item.environmentId, item.threadId);
    if (panelKind === "diff") {
      useRightPanelStore.getState().open(ref, "diff");
    } else if (panelKind === "preview") {
      useRightPanelStore.getState().openBrowser(ref, null);
    }
    onCloseContainer?.();
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(ref),
    });
  };

  const workingCount = employees.filter((e) => e.status === "working").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground text-xs">
              Painel de Funcionários Ativos (Multi-Repo & Worktrees)
            </h4>
            <Badge variant={workingCount > 0 ? "default" : "secondary"} size="sm">
              {workingCount} trabalhando · {employees.length} no total
            </Badge>
          </div>
          <p className="text-2xs text-muted-foreground">
            Acompanhe cada coworker em seu worktree isolado, inspecione o Diff ou abra o Preview.
          </p>
        </div>
        <Button size="xs" onClick={onOpenDispatcher}>
          <BotIcon className="size-3.5" />
          Escalar Funcionários em Paralelo
        </Button>
      </div>

      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center">
          <p className="font-medium text-foreground text-xs">
            Nenhum funcionário escalado em paralelo neste momento.
          </p>
          <p className="max-w-md text-2xs text-muted-foreground">
            Escale múltiplos funcionários (ex.: <code>Davi #1</code> na API + <code>Davi #2</code>{" "}
            no Web + <code>Dora Lins</code> no Design + <code>Quim Barros</code> no QA) em worktrees
            isolados.
          </p>
          <Button variant="outline" size="xs" onClick={onOpenDispatcher}>
            <BotIcon className="size-3.5" />
            Abrir Escalador de Squad
          </Button>
        </div>
      ) : (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {employees.map((item) => {
            const avatarStatus =
              item.status === "working"
                ? "working"
                : item.status === "waiting"
                  ? "warning"
                  : item.status === "error"
                    ? "error"
                    : "ready";
            return (
              <div
                key={item.threadKey}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 p-2.5 text-xs"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <CoworkerAvatar
                    color={item.color}
                    shape={
                      item.personaId === "principal" || item.personaId === "lider" ? "orb" : "cube"
                    }
                    size="md"
                    status={avatarStatus}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground">{item.employeeLabel}</span>
                      <span className="text-2xs text-muted-foreground">· {item.roleLabel}</span>
                      <Badge
                        variant={
                          item.status === "working"
                            ? "default"
                            : item.status === "error"
                              ? "destructive"
                              : "outline"
                        }
                        size="sm"
                      >
                        {item.statusText}
                      </Badge>
                    </div>
                    <p className="truncate font-medium text-foreground/90 text-xs">
                      {item.taskTitle}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                        <FolderGit2Icon className="size-3 text-primary" />
                        {item.repoLabel}
                      </span>
                      {item.branchLabel ? (
                        <span className="font-mono text-3xs">
                          branch: {item.branchLabel}
                          {item.isWorktree ? " (worktree)" : ""}
                        </span>
                      ) : null}
                      <span>
                        · {item.accountLabel} ({item.model})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => openEmployeeThread(item, "diff")}
                  >
                    <FileDiffIcon className="size-3.5" />
                    Ver Diff
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => openEmployeeThread(item, "preview")}
                  >
                    <EyeIcon className="size-3.5" />
                    Preview
                  </Button>
                  <Button variant="secondary" size="xs" onClick={() => openEmployeeThread(item)}>
                    <ExternalLinkIcon className="size-3.5" />
                    Abrir / Ajuste
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
