import { ProviderInstanceId } from "@t3tools/contracts";
import {
  BotIcon,
  CheckIcon,
  FolderGit2Icon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { useProjects } from "../../state/entities";
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
import { CoworkerAvatar } from "./CoworkerAvatar";
import {
  applyOfficialWorkspacePreset,
  AVAILABLE_PERSONA_TOOLS,
  EFFORT_OPTIONS,
  OFFICIAL_LUAN_SKILLS,
  OFFICIAL_WORKSPACE_PRESETS,
  type OfficialWorkspacePresetId,
  type ProjectLinkedRepo,
  type ProjectPersona,
  type ProjectTeamConfig,
  T3_TEAM_FILE_PATH,
  UARAPOINT_DEFAULT_LINKED_REPOS,
} from "./projectTeam.logic";

interface ProjectTeamDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly projectName: string | null;
  readonly teamConfig: ProjectTeamConfig;
  readonly providerEntries: ReadonlyArray<ProviderInstanceEntry>;
  readonly activePersonaId: string | null;
  readonly onSelectDirectPersona: (persona: ProjectPersona | null) => void;
  readonly onSaveTeamConfig: (
    config: ProjectTeamConfig,
    options?: { readonly writeSkillFiles?: boolean; readonly toastTitle?: string },
  ) => Promise<boolean>;
  readonly onSuggestTeam: () => Promise<ProjectTeamConfig | null>;
}

function createBlankPersona(
  providerEntries: ReadonlyArray<ProviderInstanceEntry>,
  index: number,
): ProjectPersona {
  const defaultEntry = providerEntries.find((e) => e.isAvailable) ?? providerEntries[0];
  const instanceId = defaultEntry?.instanceId ?? ProviderInstanceId.make("default:codex");
  const model = defaultEntry?.models[0]?.slug ?? "gpt-5-codex";
  const id = `especialista-${index + 1}`;
  return {
    id,
    name: `Especialista ${index + 1}`,
    role: "Especialista de Domínio",
    jeito: "Focado em resultado prático, validação real e zero retrabalho.",
    aprova: "Aprovado.",
    reprova: "Precisa de ajuste.",
    icon: "🛠️",
    color: "#6366f1",
    instanceId,
    model,
    effort: "high",
    allowedTools: ["preview_*", "git_worktree", "terminal", "file_edit"],
    skills: [`.t3/skills/${id}.md`, "impeccable"],
    qualityChecklist: [
      "Validar entrega no preview_* antes de concluir",
      "Garantir que typecheck e testes passem sem erros",
    ],
    systemPrompt: `Você é um especialista dedicado ao projeto. Execute com alta precisão técnica e sempre valide o resultado real.`,
    scalable: true,
  };
}

export function ProjectTeamDialog(props: ProjectTeamDialogProps) {
  const {
    open,
    onOpenChange,
    projectName,
    teamConfig,
    providerEntries,
    activePersonaId,
    onSelectDirectPersona,
    onSaveTeamConfig,
    onSuggestTeam,
  } = props;

  const registeredProjects = useProjects();
  const [activeTab, setActiveTab] = useState<"squad" | "repos" | "context">("squad");
  const [draftConfig, setDraftConfig] = useState<ProjectTeamConfig>(teamConfig);
  const [prevTeamConfig, setPrevTeamConfig] = useState<ProjectTeamConfig>(teamConfig);
  if (teamConfig !== prevTeamConfig) {
    setPrevTeamConfig(teamConfig);
    setDraftConfig(teamConfig);
  }

  const [selectedId, setSelectedId] = useState<string | null>(
    () => draftConfig.personas[0]?.id ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const selectedPersona =
    draftConfig.personas.find((p) => p.id === selectedId) ?? draftConfig.personas[0] ?? null;

  const updatePersona = (id: string, patch: Partial<ProjectPersona>) => {
    setDraftConfig((current) => ({
      ...current,
      personas: current.personas.map((persona) =>
        persona.id === id ? { ...persona, ...patch } : persona,
      ),
    }));
  };

  const handleAddPersona = () => {
    const nextPersona = createBlankPersona(providerEntries, draftConfig.personas.length);
    setDraftConfig((current) => ({
      ...current,
      personas: [...current.personas, nextPersona],
    }));
    setSelectedId(nextPersona.id);
    setActiveTab("squad");
  };

  const handleDeletePersona = (id: string) => {
    const remaining = draftConfig.personas.filter((p) => p.id !== id);
    setDraftConfig((current) => ({
      ...current,
      personas: remaining,
    }));
    if (selectedId === id) {
      setSelectedId(remaining[0]?.id ?? null);
    }
    if (activePersonaId === id) {
      onSelectDirectPersona(null);
    }
  };

  const linkedRepos = draftConfig.linkedRepos ?? [];

  const updateLinkedRepo = (index: number, patch: Partial<ProjectLinkedRepo>) => {
    setDraftConfig((current) => {
      const currentRepos = current.linkedRepos ?? [];
      return {
        ...current,
        linkedRepos: currentRepos.map((repo, idx) =>
          idx === index ? { ...repo, ...patch } : repo,
        ),
      };
    });
  };

  const addLinkedRepo = (preset?: Partial<ProjectLinkedRepo>) => {
    const nextIdx = linkedRepos.length + 1;
    const nextRepo: ProjectLinkedRepo = {
      id: preset?.id ?? `repo-${nextIdx}`,
      label: preset?.label ?? `Repositório ${nextIdx}`,
      cwd: preset?.cwd ?? "D:/Projects/meu-repo",
      baseBranch: preset?.baseBranch ?? "main",
      role: preset?.role ?? (nextIdx === 1 ? "api" : "web"),
      donoDoContrato: preset?.donoDoContrato ?? nextIdx === 1,
      leiaAntes: preset?.leiaAntes ?? ["AGENTS.md"],
      validacao: preset?.validacao ?? [
        { id: `VAL-${nextIdx}-1`, comando: "npm run typecheck" },
        { id: `VAL-${nextIdx}-2`, comando: "npm run lint" },
        { id: `VAL-${nextIdx}-3`, comando: "npm test" },
      ],
    };
    setDraftConfig((current) => ({
      ...current,
      linkedRepos: [...(current.linkedRepos ?? []), nextRepo],
    }));
  };

  const removeLinkedRepo = (index: number) => {
    setDraftConfig((current) => ({
      ...current,
      linkedRepos: (current.linkedRepos ?? []).filter((_, idx) => idx !== index),
    }));
  };

  const loadUarapointMultiRepoPreset = () => {
    setDraftConfig((current) => ({
      ...current,
      linkedRepos: UARAPOINT_DEFAULT_LINKED_REPOS,
    }));
  };

  const handleApplyPreset = (presetId: OfficialWorkspacePresetId) => {
    const nextConfig = applyOfficialWorkspacePreset({
      presetId,
      providerEntries,
    });
    setDraftConfig(nextConfig);
    setSelectedId(nextConfig.personas[0]?.id ?? null);
  };

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const suggested = await onSuggestTeam();
      if (suggested) {
        setDraftConfig(suggested);
        setSelectedId(suggested.personas[0]?.id ?? null);
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ok = await onSaveTeamConfig(draftConfig, {
        writeSkillFiles: true,
        toastTitle: "Squad oficial, Skills e Multi-Repo salvos com sucesso!",
      });
      if (ok) {
        if (activePersonaId) {
          const updatedActive = draftConfig.personas.find((p) => p.id === activePersonaId) ?? null;
          onSelectDirectPersona(updatedActive);
        }
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const selectedAccountEntry = selectedPersona
    ? (providerEntries.find((entry) => entry.instanceId === selectedPersona.instanceId) ??
      providerEntries[0])
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-5xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-2">
              <UsersIcon className="size-5 text-primary" />
              <DialogTitle>
                Squad Oficial & Multi-Repo: {projectName ?? "Projeto Atual"}
              </DialogTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={activeTab === "squad" ? "default" : "outline"}
                size="xs"
                onClick={() => setActiveTab("squad")}
              >
                <UsersIcon className="size-3.5" />
                Coworkers ({draftConfig.personas.length})
              </Button>
              <Button
                variant={activeTab === "repos" ? "default" : "outline"}
                size="xs"
                onClick={() => setActiveTab("repos")}
              >
                <FolderGit2Icon className="size-3.5" />
                Multi-Repo ({linkedRepos.length})
              </Button>
              <Button
                variant={activeTab === "context" ? "default" : "outline"}
                size="xs"
                onClick={() => setActiveTab("context")}
              >
                Regras da Org {draftConfig.workspaceContext ? "✓" : ""}
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={isSuggesting}
                onClick={() => void handleSuggest()}
              >
                <BotIcon className="size-3.5" />
                {isSuggesting ? "Sincronizando..." : "Auto-Detectar Squad"}
              </Button>
              <Button variant="secondary" size="xs" onClick={handleAddPersona}>
                <PlusIcon className="size-3.5" />
                Novo Especialista
              </Button>
            </div>
          </div>
          <DialogDescription>
            Unifica a identidade visual de <code>C:\Users\Luan\.agents\squad\equipe.json</code> com
            os agentes, instruções e skills reais do seu banco <code>agentes.chat</code> (salvo em{" "}
            <code>{T3_TEAM_FILE_PATH}</code> + <code>.t3/skills/*.md</code>).
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/60 px-3.5 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-foreground">
                  Presets Oficiais (agentes.chat + squad):
                </span>
                {OFFICIAL_WORKSPACE_PRESETS.map((preset) => {
                  const isActivePreset = draftConfig.workspacePresetId === preset.id;
                  return (
                    <Button
                      key={preset.id}
                      variant={isActivePreset ? "default" : "outline"}
                      size="xs"
                      onClick={() => handleApplyPreset(preset.id)}
                      title={preset.summary}
                    >
                      {preset.name} ({preset.agents.length})
                    </Button>
                  );
                })}
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 font-medium text-foreground">
                <ZapIcon className="size-3.5 text-warning" />
                <input
                  type="checkbox"
                  checked={draftConfig.autoFallbackOnRateLimit}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      autoFallbackOnRateLimit: event.target.checked,
                    }))
                  }
                  className="size-3.5 accent-primary"
                />
                <span>Auto-Fallback 85%</span>
              </label>
            </div>

            {activeTab === "context" ? (
              <div className="flex flex-col gap-3 rounded-xl border bg-card/40 p-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">
                      Contexto e Regras Duras do Workspace (agentes.chat)
                    </h4>
                    <p className="text-muted-foreground">
                      Injetado automaticamente em todos os turnos dos coworkers deste projeto junto
                      com o Mapa Fonte da Verdade (<code>.t3/product-map.json</code>).
                    </p>
                  </div>
                  {draftConfig.workspacePresetId ? (
                    <Badge variant="secondary" size="sm">
                      Preset: {draftConfig.workspacePresetId}
                    </Badge>
                  ) : null}
                </div>
                <textarea
                  rows={14}
                  value={draftConfig.workspaceContext ?? ""}
                  onChange={(e) =>
                    setDraftConfig((current) => ({
                      ...current,
                      workspaceContext: e.target.value,
                    }))
                  }
                  placeholder="Regras de operação, caminhos canônicos, portas locais, invariantes e proibições do workspace..."
                  className="w-full rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed"
                />
              </div>
            ) : activeTab === "repos" ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card/50 p-3">
                  <div>
                    <h4 className="font-semibold text-foreground text-xs">
                      Repositórios Irmãos Vinculados (Grupo de Produto API + Web)
                    </h4>
                    <p className="text-2xs text-muted-foreground">
                      Permite escalar `Davi #1` no worktree da API (`donoDoContrato: true`) e `Davi
                      #2` no worktree do Web simultaneamente.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="xs" onClick={loadUarapointMultiRepoPreset}>
                      Carregar Preset Uarapoint (API + Web)
                    </Button>
                    <Button variant="secondary" size="xs" onClick={() => addLinkedRepo()}>
                      <PlusIcon className="size-3.5" />
                      Vincular Repositório
                    </Button>
                  </div>
                </div>

                {registeredProjects.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Importar projeto cadastrado:</span>
                    {registeredProjects.map((proj) => {
                      const alreadyLinked = linkedRepos.some(
                        (r) => r.cwd.toLowerCase() === proj.workspaceRoot.toLowerCase(),
                      );
                      return (
                        <Button
                          key={`${proj.environmentId}:${proj.id}`}
                          variant="outline"
                          size="xs"
                          disabled={alreadyLinked}
                          onClick={() =>
                            addLinkedRepo({
                              id: proj.title.toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
                              label: proj.title,
                              cwd: proj.workspaceRoot,
                              role: proj.title.toLowerCase().includes("api") ? "api" : "web",
                              donoDoContrato: proj.title.toLowerCase().includes("api"),
                            })
                          }
                        >
                          + {proj.title}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}

                {linkedRepos.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-xs">
                    Nenhum repositório irmão vinculado ainda. Clique em &ldquo;Carregar Preset
                    Uarapoint (API + Web)&rdquo; ou vincule qualquer projeto do T3.
                  </div>
                ) : (
                  <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
                    {linkedRepos.map((repo, idx) => (
                      <div
                        key={repo.id || repo.cwd}
                        className="flex flex-col gap-2.5 rounded-xl border bg-card/40 p-3.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FolderGit2Icon className="size-4 text-primary" />
                            <span className="font-semibold text-foreground">{repo.label}</span>
                            {repo.donoDoContrato ? (
                              <Badge variant="default" size="sm">
                                Dono do Contrato
                              </Badge>
                            ) : null}
                          </div>
                          <Button
                            variant="destructive-outline"
                            size="xs"
                            onClick={() => removeLinkedRepo(idx)}
                          >
                            <Trash2Icon className="size-3.5" />
                            Desvincular
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                          <label className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Nome / Label</span>
                            <input
                              type="text"
                              value={repo.label}
                              onChange={(e) => updateLinkedRepo(idx, { label: e.target.value })}
                              className="h-8 rounded-md border bg-background px-2 text-xs"
                            />
                          </label>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-muted-foreground">Caminho Absoluto (cwd)</span>
                            <input
                              type="text"
                              value={repo.cwd}
                              onChange={(e) => updateLinkedRepo(idx, { cwd: e.target.value })}
                              className="h-8 rounded-md border bg-background px-2 font-mono text-xs"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Papel & Base Branch</span>
                            <div className="flex gap-1.5">
                              <select
                                value={repo.role}
                                onChange={(e) =>
                                  updateLinkedRepo(idx, {
                                    role: e.target.value as ProjectLinkedRepo["role"],
                                  })
                                }
                                className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                              >
                                <option value="api">API</option>
                                <option value="web">Web</option>
                                <option value="fullstack">Fullstack</option>
                                <option value="shared">Shared</option>
                              </select>
                              <input
                                type="text"
                                value={repo.baseBranch}
                                onChange={(e) =>
                                  updateLinkedRepo(idx, { baseBranch: e.target.value })
                                }
                                className="h-8 w-20 rounded-md border bg-background px-2 font-mono text-xs"
                                placeholder="main"
                              />
                            </div>
                          </label>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-muted-foreground">
                              Arquivos Obrigatórios (leiaAntes, separados por vírgula)
                            </span>
                            <input
                              type="text"
                              value={repo.leiaAntes.join(", ")}
                              onChange={(e) =>
                                updateLinkedRepo(idx, {
                                  leiaAntes: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="h-8 rounded-md border bg-background px-2 font-mono text-xs"
                            />
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 pt-5 font-medium text-foreground">
                            <input
                              type="checkbox"
                              checked={Boolean(repo.donoDoContrato)}
                              onChange={(e) =>
                                updateLinkedRepo(idx, { donoDoContrato: e.target.checked })
                              }
                              className="size-4 accent-primary"
                            />
                            Dono do Contrato (API First)
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : draftConfig.personas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-10 text-center">
                <p className="font-medium text-foreground text-sm">
                  Nenhum personagem configurado neste projeto ainda.
                </p>
                <p className="max-w-md text-muted-foreground text-xs">
                  Clique em &ldquo;Sincronizar Squad Oficial&rdquo; para importar Nina Prado, Otto
                  Maia, Iris Tanaka, Caio Brandão, Dora Lins, Davi Rocha, Quim Barros, Rui Sampaio,
                  Lia Ferraz e os especialistas de domínio do projeto.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  disabled={isSuggesting}
                  onClick={() => void handleSuggest()}
                >
                  <BotIcon className="size-4" />
                  Importar Squad Oficial Agora
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                <div className="flex max-h-[56vh] flex-col gap-1.5 overflow-y-auto pr-1">
                  {draftConfig.personas.map((persona) => {
                    const isSelected = selectedPersona?.id === persona.id;
                    const isDirectActive = activePersonaId === persona.id;
                    const accountEntry = providerEntries.find(
                      (entry) => entry.instanceId === persona.instanceId,
                    );
                    const isChief = persona.id === "principal" || persona.id === "lider";
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => setSelectedId(persona.id)}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-accent/60 text-foreground"
                            : "border-border/60 bg-card/50 text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                        }`}
                      >
                        <CoworkerAvatar
                          color={persona.color}
                          shape={isChief ? "orb" : "cube"}
                          size="sm"
                          status={isDirectActive ? "working" : "idle"}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-semibold text-foreground text-xs">
                              {persona.name}
                            </span>
                            {isDirectActive ? (
                              <Badge variant="default" size="sm">
                                DIRETO
                              </Badge>
                            ) : persona.scalable ? (
                              <Badge variant="outline" size="sm">
                                N×
                              </Badge>
                            ) : null}
                          </div>
                          <span className="truncate text-2xs text-muted-foreground">
                            {persona.role}
                          </span>
                          <span className="truncate font-medium text-3xs text-foreground/80">
                            {accountEntry?.displayName ?? persona.instanceId} · {persona.model}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedPersona ? (
                  <div className="flex max-h-[56vh] flex-col gap-3 overflow-y-auto rounded-xl border bg-card/40 p-4 pr-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div className="flex items-center gap-3">
                        <CoworkerAvatar
                          color={selectedPersona.color}
                          shape={
                            selectedPersona.id === "principal" || selectedPersona.id === "lider"
                              ? "orb"
                              : "cube"
                          }
                          size="md"
                          status={activePersonaId === selectedPersona.id ? "working" : "ready"}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground text-sm">
                              {selectedPersona.name}
                            </h4>
                            <Badge variant="outline" size="sm">
                              {selectedPersona.id}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">{selectedPersona.role}</p>
                          {selectedPersona.jeito ? (
                            <p className="mt-0.5 text-2xs text-foreground/80 italic">
                              &ldquo;{selectedPersona.jeito}&rdquo;
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={activePersonaId === selectedPersona.id ? "secondary" : "default"}
                          size="xs"
                          onClick={() => {
                            if (activePersonaId === selectedPersona.id) {
                              onSelectDirectPersona(null);
                            } else {
                              onSelectDirectPersona(selectedPersona);
                            }
                          }}
                        >
                          <CheckIcon className="size-3.5" />
                          {activePersonaId === selectedPersona.id
                            ? "Ativo no Modo Direto"
                            : "Falar Direto no Chat"}
                        </Button>
                        <Button
                          variant="destructive-outline"
                          size="xs"
                          onClick={() => handleDeletePersona(selectedPersona.id)}
                        >
                          <Trash2Icon className="size-3.5" />
                          Remover
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                      <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                        <span className="font-medium text-muted-foreground">
                          Nome do Personagem
                        </span>
                        <input
                          type="text"
                          value={selectedPersona.name}
                          onChange={(e) =>
                            updatePersona(selectedPersona.id, { name: e.target.value })
                          }
                          className="h-8 rounded-md border bg-background px-2.5 text-foreground text-xs"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Cor Cubo 3D</span>
                        <input
                          type="color"
                          value={selectedPersona.color}
                          onChange={(e) =>
                            updatePersona(selectedPersona.id, { color: e.target.value })
                          }
                          className="h-8 w-full cursor-pointer rounded-md border bg-background px-1"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Cargo / Papel</span>
                        <input
                          type="text"
                          value={selectedPersona.role}
                          onChange={(e) =>
                            updatePersona(selectedPersona.id, { role: e.target.value })
                          }
                          className="h-8 rounded-md border bg-background px-2.5 text-foreground text-xs"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">
                          Jeito / Personalidade
                        </span>
                        <input
                          type="text"
                          value={selectedPersona.jeito ?? ""}
                          onChange={(e) =>
                            updatePersona(selectedPersona.id, { jeito: e.target.value })
                          }
                          className="h-8 rounded-md border bg-background px-2.5 text-foreground text-xs"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">
                          Veredito Aprova (equipe.json)
                        </span>
                        <input
                          type="text"
                          value={selectedPersona.aprova ?? ""}
                          onChange={(e) =>
                            updatePersona(selectedPersona.id, { aprova: e.target.value })
                          }
                          className="h-8 rounded-md border bg-background px-2.5 text-foreground text-xs"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">
                          Veredito Reprova (equipe.json)
                        </span>
                        <input
                          type="text"
                          value={selectedPersona.reprova ?? ""}
                          onChange={(e) =>
                            updatePersona(selectedPersona.id, { reprova: e.target.value })
                          }
                          className="h-8 rounded-md border bg-background px-2.5 text-foreground text-xs"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-semibold text-foreground">
                          Conta Conectada (Provider Instance)
                        </span>
                        <select
                          value={selectedPersona.instanceId}
                          onChange={(e) => {
                            const nextInstanceId = ProviderInstanceId.make(e.target.value);
                            const nextEntry = providerEntries.find(
                              (entry) => entry.instanceId === nextInstanceId,
                            );
                            const nextModel =
                              nextEntry?.models.find((m) => m.slug === selectedPersona.model)
                                ?.slug ??
                              nextEntry?.models[0]?.slug ??
                              selectedPersona.model;
                            updatePersona(selectedPersona.id, {
                              instanceId: nextInstanceId,
                              model: nextModel,
                            });
                          }}
                          className="h-8 rounded-md border bg-background px-2 text-foreground text-xs"
                        >
                          {providerEntries.map((entry) => (
                            <option key={entry.instanceId} value={entry.instanceId}>
                              {entry.displayName} ({entry.driverKind})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-semibold text-foreground">Modelo Padrão</span>
                        <select
                          value={selectedPersona.model}
                          onChange={(e) =>
                            updatePersona(selectedPersona.id, { model: e.target.value })
                          }
                          className="h-8 rounded-md border bg-background px-2 text-foreground text-xs"
                        >
                          {(selectedAccountEntry?.models ?? []).map((model) => (
                            <option key={model.slug} value={model.slug}>
                              {model.name || model.slug}
                            </option>
                          ))}
                          {selectedAccountEntry &&
                          !selectedAccountEntry.models.some(
                            (m) => m.slug === selectedPersona.model,
                          ) ? (
                            <option value={selectedPersona.model}>{selectedPersona.model}</option>
                          ) : null}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-semibold text-foreground">Esforço / Thinking</span>
                        <select
                          value={selectedPersona.effort ?? ""}
                          onChange={(e) =>
                            updatePersona(selectedPersona.id, {
                              effort: e.target.value || null,
                            })
                          }
                          className="h-8 rounded-md border bg-background px-2 text-foreground text-xs"
                        >
                          {EFFORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Skills Oficiais Vinculadas (<code>C:\Users\Luan\.agents\skills</code>)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {OFFICIAL_LUAN_SKILLS.map((skill) => {
                          const checked = selectedPersona.skills.includes(skill.id);
                          return (
                            <label
                              key={skill.id}
                              className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-2xs transition-colors ${
                                checked
                                  ? "border-primary bg-primary/10 font-medium text-foreground"
                                  : "bg-background text-muted-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const nextSkills = e.target.checked
                                    ? [...selectedPersona.skills, skill.id]
                                    : selectedPersona.skills.filter((s) => s !== skill.id);
                                  updatePersona(selectedPersona.id, { skills: nextSkills });
                                }}
                                className="size-3 accent-primary"
                              />
                              <span>{skill.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Ferramentas Permitidas
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_PERSONA_TOOLS.map((tool) => {
                          const checked = selectedPersona.allowedTools.includes(tool.id);
                          return (
                            <label
                              key={tool.id}
                              className="flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const nextTools = e.target.checked
                                    ? [...selectedPersona.allowedTools, tool.id]
                                    : selectedPersona.allowedTools.filter((t) => t !== tool.id);
                                  updatePersona(selectedPersona.id, { allowedTools: nextTools });
                                }}
                                className="size-3.5 accent-primary"
                              />
                              <span>{tool.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Diretriz do Personagem (System Prompt)
                      </span>
                      <textarea
                        rows={3}
                        value={selectedPersona.systemPrompt}
                        onChange={(e) =>
                          updatePersona(selectedPersona.id, { systemPrompt: e.target.value })
                        }
                        className="rounded-md border bg-background p-2.5 text-foreground text-xs"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-medium text-muted-foreground">
                        Critérios de Qualidade Ship-It (1 por linha, gera{" "}
                        <code>.t3/skills/{selectedPersona.id}.md</code>)
                      </span>
                      <textarea
                        rows={3}
                        value={selectedPersona.qualityChecklist.join("\n")}
                        onChange={(e) =>
                          updatePersona(selectedPersona.id, {
                            qualityChecklist: e.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean),
                          })
                        }
                        className="rounded-md border bg-background p-2.5 text-foreground text-xs"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button variant="default" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? "Salvando..." : "Salvar Squad, Skills & Multi-Repo (.t3/team.json)"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
