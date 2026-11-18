import {
  OFFICIAL_SQUAD_PERSONAS,
  type ProjectPersona,
  resolvePersonaShortRole,
  resolveProviderBrandLabel,
  SQUAD_PIPELINE_STAGES,
  SQUAD_WORKFLOW_MODES,
  type SquadPipelineStageId,
  type SquadWorkflowMode,
} from "./projectTeam.logic";

export interface ParsedSquadUserBadge {
  readonly mode: SquadWorkflowMode | null;
  readonly modeLabel: string | null;
  readonly personaId: string | null;
  readonly personaName: string | null;
  readonly personaRole: string | null;
  readonly personaHandle: string | null;
  readonly personaIcon: string | null;
  readonly personaColor: string | null;
  readonly stageId: SquadPipelineStageId | null;
  readonly stageLabel: string | null;
  readonly repoLabel: string | null;
  readonly hasProductGuardrails: boolean;
}

export interface ParsedSquadUserMessage {
  readonly cleanText: string;
  readonly badge: ParsedSquadUserBadge | null;
}

function unescapeXmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractXmlAttribute(attrBlock: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}="([^"]*)"`, "i");
  const match = attrBlock.match(regex);
  if (!match || typeof match[1] !== "string") {
    return null;
  }
  const value = unescapeXmlAttr(match[1]).trim();
  return value.length > 0 ? value : null;
}

function isSquadWorkflowMode(value: string | null): value is SquadWorkflowMode {
  return (
    value === "direct" ||
    value === "mockup_turbo" ||
    value === "full_pipeline" ||
    value === "creative_studio"
  );
}

function isSquadPipelineStageId(value: string | null): value is SquadPipelineStageId {
  return (
    value === "produto_spec" ||
    value === "design" ||
    value === "dev" ||
    value === "qa_e2e" ||
    value === "prints_aprovacao"
  );
}

export function parseSquadUserMessage(rawText: string): ParsedSquadUserMessage {
  if (!rawText || rawText.trim().length === 0) {
    return { cleanText: "", badge: null };
  }

  let stripped = rawText;
  let hasAnyBlock = false;
  let hasProductGuardrails = false;
  let repoLabel: string | null = null;
  let mode: SquadWorkflowMode | null = null;
  let modeLabel: string | null = null;
  let personaId: string | null = null;
  let personaName: string | null = null;
  let personaRole: string | null = null;
  let personaHandle: string | null = null;
  let personaIcon: string | null = null;
  let personaColor: string | null = null;
  let stageId: SquadPipelineStageId | null = null;
  let stageLabel: string | null = null;

  const guardrailsRegex =
    /<product_source_of_truth_guardrails>[\s\S]*?<\/product_source_of_truth_guardrails>/gi;
  if (guardrailsRegex.test(stripped)) {
    hasAnyBlock = true;
    hasProductGuardrails = true;
    stripped = stripped.replace(guardrailsRegex, "");
  }

  const multiRepoRegex =
    /<multi_repo_worktree_assignment>([\s\S]*?)<\/multi_repo_worktree_assignment>/gi;
  const multiRepoMatch = multiRepoRegex.exec(stripped);
  if (multiRepoMatch) {
    hasAnyBlock = true;
    const inner = multiRepoMatch[1] ?? "";
    const targetRepoLine =
      inner.match(/Reposit[óo]rio(?:\s+Alvo)?\s*:\s*\**([^\n*(]+)/i)?.[1]?.trim() ??
      inner.match(/repo(?:Label|Id)?\s*[:=]\s*["']?([^\n"']+)["']?/i)?.[1]?.trim() ??
      null;
    if (targetRepoLine) {
      repoLabel = targetRepoLine;
    }
    stripped = stripped.replace(multiRepoRegex, "");
  }

  const workflowContextRegex =
    /<squad_workflow_context([^>]*)>[\s\S]*?<\/squad_workflow_context>/gi;
  const workflowContextMatch = workflowContextRegex.exec(stripped);
  if (workflowContextMatch) {
    hasAnyBlock = true;
    const attrs = workflowContextMatch[1] ?? "";
    const rawMode = extractXmlAttribute(attrs, "mode");
    if (isSquadWorkflowMode(rawMode)) {
      mode = rawMode;
      const foundMode = SQUAD_WORKFLOW_MODES.find((item) => item.id === rawMode);
      modeLabel = foundMode?.badgeText ?? foundMode?.shortLabel ?? null;
    }
    personaId = extractXmlAttribute(attrs, "personaId");
    personaName = extractXmlAttribute(attrs, "personaName");
    personaRole = extractXmlAttribute(attrs, "personaRole");
    personaHandle = extractXmlAttribute(attrs, "personaHandle");
    personaIcon = extractXmlAttribute(attrs, "personaIcon");
    personaColor = extractXmlAttribute(attrs, "personaColor");
    const rawStage = extractXmlAttribute(attrs, "stage");
    if (isSquadPipelineStageId(rawStage)) {
      stageId = rawStage;
      const foundStage = SQUAD_PIPELINE_STAGES.find((item) => item.id === rawStage);
      stageLabel = foundStage?.shortTitle ?? foundStage?.title ?? null;
    }
    stripped = stripped.replace(workflowContextRegex, "");
  }

  const legacyDirectSeparatorRegex = /\[COWORKER EM MODO DIRETO:\s*([^\]]+)\][\s\S]*?\n---\n/i;
  const legacyDirectDoubleNewlineRegex = /\[COWORKER EM MODO DIRETO:\s*([^\]]+)\]\n[\s\S]*?\n\n/i;

  const legacyMatch =
    stripped.match(legacyDirectSeparatorRegex) ?? stripped.match(legacyDirectDoubleNewlineRegex);

  if (legacyMatch) {
    hasAnyBlock = true;
    const header = legacyMatch[1]?.trim() ?? "";
    if (!mode) {
      mode = "direct";
      modeLabel = "Direto";
    }
    const handleMatch = header.match(/(@[a-z0-9_-]+)/i);
    if (handleMatch?.[1] && !personaHandle) {
      personaHandle = handleMatch[1];
    }
    const roleParenMatch = header.match(/\(([^()]+)\)\s*$/);
    if (roleParenMatch?.[1] && !personaRole) {
      personaRole = roleParenMatch[1].trim();
    }
    const withoutTrailingRole = roleParenMatch
      ? header.slice(0, header.lastIndexOf("(")).trim()
      : (header.split("·")[0]?.trim() ?? header);
    const firstSpaceIdx = withoutTrailingRole.indexOf(" ");
    if (firstSpaceIdx > 0 && firstSpaceIdx <= 4) {
      if (!personaIcon) {
        personaIcon = withoutTrailingRole.slice(0, firstSpaceIdx).trim();
      }
      if (!personaName) {
        personaName = withoutTrailingRole.slice(firstSpaceIdx + 1).trim();
      }
    } else if (!personaName && withoutTrailingRole) {
      personaName = withoutTrailingRole;
    }

    if (legacyDirectSeparatorRegex.test(stripped)) {
      stripped = stripped.replace(legacyDirectSeparatorRegex, "");
    } else {
      stripped = stripped.replace(legacyDirectDoubleNewlineRegex, "");
    }
  }

  if (!hasAnyBlock) {
    return { cleanText: rawText.trim(), badge: null };
  }

  if ((personaId || personaName || personaHandle) && (!personaColor || !personaIcon)) {
    const matched = findPersonaFromPool(
      { id: personaId, name: personaName, handle: personaHandle },
      OFFICIAL_SQUAD_PERSONAS,
    );
    if (matched) {
      personaId = personaId ?? matched.id;
      personaName = personaName ?? matched.name;
      personaRole = personaRole ?? resolvePersonaShortRole(matched);
      personaIcon = personaIcon ?? matched.icon;
      personaColor = personaColor ?? matched.color;
    }
  }

  return {
    cleanText: stripped.trim() || rawText.trim(),
    badge: {
      mode,
      modeLabel,
      personaId,
      personaName,
      personaRole,
      personaHandle,
      personaIcon,
      personaColor,
      stageId,
      stageLabel,
      repoLabel,
      hasProductGuardrails,
    },
  };
}

export interface SquadApprovalGateAction {
  readonly id: string;
  readonly label: string;
  readonly variant: "approve" | "adjust" | "qa";
  readonly promptToSend: string;
  readonly nextStageId?: SquadPipelineStageId;
}

export interface ParsedAssistantSquadInfo {
  readonly cleanText: string;
  readonly personaName: string | null;
  readonly personaRole: string | null;
  readonly personaHandle: string | null;
  readonly personaIcon: string | null;
  readonly personaColor: string | null;
  readonly skinColor?: string;
  readonly hairColor?: string;
  readonly providerLabel?: string | null;
  readonly modelLabel?: string | null;
  readonly detectedVerdict: {
    readonly text: string;
    readonly kind: "approve" | "reject" | "start";
  } | null;
  readonly approvalGate: {
    readonly gateType: string;
    readonly title: string;
    readonly actions: ReadonlyArray<SquadApprovalGateAction>;
  } | null;
}

function normalizeHandle(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^@/, "").toLowerCase();
}

function findPersonaFromPool(
  query: {
    readonly id?: string | null | undefined;
    readonly name?: string | null | undefined;
    readonly handle?: string | null | undefined;
  },
  pool: ReadonlyArray<ProjectPersona>,
): ProjectPersona | null {
  const candidates = [...pool, ...OFFICIAL_SQUAD_PERSONAS];
  const targetId = normalizeHandle(query.id);
  const targetHandle = normalizeHandle(query.handle);
  const rawName = (query.name ?? "").trim().toLowerCase();
  const baseName = rawName.split("(")[0]?.trim() ?? "";

  for (const item of candidates) {
    const itemHandle =
      normalizeHandle(item.handle) ||
      normalizeHandle(item.name.match(/@([a-z0-9_-]+)/i)?.[1]) ||
      normalizeHandle(item.id);
    const itemBaseName = item.name.toLowerCase().split("(")[0]?.trim() ?? "";

    if (targetId && (item.id.toLowerCase() === targetId || itemHandle === targetId)) {
      return item;
    }
    if (targetHandle && (itemHandle === targetHandle || item.id.toLowerCase() === targetHandle)) {
      return item;
    }
    if (
      rawName &&
      (item.name.toLowerCase() === rawName ||
        (baseName.length >= 3 && itemBaseName === baseName) ||
        (baseName.length >= 3 && item.name.toLowerCase().includes(baseName)))
    ) {
      return item;
    }
  }
  return null;
}

const KNOWN_APPROVE_VERDICTS: ReadonlyArray<string> = [
  "Fechado.",
  "Vale fazer.",
  "Plano fechado.",
  "Procurei furo e não achei.",
  "Tá bonito e funciona.",
  "Entregue.",
  "Contrato e rota entregues.",
  "Não consegui quebrar.",
  "Bate com o combinado.",
  "PR no jeito.",
  "Coerente para quem vai cair na água.",
  "Pronto para aprovação do Luan.",
];

const KNOWN_REJECT_VERDICTS: ReadonlyArray<string> = [
  "Volta.",
  "Não me convenceu.",
  "Plano ainda tem buraco.",
  "Achei furo.",
  "Ainda não tá no nível.",
  "Travou.",
  "Quebrou contrato.",
  "Quebrei.",
  "Quebrou aqui.",
  "Não bate com o combinado.",
  "Não dá pra abrir PR ainda.",
  "Incoerente com o mar real.",
  "Falta confirmar preço/estoque.",
];

function detectVerdictInText(
  text: string,
  matchedPersona: ProjectPersona | null,
): { readonly text: string; readonly kind: "approve" | "reject" | "start" } | null {
  if (!text) return null;

  const approvePool = [
    ...(matchedPersona?.aprova ? [matchedPersona.aprova] : []),
    ...KNOWN_APPROVE_VERDICTS,
  ];
  for (const verdict of approvePool) {
    if (verdict && text.includes(verdict)) {
      return { text: verdict, kind: "approve" };
    }
  }

  const rejectPool = [
    ...(matchedPersona?.reprova ? [matchedPersona.reprova] : []),
    ...KNOWN_REJECT_VERDICTS,
  ];
  for (const verdict of rejectPool) {
    if (verdict && text.includes(verdict)) {
      return { text: verdict, kind: "reject" };
    }
  }

  if (matchedPersona?.roda && text.includes(matchedPersona.roda)) {
    return { text: matchedPersona.roda, kind: "start" };
  }

  return null;
}

function buildApprovalGateFromType(gateTypeRaw: string): ParsedAssistantSquadInfo["approvalGate"] {
  const gateType = gateTypeRaw.trim().toLowerCase();

  if (gateType === "mockup_tela") {
    return {
      gateType: "mockup_tela",
      title: "Portão de Fidelidade Visual: Aprovar Tela / Mockup",
      actions: [
        {
          id: "approve_mockup_tela",
          label: "Aprovar Tela 100%",
          variant: "approve",
          promptToSend:
            "Tela aprovada 100%! Pode consolidar e seguir para a próxima tela ou etapa.",
        },
        {
          id: "adjust_mockup_tela",
          label: "Pedir Ajuste Visual",
          variant: "adjust",
          promptToSend: "Preciso de um ajuste visual nesta tela antes de aprovar: ",
        },
        {
          id: "qa_mockup_tela",
          label: "Rodar E2E + Tirar Prints",
          variant: "qa",
          promptToSend:
            "Rode o teste E2E real no navegador (preview_*) com variações desktop e mobile e me mande os prints desta tela.",
        },
      ],
    };
  }

  if (gateType === "escopo_contrato") {
    return {
      gateType: "escopo_contrato",
      title: "Portão 1: Escopo & Contrato",
      actions: [
        {
          id: "approve_escopo_contrato",
          label: "Aprovar Escopo (Avançar p/ Design)",
          variant: "approve",
          promptToSend:
            "Portão 1 aprovado! Pode avançar agora para a Etapa 2 (Design com a Dora @design).",
          nextStageId: "design",
        },
        {
          id: "adjust_escopo_contrato",
          label: "Ajustar Escopo",
          variant: "adjust",
          promptToSend: "Antes de avançar para Design, ajuste este ponto no escopo/contrato: ",
        },
      ],
    };
  }

  if (gateType === "design_visual") {
    return {
      gateType: "design_visual",
      title: "Portão 2: Visual & Telas",
      actions: [
        {
          id: "approve_design_visual",
          label: "Aprovar Design (Avançar p/ Dev Multi-Repo)",
          variant: "approve",
          promptToSend:
            "Portão 2 (Design) aprovado! Pode avançar para a Etapa 3 (Implementação Multi-Repo: Davi API primeiro se houver contrato, depois Davi Web em worktree).",
          nextStageId: "dev",
        },
        {
          id: "adjust_design_visual",
          label: "Ajustar Design",
          variant: "adjust",
          promptToSend: "Ajuste este detalhe no Design antes de liberar para o Dev: ",
        },
      ],
    };
  }

  if (gateType === "aprovacao_final_100") {
    return {
      gateType: "aprovacao_final_100",
      title: "Portão Final: Aprovação 100%",
      actions: [
        {
          id: "approve_final_100",
          label: "Aprovar 100% (Concluir Feature)",
          variant: "approve",
          promptToSend:
            "Aprovado 100%! Feature validada com prints e QA E2E. Pode preparar o fechamento final com a Lia (@entrega).",
        },
        {
          id: "adjust_final_100",
          label: "Pedir Ajuste Final",
          variant: "adjust",
          promptToSend: "Ainda encontrei um ponto nos prints/fluxo final que precisa de ajuste: ",
        },
      ],
    };
  }

  if (gateType === "arte_criativa") {
    return {
      gateType: "arte_criativa",
      title: "Portão Criativo: HTML & Arte para Postar",
      actions: [
        {
          id: "approve_arte_criativa",
          label: "Aprovar Arte / HTML",
          variant: "approve",
          promptToSend: "Arte/HTML aprovado 100%! Ficou excelente.",
        },
        {
          id: "adjust_arte_criativa",
          label: "Gerar Nova Variação",
          variant: "adjust",
          promptToSend: "Gere uma nova variação ajustando o seguinte: ",
        },
      ],
    };
  }

  return null;
}

export function parseSquadAssistantMessage(input: {
  readonly rawText: string;
  readonly activePersona?: ProjectPersona | null | undefined;
  readonly dispatchedPersona?:
    | {
        readonly personaName: string;
        readonly personaRole: string;
        readonly personaIcon?: string | undefined;
        readonly personaColor: string;
        readonly providerLabel?: string | undefined;
        readonly model?: string | undefined;
      }
    | null
    | undefined;
  readonly personas?: ReadonlyArray<ProjectPersona> | undefined;
}): ParsedAssistantSquadInfo {
  const { rawText, activePersona, dispatchedPersona, personas = [] } = input;
  let cleanText = rawText ?? "";

  let parsedName: string | null = null;
  let parsedRole: string | null = null;
  let parsedHandle: string | null = null;

  const coworkerTagRegex = /\[COWORKER:\s*([^\]]+)\]\s*\n?/i;
  const coworkerMatch = cleanText.match(coworkerTagRegex);
  if (coworkerMatch && typeof coworkerMatch[1] === "string") {
    const segments = coworkerMatch[1]
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    if (segments[0]) {
      parsedName = segments[0];
    }
    if (segments[1]) {
      parsedRole = segments[1];
    }
    if (segments[2]) {
      parsedHandle = segments[2].startsWith("@") ? segments[2] : `@${segments[2]}`;
    } else {
      const inlineHandle = segments[0]?.match(/(@[a-z0-9_-]+)/i)?.[1];
      if (inlineHandle) {
        parsedHandle = inlineHandle;
      }
    }
    cleanText = cleanText.replace(coworkerTagRegex, "");
  }

  let approvalGate: ParsedAssistantSquadInfo["approvalGate"] = null;
  const gateTagRegex = /\[PORTAO_APROVACAO:\s*([a-z0-9_-]+)\s*\]/gi;
  let gateMatch: RegExpExecArray | null = gateTagRegex.exec(cleanText);
  while (gateMatch) {
    if (gateMatch[1]) {
      const candidateGate = buildApprovalGateFromType(gateMatch[1]);
      if (candidateGate) {
        approvalGate = candidateGate;
      }
    }
    gateMatch = gateTagRegex.exec(cleanText);
  }
  cleanText = cleanText.replace(gateTagRegex, "").trim();

  const matchedPersona =
    (parsedName || parsedHandle
      ? findPersonaFromPool({ name: parsedName, handle: parsedHandle }, personas)
      : null) ??
    (dispatchedPersona
      ? findPersonaFromPool({ name: dispatchedPersona.personaName }, personas)
      : null) ??
    activePersona ??
    null;

  const effectiveName =
    parsedName ?? dispatchedPersona?.personaName ?? matchedPersona?.name ?? null;

  const effectiveRole =
    parsedRole ??
    (matchedPersona ? resolvePersonaShortRole(matchedPersona) : null) ??
    dispatchedPersona?.personaRole ??
    null;

  const effectiveHandle =
    parsedHandle ??
    matchedPersona?.handle ??
    matchedPersona?.name.match(/(@[a-z0-9_-]+)/i)?.[1] ??
    (matchedPersona ? `@${matchedPersona.id}` : null);

  const effectiveIcon = matchedPersona?.icon ?? dispatchedPersona?.personaIcon ?? null;

  const effectiveColor = matchedPersona?.color ?? dispatchedPersona?.personaColor ?? null;

  const providerLabel =
    dispatchedPersona?.providerLabel ??
    (matchedPersona ? resolveProviderBrandLabel(matchedPersona.instanceId) : null);

  const modelLabel = dispatchedPersona?.model ?? matchedPersona?.model ?? null;

  const detectedVerdict = detectVerdictInText(cleanText, matchedPersona);

  return {
    cleanText,
    personaName: effectiveName,
    personaRole: effectiveRole,
    personaHandle: effectiveHandle,
    personaIcon: effectiveIcon,
    personaColor: effectiveColor,
    ...(matchedPersona?.pele ? { skinColor: matchedPersona.pele } : {}),
    ...(matchedPersona?.cabelo ? { hairColor: matchedPersona.cabelo } : {}),
    providerLabel,
    modelLabel,
    detectedVerdict,
    approvalGate,
  };
}
