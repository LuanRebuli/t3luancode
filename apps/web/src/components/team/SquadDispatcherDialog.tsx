import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type EnvironmentId, type ProjectId, ProviderInstanceId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import { BotIcon, FolderGit2Icon, PlusIcon, RocketIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { newMessageId, newThreadId } from "../../lib/utils";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { useProjects } from "../../state/entities";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE } from "../../types";
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
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import {
  ActiveEmployeesPanel,
  type LiveEmployeeViewItem,
  useDispatchedEmployeesStore,
} from "./ActiveEmployeesPanel";
import { CoworkerAvatar } from "./CoworkerAvatar";
import {
  type AccountLiveSummary,
  buildEffortOptionSelections,
  EFFORT_OPTIONS,
  formatPersonaDirectModePrompt,
  type ProjectLinkedRepo,
  type ProjectLinkedRepoValidation,
  type ProjectPersona,
} from "./projectTeam.logic";
import { readProductGuardrailsForProject, useActivePersonaStore } from "./useProjectTeam";

interface DispatchSlot {
  readonly slotId: string;
  readonly personaId: string;
  readonly customLabel: string;
  readonly repoCwd: string;
  readonly repoLabel: string;
  readonly baseBranch: string;
  readonly useWorktree: boolean;
  readonly instanceId: ProviderInstanceId;
  readonly model: string;
  readonly effort: string | null;
  readonly taskBrief: string;
}

interface RepoTargetOption {
  readonly id: string;
  readonly label: string;
  readonly cwd: string;
  readonly baseBranch: string;
  readonly donoDoContrato?: boolean;
  readonly leiaAntes: ReadonlyArray<string>;
  readonly validacao?: ReadonlyArray<ProjectLinkedRepoValidation>;
}

interface SquadDispatcherDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly environmentId: EnvironmentId;
  readonly activeProjectId: ProjectId | null;
  readonly activeProjectName: string | null;
  readonly activeProjectCwd: string | null;
  readonly personas: ReadonlyArray<ProjectPersona>;
  readonly linkedRepos: ReadonlyArray<ProjectLinkedRepo>;
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
  readonly accountSummaries: ReadonlyArray<AccountLiveSummary>;
  readonly liveEmployees: ReadonlyArray<LiveEmployeeViewItem>;
}

function buildRepoOptions(input: {
  readonly activeProjectName: string | null;
  readonly activeProjectCwd: string | null;
  readonly linkedRepos: ReadonlyArray<ProjectLinkedRepo>;
  readonly registeredProjects: ReadonlyArray<{
    readonly id: ProjectId;
    readonly title: string;
    readonly workspaceRoot: string;
  }>;
}): ReadonlyArray<RepoTargetOption> {
  const seenCwds = new Set<string>();
  const options: RepoTargetOption[] = [];

  for (const linked of input.linkedRepos) {
    const key = linked.cwd.toLowerCase().replace(/\\/g, "/");
    if (seenCwds.has(key)) continue;
    seenCwds.add(key);
    options.push({
      id: linked.id,
      label: `${linked.label}${linked.donoDoContrato ? " (Dono do Contrato)" : ""}`,
      cwd: linked.cwd,
      baseBranch: linked.baseBranch || "main",
      ...(linked.donoDoContrato ? { donoDoContrato: true } : {}),
      leiaAntes: linked.leiaAntes,
      ...(linked.validacao ? { validacao: linked.validacao } : {}),
    });
  }

  if (input.activeProjectCwd) {
    const key = input.activeProjectCwd.toLowerCase().replace(/\\/g, "/");
    if (!seenCwds.has(key)) {
      seenCwds.add(key);
      options.push({
        id: "active-project",
        label: input.activeProjectName ?? "Repositório Atual",
        cwd: input.activeProjectCwd,
        baseBranch: "main",
        leiaAntes: ["AGENTS.md"],
      });
    }
  }

  for (const reg of input.registeredProjects) {
    const key = reg.workspaceRoot.toLowerCase().replace(/\\/g, "/");
    if (seenCwds.has(key)) continue;
    seenCwds.add(key);
    options.push({
      id: reg.id,
      label: reg.title,
      cwd: reg.workspaceRoot,
      baseBranch: "main",
      leiaAntes: ["AGENTS.md"],
    });
  }

  return options;
}

export function SquadDispatcherDialog({
  open,
  onOpenChange,
  environmentId,
  activeProjectId,
  activeProjectName,
  activeProjectCwd,
  personas,
  linkedRepos,
  providerEntries,
  accountSummaries,
  liveEmployees,
}: SquadDispatcherDialogProps) {
  const registeredProjects = useProjects();
  const startThreadTurn = useOrchestrationCommand(threadEnvironment.startTurn, {
    reportFailure: false,
  });

  const repoOptions = buildRepoOptions({
    activeProjectName,
    activeProjectCwd,
    linkedRepos,
    registeredProjects,
  });

  const healthyAccounts = accountSummaries
    .filter((summary) => summary.state !== "cooldown" && summary.state !== "unavailable")
    .flatMap((summary) => {
      const entry = providerEntries.find((e) => e.instanceId === summary.instanceId);
      return entry ? [entry] : [];
    });
  const poolAccounts = healthyAccounts.length > 0 ? healthyAccounts : providerEntries;

  const createSlotForPersona = (
    persona: ProjectPersona,
    slotIndex: number,
    preferredRepo?: RepoTargetOption,
    customBrief?: string,
    customLabel?: string,
  ): DispatchSlot => {
    const balancedAccount =
      poolAccounts[slotIndex % Math.max(1, poolAccounts.length)] ??
      providerEntries.find((e) => e.instanceId === persona.instanceId) ??
      providerEntries[0];
    const targetAccount =
      providerEntries.find((e) => e.instanceId === persona.instanceId) ?? balancedAccount;
    const chosenAccount =
      slotIndex > 0 && balancedAccount ? balancedAccount : (targetAccount ?? balancedAccount);
    const chosenInstanceId =
      chosenAccount?.instanceId ?? persona.instanceId ?? ProviderInstanceId.make("default:codex");
    const chosenModel =
      chosenAccount?.models.find((m) => m.slug === persona.model)?.slug ??
      chosenAccount?.models[0]?.slug ??
      persona.model;
    const repo = preferredRepo ?? repoOptions[slotIndex % Math.max(1, repoOptions.length)];

    return {
      slotId: `slot-${Date.now()}-${slotIndex}-${Math.random().toString(36).slice(2, 6)}`,
      personaId: persona.id,
      customLabel: customLabel ?? persona.name,
      repoCwd: repo?.cwd ?? activeProjectCwd ?? "",
      repoLabel: repo?.label ?? activeProjectName ?? "Repositório Atual",
      baseBranch: repo?.baseBranch ?? "main",
      useWorktree: true,
      instanceId: chosenInstanceId,
      model: chosenModel,
      effort: persona.effort ?? "high",
      taskBrief: customBrief ?? "",
    };
  };

  const buildInitialSlots = (): ReadonlyArray<DispatchSlot> => {
    const devPersona = personas.find((p) => p.id === "dev") ?? personas[0];
    const designPersona = personas.find((p) => p.id === "design") ?? personas[1] ?? devPersona;
    if (!devPersona) return [];
    const apiRepo =
      repoOptions.find((r) => r.id.includes("api") || r.label.toLowerCase().includes("api")) ??
      repoOptions[0];
    const webRepo =
      repoOptions.find((r) => r.id.includes("web") || r.label.toLowerCase().includes("web")) ??
      repoOptions[0];

    const slots: DispatchSlot[] = [
      createSlotForPersona(
        devPersona,
        0,
        apiRepo,
        "Implementar contratos, rotas e testes na camada de backend/serviço.",
        repoOptions.length > 1 ? "Davi #1 (API)" : "Davi #1",
      ),
      createSlotForPersona(
        devPersona,
        1,
        webRepo,
        "Implementar componentes visuais, integração de estado e estados vazios/loading no frontend.",
        repoOptions.length > 1 ? "Davi #2 (Web)" : "Davi #2",
      ),
    ];
    if (designPersona && designPersona.id !== devPersona.id) {
      slots.push(
        createSlotForPersona(
          designPersona,
          2,
          webRepo,
          "Polir hierarquia visual (skill impeccable), validar responsividade 360/768/1280px no preview_*.",
          designPersona.name,
        ),
      );
    }
    return slots;
  };

  const [globalObjective, setGlobalObjective] = useState("");
  const [slots, setSlots] = useState<ReadonlyArray<DispatchSlot>>(() => buildInitialSlots());
  const [isDispatching, setIsDispatching] = useState(false);

  const applyPreset = (presetKind: "multi_repo_squad" | "dual_davi" | "triad_delivery") => {
    const devPersona = personas.find((p) => p.id === "dev") ?? personas[0];
    const designPersona = personas.find((p) => p.id === "design") ?? devPersona;
    const qaPersona = personas.find((p) => p.id === "qa") ?? devPersona;
    if (!devPersona) return;

    const apiRepo =
      repoOptions.find((r) => r.id.includes("api") || r.label.toLowerCase().includes("api")) ??
      repoOptions[0];
    const webRepo =
      repoOptions.find((r) => r.id.includes("web") || r.label.toLowerCase().includes("web")) ??
      repoOptions[0];

    if (presetKind === "dual_davi") {
      setSlots([
        createSlotForPersona(
          devPersona,
          0,
          webRepo,
          "Abordagem A: Foco em arquitetura enxuta, reutilizando componentes existentes e máxima performance.",
          "Davi #1 (Abordagem A)",
        ),
        createSlotForPersona(
          devPersona,
          1,
          webRepo,
          "Abordagem B: Foco em experiência interativa rica, micro-interações e cobertura completa de edge cases.",
          "Davi #2 (Abordagem B)",
        ),
      ]);
      return;
    }

    if (presetKind === "triad_delivery") {
      const next: DispatchSlot[] = [
        createSlotForPersona(
          devPersona,
          0,
          webRepo,
          "Implementar a funcionalidade completa com typecheck e testes verdes.",
          "Davi #1 (Engenharia)",
        ),
      ];
      if (designPersona) {
        next.push(
          createSlotForPersona(
            designPersona,
            1,
            webRepo,
            "Refinar UI/UX seguindo impeccable e validar 360px/768px/1280px no preview_*.",
            "Dora Lins (Design & UI)",
          ),
        );
      }
      if (qaPersona) {
        next.push(
          createSlotForPersona(
            qaPersona,
            2,
            webRepo,
            "Caçar bugs, testar fluxos de erro/borda e garantir regressão zero.",
            "Quim Barros (QA & Caça-Bugs)",
          ),
        );
      }
      setSlots(next);
      return;
    }

    const multiSlots: DispatchSlot[] = [
      createSlotForPersona(
        devPersona,
        0,
        apiRepo,
        "Atualizar e validar contrato no backend (API First), garantindo typecheck + lint + test.",
        "Davi #1 (API · Contrato)",
      ),
      createSlotForPersona(
        devPersona,
        1,
        webRepo,
        "Consumir o contrato no frontend, mantendo fidelidade ao Mapa da Fonte da Verdade.",
        "Davi #2 (Web · Frontend)",
      ),
    ];
    if (designPersona) {
      multiSlots.push(
        createSlotForPersona(
          designPersona,
          2,
          webRepo,
          "Garantir acabamento visual nível produção (skill impeccable) e inspecionar no preview_*.",
          "Dora Lins (Design)",
        ),
      );
    }
    if (qaPersona) {
      multiSlots.push(
        createSlotForPersona(
          qaPersona,
          3,
          apiRepo,
          "Executar bateria de testes ponta a ponta e validar casos de falha.",
          "Quim Barros (QA)",
        ),
      );
    }
    setSlots(multiSlots);
  };

  const addSlot = () => {
    const devPersona = personas.find((p) => p.id === "dev") ?? personas[0];
    if (!devPersona) return;
    const existingDaviCount = slots.filter((s) => s.personaId === "dev").length;
    const nextLabel = devPersona.id === "dev" ? `Davi #${existingDaviCount + 1}` : devPersona.name;
    setSlots((current) => [
      ...current,
      createSlotForPersona(devPersona, current.length, repoOptions[0], "", nextLabel),
    ]);
  };

  const updateSlot = (slotId: string, patch: Partial<DispatchSlot>) => {
    setSlots((current) =>
      current.map((slot) => (slot.slotId === slotId ? { ...slot, ...patch } : slot)),
    );
  };

  const removeSlot = (slotId: string) => {
    setSlots((current) => current.filter((slot) => slot.slotId !== slotId));
  };

  const handleDispatchAll = async () => {
    if (slots.length === 0) return;
    if (!globalObjective.trim() && slots.every((s) => !s.taskBrief.trim())) {
      toastManager.add({
        type: "warning",
        title: "Descreva a missão do Squad",
        description:
          "Informe o objetivo principal ou a sub-tarefa de cada funcionário antes de escalar.",
      });
      return;
    }

    setIsDispatching(true);
    let launchedCount = 0;

    try {
      const createdAt = new Date().toISOString();
      await Promise.all(
        slots.map(async (slot) => {
          const persona = personas.find((p) => p.id === slot.personaId) ?? personas[0];
          if (!persona) return;

          const accountEntry = providerEntries.find(
            (entry) => entry.instanceId === slot.instanceId,
          );
          const effortOptions = buildEffortOptionSelections(accountEntry, slot.model, slot.effort);
          const modelSelection = createModelSelection(slot.instanceId, slot.model, effortOptions);

          const matchingRegisteredProject = registeredProjects.find(
            (proj) =>
              proj.workspaceRoot.toLowerCase().replace(/\\/g, "/") ===
              slot.repoCwd.toLowerCase().replace(/\\/g, "/"),
          );
          const targetProjectId = matchingRegisteredProject?.id ?? activeProjectId;
          if (!targetProjectId) return;

          const targetEnvId = matchingRegisteredProject?.environmentId ?? environmentId;
          const repoOption = repoOptions.find(
            (r) =>
              r.cwd.toLowerCase().replace(/\\/g, "/") ===
              slot.repoCwd.toLowerCase().replace(/\\/g, "/"),
          );

          const repoContextLines: string[] = [
            `<multi_repo_worktree_assignment>`,
            `Funcionário Escalado: **${slot.customLabel}** (${persona.role})`,
            `Repositório Alvo: **${slot.repoLabel}** (\`${slot.repoCwd}\`)`,
            `Branch Base: \`${slot.baseBranch}\` (${slot.useWorktree ? "Worktree Git Isolado" : " Diretório Principal"})`,
          ];
          if (repoOption?.donoDoContrato) {
            repoContextLines.push(
              `Regra de Contrato: Este repositório é o **DONO DO CONTRATO**. Mantenha schemas e payloads retrocompatíveis e documentados.`,
            );
          }
          if (repoOption?.leiaAntes && repoOption.leiaAntes.length > 0) {
            repoContextLines.push(
              `Leitura Obrigatória Antes de Editar (leiaAntes): ${repoOption.leiaAntes.map((f) => `\`${f}\``).join(", ")}`,
            );
          }
          if (repoOption?.validacao && repoOption.validacao.length > 0) {
            const cmds = repoOption.validacao.map((v) => v.comando).filter(Boolean);
            if (cmds.length > 0) {
              repoContextLines.push(
                `Comandos de Validação Obrigatórios antes de entregar: ${cmds.map((c) => `\`${c}\``).join(" && ")}`,
              );
            }
          }
          repoContextLines.push(`</multi_repo_worktree_assignment>`);

          const combinedUserTask = [
            globalObjective.trim() ? `## Objetivo Geral da Missão\n${globalObjective.trim()}` : "",
            slot.taskBrief.trim()
              ? `## Sua Atribuição Específica (${slot.customLabel})\n${slot.taskBrief.trim()}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          const personaPrompt = formatPersonaDirectModePrompt(
            { ...persona, name: slot.customLabel },
            combinedUserTask,
          );
          const guardrails = readProductGuardrailsForProject(targetEnvId, slot.repoCwd);
          const fullPrompt = [guardrails, repoContextLines.join("\n"), personaPrompt]
            .filter(Boolean)
            .join("\n\n");

          const targetThreadId = newThreadId();
          const shortObjective =
            (slot.taskBrief.trim() || globalObjective.trim()).slice(0, 48) ||
            "Execução em paralelo";
          const threadTitle = `[${slot.customLabel} · ${slot.repoLabel.split(" ")[0]}] ${shortObjective}`;

          const result = await startThreadTurn({
            environmentId: targetEnvId,
            input: {
              threadId: targetThreadId,
              message: {
                messageId: newMessageId(),
                role: "user",
                text: fullPrompt,
                attachments: [],
              },
              modelSelection,
              titleSeed: threadTitle,
              runtimeMode: DEFAULT_RUNTIME_MODE,
              interactionMode: DEFAULT_INTERACTION_MODE,
              bootstrap: {
                createThread: {
                  projectId: targetProjectId,
                  title: threadTitle,
                  modelSelection,
                  runtimeMode: DEFAULT_RUNTIME_MODE,
                  interactionMode: DEFAULT_INTERACTION_MODE,
                  branch: slot.baseBranch || "main",
                  worktreePath: null,
                  createdAt,
                },
                ...(slot.useWorktree && slot.repoCwd
                  ? {
                      prepareWorktree: {
                        projectCwd: slot.repoCwd,
                        baseBranch: slot.baseBranch || "main",
                        requireWorktree: false,
                      },
                      runSetupScript: true,
                    }
                  : {}),
              },
              createdAt,
            },
          });

          if (result._tag === "Success") {
            launchedCount += 1;
            const scopedKey = scopedThreadKey(scopeThreadRef(targetEnvId, targetThreadId));
            useActivePersonaStore.getState().setActivePersona(scopedKey, {
              ...persona,
              name: slot.customLabel,
            });
            useDispatchedEmployeesStore.getState().registerDispatchedEmployee({
              threadKey: scopedKey,
              environmentId: targetEnvId,
              threadId: targetThreadId,
              employeeLabel: slot.customLabel,
              personaId: persona.id,
              personaName: persona.name,
              personaRole: persona.role,
              personaColor: persona.color,
              repoLabel: slot.repoLabel,
              repoCwd: slot.repoCwd,
              instanceId: slot.instanceId,
              model: slot.model,
              taskSummary: shortObjective,
              dispatchedAt: createdAt,
            });
          }
        }),
      );

      if (launchedCount > 0) {
        toastManager.add({
          type: "success",
          title: `${launchedCount} ${launchedCount === 1 ? "funcionário escalado" : "funcionários escalados"} em paralelo!`,
          description:
            "Cada especialista iniciou em sua própria thread/worktree com guardrails da Fonte da Verdade.",
        });
      } else {
        toastManager.add({
          type: "error",
          title: "Não foi possível escalar os funcionários",
          description: "Verifique se há um projeto ativo selecionado.",
        });
      }
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-5xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-2">
              <UsersIcon className="size-5 text-primary" />
              <DialogTitle>
                Escalar Squad em Paralelo (Multi-Dev & Multi-Repo Worktrees)
              </DialogTitle>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="xs" onClick={() => applyPreset("multi_repo_squad")}>
                <FolderGit2Icon className="size-3.5" />
                Preset API + Web + UI + QA
              </Button>
              <Button variant="outline" size="xs" onClick={() => applyPreset("dual_davi")}>
                <BotIcon className="size-3.5" />
                2× Davi Rocha (A vs B)
              </Button>
              <Button variant="outline" size="xs" onClick={() => applyPreset("triad_delivery")}>
                Tríade Davi + Dora + Quim
              </Button>
              <Button variant="secondary" size="xs" onClick={addSlot}>
                <PlusIcon className="size-3.5" />
                Adicionar Funcionário
              </Button>
            </div>
          </div>
          <DialogDescription>
            Escale múltiplos funcionários simultaneamente em diferentes contas/modelos e em{" "}
            <code>git worktrees</code> isolados por repositório (ex.: <code>uarapoint-api</code> +{" "}
            <code>uarapoint-web</code>).
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-semibold text-foreground">
                Objetivo Geral da Missão (compartilhado com todos os funcionários escalados)
              </span>
              <Textarea
                rows={2}
                value={globalObjective}
                onChange={(e) => setGlobalObjective(e.target.value)}
                placeholder="Ex.: Criar o novo endpoint de previsão por pico em uarapoint-api e integrar o card na Tela Hoje em uarapoint-web respeitando o Quiver 3D..."
              />
            </label>

            <div className="flex max-h-[38vh] flex-col gap-3 overflow-y-auto pr-1">
              {slots.map((slot, index) => {
                const persona = personas.find((p) => p.id === slot.personaId) ?? personas[0];
                const accountEntry =
                  providerEntries.find((e) => e.instanceId === slot.instanceId) ??
                  providerEntries[0];
                const accountSummary = accountSummaries.find(
                  (s) => s.instanceId === slot.instanceId,
                );

                return (
                  <div
                    key={slot.slotId}
                    className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/60 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <CoworkerAvatar
                          color={persona?.color ?? "#6366f1"}
                          shape={persona?.id === "principal" ? "orb" : "cube"}
                          size="md"
                          status="working"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" size="sm">
                            Slot #{index + 1}
                          </Badge>
                          <select
                            value={slot.personaId}
                            onChange={(e) => {
                              const nextPersona = personas.find((p) => p.id === e.target.value);
                              if (!nextPersona) return;
                              const sameRoleCount = slots.filter(
                                (s) => s.slotId !== slot.slotId && s.personaId === nextPersona.id,
                              ).length;
                              const label =
                                nextPersona.scalable && sameRoleCount > 0
                                  ? `${nextPersona.name.split(" ")[0]} #${sameRoleCount + 1}`
                                  : nextPersona.name;
                              updateSlot(slot.slotId, {
                                personaId: nextPersona.id,
                                customLabel: label,
                                instanceId: nextPersona.instanceId,
                                model: nextPersona.model,
                                effort: nextPersona.effort,
                              });
                            }}
                            className="h-7 rounded-md border bg-background px-2 font-semibold text-foreground text-xs"
                          >
                            {personas.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.icon} {p.name}: {p.role}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={slot.customLabel}
                            onChange={(e) =>
                              updateSlot(slot.slotId, { customLabel: e.target.value })
                            }
                            placeholder="Identificação (ex.: Davi #1)"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {accountSummary?.lowestRemainingPercent !== null &&
                        accountSummary?.lowestRemainingPercent !== undefined ? (
                          <Badge variant="secondary" size="sm">
                            Quota: {accountSummary.lowestRemainingPercent}% livre
                          </Badge>
                        ) : null}
                        <Button variant="ghost" size="xs" onClick={() => removeSlot(slot.slotId)}>
                          <Trash2Icon className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Repositório Alvo (Multi-Repo)</span>
                        <select
                          value={slot.repoCwd}
                          onChange={(e) => {
                            const chosen = repoOptions.find((r) => r.cwd === e.target.value);
                            if (!chosen) return;
                            updateSlot(slot.slotId, {
                              repoCwd: chosen.cwd,
                              repoLabel: chosen.label,
                              baseBranch: chosen.baseBranch,
                            });
                          }}
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          {repoOptions.map((repo) => (
                            <option key={repo.cwd} value={repo.cwd}>
                              {repo.label} ({repo.cwd})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Conta Conectada</span>
                        <select
                          value={slot.instanceId}
                          onChange={(e) => {
                            const nextId = ProviderInstanceId.make(e.target.value);
                            const nextAcc = providerEntries.find(
                              (entry) => entry.instanceId === nextId,
                            );
                            updateSlot(slot.slotId, {
                              instanceId: nextId,
                              model: nextAcc?.models[0]?.slug ?? slot.model,
                            });
                          }}
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          {providerEntries.map((entry) => (
                            <option key={entry.instanceId} value={entry.instanceId}>
                              {entry.displayName} ({entry.driverKind})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Modelo</span>
                        <select
                          value={slot.model}
                          onChange={(e) => updateSlot(slot.slotId, { model: e.target.value })}
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          {(accountEntry?.models ?? []).map((m) => (
                            <option key={m.slug} value={m.slug}>
                              {m.name || m.slug}
                            </option>
                          ))}
                          {accountEntry &&
                          !accountEntry.models.some((m) => m.slug === slot.model) ? (
                            <option value={slot.model}>{slot.model}</option>
                          ) : null}
                        </select>
                      </label>

                      <div className="flex items-end justify-between gap-2">
                        <label className="flex flex-1 flex-col gap-1">
                          <span className="text-muted-foreground">Esforço</span>
                          <select
                            value={slot.effort ?? ""}
                            onChange={(e) =>
                              updateSlot(slot.slotId, {
                                effort: e.target.value || null,
                              })
                            }
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                          >
                            {EFFORT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2 text-2xs">
                          <input
                            type="checkbox"
                            checked={slot.useWorktree}
                            onChange={(e) =>
                              updateSlot(slot.slotId, { useWorktree: e.target.checked })
                            }
                            className="size-3.5 accent-primary"
                          />
                          <span>Worktree</span>
                        </label>
                      </div>
                    </div>

                    <Input
                      value={slot.taskBrief}
                      onChange={(e) => updateSlot(slot.slotId, { taskBrief: e.target.value })}
                      placeholder={`Sub-tarefa ou abordagem específica para ${slot.customLabel}...`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-3">
              <ActiveEmployeesPanel
                employees={liveEmployees}
                onOpenDispatcher={() => addSlot()}
                onCloseContainer={() => onOpenChange(false)}
              />
            </div>
          </div>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Fechar</DialogClose>
          <Button
            variant="default"
            disabled={isDispatching || slots.length === 0}
            onClick={() => void handleDispatchAll()}
          >
            <RocketIcon className="size-4" />
            {isDispatching
              ? "Escalando Funcionários..."
              : `Escalar ${slots.length} ${slots.length === 1 ? "Funcionário" : "Funcionários"} em Paralelo`}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
