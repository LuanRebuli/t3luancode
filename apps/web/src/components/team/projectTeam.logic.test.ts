import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { ProviderInstanceEntry } from "../../providerInstances";
import {
  formatProductMapGuardrailsPrompt,
  parseProductMapConfig,
  serializeProductMapConfig,
  suggestProductMap,
} from "./productMap.logic";
import {
  buildPersonaSkillMarkdown,
  formatPersonaDirectModePrompt,
  parseProjectTeamConfig,
  resolveFallbackAccountSelection,
  serializeProjectTeamConfig,
  suggestProjectTeam,
  summarizeAccountLiveStatus,
} from "./projectTeam.logic";

function makeMockProviderEntry(
  overrides: Partial<ProviderInstanceEntry> & {
    readonly instanceId: ProviderInstanceId;
    readonly displayName: string;
  },
): ProviderInstanceEntry {
  const { instanceId, displayName, ...rest } = overrides;
  return {
    instanceId,
    driverKind: ProviderDriverKind.make("claudeAgent"),
    displayName,
    accentColor: "#d97706",
    enabled: true,
    installed: true,
    isDefault: false,
    status: "ready",
    isAvailable: true,
    models: [
      {
        slug: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        isCustom: false,
        capabilities: null,
      },
    ],
    snapshot: {
      instanceId,
      driver: ProviderDriverKind.make("claudeAgent"),
      displayName,
      enabled: true,
      installed: true,
      version: "1.0.0",
      status: "ready",
      auth: { status: "authenticated" },
      availability: "available",
      checkedAt: "2026-11-17T20:00:00.000Z",
      models: [],
      slashCommands: [],
      skills: [],
    },
    ...rest,
  };
}

describe("projectTeam.logic & productMap.logic", () => {
  const now = Date.parse("2026-11-17T20:00:00.000Z");

  it("summarizes live status across available, in_use, near_limit, and cooldown accounts", () => {
    const accountA = makeMockProviderEntry({
      instanceId: ProviderInstanceId.make("claude-a"),
      displayName: "Claude Conta A",
      snapshot: {
        instanceId: ProviderInstanceId.make("claude-a"),
        driver: ProviderDriverKind.make("claudeAgent"),
        displayName: "Claude Conta A",
        enabled: true,
        installed: true,
        version: "1.0.0",
        status: "ready",
        auth: { status: "authenticated" },
        availability: "available",
        checkedAt: "2026-11-17T20:00:00.000Z",
        models: [],
        slashCommands: [],
        skills: [],
        usageLimits: {
          checkedAt: "2026-11-17T20:00:00.000Z",
          windows: [
            {
              id: "5h",
              kind: "session",
              label: "5h window",
              usedPercent: 100,
              resetsAt: "2026-11-17T21:00:00.000Z",
            },
          ],
        },
      },
    });

    const accountB = makeMockProviderEntry({
      instanceId: ProviderInstanceId.make("claude-b"),
      displayName: "Claude Conta B",
      snapshot: {
        instanceId: ProviderInstanceId.make("claude-b"),
        driver: ProviderDriverKind.make("claudeAgent"),
        displayName: "Claude Conta B",
        enabled: true,
        installed: true,
        version: "1.0.0",
        status: "ready",
        auth: { status: "authenticated" },
        availability: "available",
        checkedAt: "2026-11-17T20:00:00.000Z",
        models: [],
        slashCommands: [],
        skills: [],
        usageLimits: {
          checkedAt: "2026-11-17T20:00:00.000Z",
          windows: [
            {
              id: "5h",
              kind: "session",
              label: "5h window",
              usedPercent: 25,
              resetsAt: "2026-11-17T22:00:00.000Z",
            },
          ],
        },
      },
    });

    const summaryA = summarizeAccountLiveStatus({
      entry: accountA,
      activeAgentCount: 0,
      now,
    });
    expect(summaryA.state).toBe("cooldown");
    expect(summaryA.lowestRemainingPercent).toBe(0);

    const summaryB = summarizeAccountLiveStatus({
      entry: accountB,
      activeAgentCount: 2,
      now,
    });
    expect(summaryB.state).toBe("in_use");
    expect(summaryB.lowestRemainingPercent).toBe(75);
    expect(summaryB.stateLabel).toContain("2 ag");

    const fallback = resolveFallbackAccountSelection({
      currentSelection: {
        instanceId: accountA.instanceId,
        model: "claude-sonnet-4-5",
      },
      summaries: [summaryA, summaryB],
      autoFallbackEnabled: true,
    });

    expect(fallback).not.toBeNull();
    expect(fallback?.switchedTo.instanceId).toBe(accountB.instanceId);
    expect(fallback?.selection.model).toBe("claude-sonnet-4-5");
  });

  it("includes Luan's official 9-member squad plus agentes.chat workspace specialists and multi-repo config", () => {
    const entries = [
      makeMockProviderEntry({
        instanceId: ProviderInstanceId.make("claude-a"),
        displayName: "Claude Conta A",
        driverKind: ProviderDriverKind.make("claudeAgent"),
      }),
      makeMockProviderEntry({
        instanceId: ProviderInstanceId.make("codex-main"),
        displayName: "Codex Principal",
        driverKind: ProviderDriverKind.make("codex"),
      }),
    ];

    const uaraTeam = suggestProjectTeam({
      projectName: "uarapoint-web",
      projectCwd: "D:/Projects/uarapoint-web",
      filePaths: ["src/components/Quiver3D.tsx", "src/services/swellForecast.ts"],
      providerEntries: entries,
    });

    const officialNames = uaraTeam.personas.map((p) => p.name).join(" | ");
    expect(officialNames).toContain("Nina Prado");
    expect(officialNames).toContain("Otto Maia");
    expect(officialNames).toContain("Iris Tanaka");
    expect(officialNames).toContain("Caio Brandão");
    expect(officialNames).toContain("Dora Lins");
    expect(officialNames).toContain("Davi Rocha Web (@dev-web)");
    expect(officialNames).toContain("Davi Rocha API (@dev-api)");
    expect(officialNames).toContain("Quim Barros");
    expect(officialNames).toContain("Rui Sampaio");
    expect(officialNames).toContain("Lia Ferraz");
    expect(officialNames).toContain("Cauã Marinho (@surf)");

    expect(uaraTeam.workspacePresetId).toBe("uarapoint");
    expect(uaraTeam.workspaceContext).toContain("Uarapoint");
    expect(uaraTeam.linkedRepos?.length).toBe(3);
    expect(uaraTeam.linkedRepos?.some((r) => r.label === "uarapoint-api" && r.donoDoContrato)).toBe(
      true,
    );
    expect(uaraTeam.linkedRepos?.some((r) => r.label === "uarapoint-web")).toBe(true);
    expect(uaraTeam.linkedRepos?.some((r) => r.label === "UaraIA")).toBe(true);

    const mareTeam = suggestProjectTeam({
      projectName: "Maré Decorações Náutica",
      filePaths: ["src/pages/catalog.tsx", "src/components/cart.tsx"],
      providerEntries: entries,
    });

    const mareNames = mareTeam.personas.map((p) => p.name).join(" | ");
    expect(mareTeam.workspacePresetId).toBe("mare-decoracoes");
    expect(mareNames).toContain("Clara Mendes (@conteudo)");
    expect(mareNames).toContain("Otto & Helena (@crescimento)");
    expect(mareTeam.linkedRepos?.length).toBe(2);

    const ddtTeam = suggestProjectTeam({
      projectName: "dentro-do-tubo-lading-page",
      projectCwd: "D:/Projects/dentro-do-tubo-lading-page",
      filePaths: [],
      providerEntries: entries,
    });
    expect(ddtTeam.workspacePresetId).toBe("dentro-do-tubo");
    expect(ddtTeam.personas.some((p) => p.id === "dev-pedidos")).toBe(true);
    expect(ddtTeam.personas.some((p) => p.id === "arquiteto")).toBe(true);

    const aerolitoTeam = suggestProjectTeam({
      projectName: "aerolito-ladingpage",
      projectCwd: "D:/Projects/aerolito-ladingpage",
      filePaths: [],
      providerEntries: entries,
    });
    expect(aerolitoTeam.workspacePresetId).toBe("aerolito");
    expect(aerolitoTeam.workspaceContext).toContain("Aerolito Surf House");

    const vitorTeam = suggestProjectTeam({
      projectName: "vitor-construtora",
      projectCwd: "D:/Projects/vitor-construtora",
      filePaths: [],
      providerEntries: entries,
    });
    expect(vitorTeam.workspacePresetId).toBe("vitor-construtora");
    expect(vitorTeam.workspaceContext).toContain("PAHALLA Residence");
  });

  it("serializes, parses, and formats Direct Mode prompt, skills, and Product Map guardrails", () => {
    const entries = [
      makeMockProviderEntry({
        instanceId: ProviderInstanceId.make("claude-a"),
        displayName: "Claude Conta A",
      }),
    ];
    const team = suggestProjectTeam({
      projectName: "uarapoint-web",
      projectCwd: "D:/Projects/uarapoint-web",
      filePaths: ["src/Quiver3D.tsx"],
      providerEntries: entries,
    });
    const raw = serializeProjectTeamConfig(team);
    const parsed = parseProjectTeamConfig(raw);
    expect(parsed.personas.length).toBe(team.personas.length);
    expect(parsed.linkedRepos?.length).toBe(3);
    expect(parsed.workspacePresetId).toBe("uarapoint");

    const dora = parsed.personas.find((p) => p.id === "design")!;
    const skillMd = buildPersonaSkillMarkdown(dora, "Uarapoint");
    expect(skillMd).toContain("Ship-It");
    expect(skillMd).toContain("Dora Lins");
    expect(skillMd).toContain("Tá bonito e funciona.");

    const directPrompt = formatPersonaDirectModePrompt(dora, "Ajuste o header mobile");
    expect(directPrompt).toContain("[COWORKER EM MODO DIRETO:");
    expect(directPrompt).toContain("Dora Lins");
    expect(directPrompt).toContain("Ajuste o header mobile");

    const map = suggestProductMap({
      projectName: "uarapoint-web",
      projectCwd: "D:/Projects/uarapoint-web",
    });
    const serializedMap = serializeProductMapConfig(map);
    const parsedMap = parseProductMapConfig(serializedMap);
    expect(
      parsedMap.items.some((item) => item.id === "quiver-3d" && item.status === "code_truth"),
    ).toBe(true);

    const guardrails = formatProductMapGuardrailsPrompt({
      productMap: parsedMap,
      linkedRepos: parsed.linkedRepos ?? [],
      workspaceContext: parsed.workspaceContext,
    });
    expect(guardrails).toContain("Quiver 3D");
    expect(guardrails).toContain("Código é a Fonte da Verdade (Evoluído)");
    expect(guardrails).toContain("DONO DO CONTRATO");
    expect(guardrails).toContain("Contexto do workspace: Uarapoint");
  });
});
