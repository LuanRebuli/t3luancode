import type { ProjectLinkedRepo } from "./projectTeam.logic";

export const T3_PRODUCT_MAP_FILE_PATH = ".t3/product-map.json";

export type ProductMapStatus = "mockup_100" | "code_truth" | "ready_for_launch";

export type ProductMapRepoScope = "web" | "api" | "both";

export interface ProductMapItem {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly repoScope: ProductMapRepoScope;
  readonly status: ProductMapStatus;
  readonly protectedPaths: ReadonlyArray<string>;
  readonly mockupRef?: string;
  readonly notes: string;
}

export interface ProductMapConfig {
  readonly version: 1;
  readonly updatedAt: string;
  readonly items: ReadonlyArray<ProductMapItem>;
}

export const PRODUCT_MAP_STATUS_META: Record<
  ProductMapStatus,
  {
    readonly label: string;
    readonly shortLabel: string;
    readonly badgeEmoji: string;
    readonly description: string;
    readonly colorHex: string;
  }
> = {
  mockup_100: {
    label: "Seguir Mockup 100%",
    shortLabel: "Mockup 100%",
    badgeEmoji: "🎯",
    description:
      "A tela/componente deve reproduzir fielmente o mockup de referência sem inventar desvios visuais.",
    colorHex: "#38bdf8",
  },
  code_truth: {
    label: "Código é a Fonte da Verdade (Evoluído)",
    shortLabel: "Código Evoluído",
    badgeEmoji: "🔒",
    description:
      "O código real já evoluiu além do mockup original (ex.: Quiver 3D). Proibido regredir para o mockup antigo.",
    colorHex: "#a855f7",
  },
  ready_for_launch: {
    label: "Pronto para Lançamento",
    shortLabel: "Pronto p/ Launch",
    badgeEmoji: "🚀",
    description:
      "Tela/fluxo homologado para produção. Mudanças exigem aprovação explícita e zero regressão.",
    colorHex: "#10b981",
  },
};

export const UARAPOINT_DEFAULT_PRODUCT_MAP_ITEMS: ReadonlyArray<ProductMapItem> = [
  {
    id: "quiver-3d",
    name: "Quiver 3D & Pranchas Interativas",
    category: "Experiência 3D / Web",
    repoScope: "web",
    status: "code_truth",
    protectedPaths: ["src/components/quiver", "src/features/quiver"],
    notes:
      "O Quiver 3D no código real já superou o mockup original. Nunca sobrescrever com cards 2D estáticos de mockups antigos.",
  },
  {
    id: "tela-hoje-hero",
    name: "Tela Hoje (Hero Pôr do Sol & Condições ao Vivo)",
    category: "Core Surf / Web + API",
    repoScope: "both",
    status: "code_truth",
    protectedPaths: ["src/pages/today", "src/components/today"],
    notes:
      "Seguir estética limpa com foto real de pôr do sol no hero, 2-3 sinais por card e zero barras decorativas com gradiente de IA.",
  },
  {
    id: "forecast-mares",
    name: "Previsão de Ondas, Vento & Tábua de Marés",
    category: "Core Surf / Web + API",
    repoScope: "both",
    status: "mockup_100",
    protectedPaths: ["src/features/forecast", "src/services/forecast"],
    mockupRef: "design.md#forecast",
    notes:
      "Manter fidelidade 100% à leitura rápida de swell primário/secundário, período de pico e maré astronômica.",
  },
  {
    id: "contrato-api-uarapoint",
    name: "Contratos REST & Schemas (uarapoint-api)",
    category: "Backend / Contrato",
    repoScope: "api",
    status: "code_truth",
    protectedPaths: ["src/routes", "src/schemas", "CONTEXT.md"],
    notes:
      "uarapoint-api é dono do contrato. Qualquer mudança de payload exige sincronizar uarapoint-api antes do uarapoint-web.",
  },
  {
    id: "paywall-assinatura",
    name: "Paywall, Trial & Fluxo de Assinatura Pro",
    category: "Monetização / Ambos",
    repoScope: "both",
    status: "ready_for_launch",
    protectedPaths: ["src/features/billing", "src/features/subscription"],
    notes:
      "Fluxo crítico de receita recorrente. Qualquer alteração exige revisão de Otto Maia, Marina Costa e Quim Barros.",
  },
];

export const MARE_DEFAULT_PRODUCT_MAP_ITEMS: ReadonlyArray<ProductMapItem> = [
  {
    id: "hero-vitrine",
    name: "Hero & Vitrine Principal de Conversão",
    category: "E-commerce / Landing",
    repoScope: "web",
    status: "code_truth",
    protectedPaths: ["src/components/hero", "src/app/page.tsx"],
    notes:
      "Hierarquia visual e CTA principal já otimizados no código real. Não regredir espaçamentos nem substituir copy validada.",
  },
  {
    id: "checkout-whatsapp",
    name: "Fluxo de Compra / Contato Rápido & CTA",
    category: "CRO / Vendas",
    repoScope: "web",
    status: "ready_for_launch",
    protectedPaths: ["src/components/checkout", "src/components/cta"],
    notes:
      "Fluxo pronto para tráfego pago e orgânico. Preservar rastreamento de conversão e velocidade mobile.",
  },
  {
    id: "seo-catalogo",
    name: "Páginas de Produto, Schema.org & SEO Técnico",
    category: "SEO / Catálogo",
    repoScope: "web",
    status: "mockup_100",
    protectedPaths: ["src/app/produtos", "src/lib/seo"],
    notes:
      "Seguir estrutura semântica, metadados OpenGraph e Core Web Vitals sem adicionar scripts pesados.",
  },
];

export const PAHALLA_DEFAULT_PRODUCT_MAP_ITEMS: ReadonlyArray<ProductMapItem> = [
  {
    id: "pahalla-torre-3d",
    name: "Torre 3D Interativa (<pahalla-tower> em public/tower3d.js)",
    category: "Experiência 3D / Three.js",
    repoScope: "web",
    status: "code_truth",
    protectedPaths: ["public/tower3d.js", "src/app/page.tsx"],
    notes:
      "A Torre 3D é o diferencial central do PAHALLA Residence. Deve carregar sem travar o primeiro render, limpar recursos ao desmontar, respeitar prefers-reduced-motion e ter alternativa por teclado e sem WebGL.",
  },
  {
    id: "pahalla-config-dados",
    name: "Dados Reais do Empreendimento & Memorial Confidencial",
    category: "Dados & Compliance",
    repoScope: "web",
    status: "code_truth",
    protectedPaths: ["src/config/pahalla.ts", "docs/reference/pahalla-source-material"],
    notes:
      "Preços (em centavos via formatBRL), 28 unidades e m² vêm estritamente de src/config/pahalla.ts. PROIBIDO mover qualquer PDF de docs/reference/pahalla-source-material para public/.",
  },
  {
    id: "pahalla-direcao-v2",
    name: "Direção Visual v2 Clara e Dourada (PLANO-v2.md)",
    category: "Design / Conversão",
    repoScope: "web",
    status: "mockup_100",
    protectedPaths: ["docs/mockups/PLANO-v2.md", "src/app/globals.css"],
    mockupRef: "docs/mockups/PLANO-v2.md",
    notes:
      "Sistema claro e dourado (areia, papel, tinta, ouro, banda profunda), General Sans, cápsula flutuante e preço 'a partir de' visível em 5 segundos.",
  },
];

export const AEROLITO_DEFAULT_PRODUCT_MAP_ITEMS: ReadonlyArray<ProductMapItem> = [
  {
    id: "aerolito-i18n-booking",
    name: "Reserva WhatsApp & Trilíngue PT / ES / EN",
    category: "Conversão & i18n",
    repoScope: "web",
    status: "ready_for_launch",
    protectedPaths: ["src/config/site.ts", "src/config/i18n.ts", "src/lib/booking-message.ts"],
    notes:
      "Toda string nova ganha tradução es/en na mesma mudança (i18n.test.ts). Dados que dependem do anfitrião entram como TODO:Leandro sem slot vazio.",
  },
  {
    id: "aerolito-identidade",
    name: "Identidade Verde-Mato & Laranja Pôr do Sol",
    category: "Design / Hotelaria",
    repoScope: "web",
    status: "mockup_100",
    protectedPaths: ["DESIGN.md", "src/app/globals.css"],
    notes:
      "Verde-mato (--primary) para estrutura, laranja pôr do sol (--accent) como única cor de CTA, Petrona nos títulos e Karla >= 16px no corpo.",
  },
];

export const DENTRO_DO_TUBO_DEFAULT_PRODUCT_MAP_ITEMS: ReadonlyArray<ProductMapItem> = [
  {
    id: "estudio-portal-clientes",
    name: "Site do Estúdio & Portal de Resultados (/painel)",
    category: "Web & Portal OAuth",
    repoScope: "web",
    status: "code_truth",
    protectedPaths: ["app/(marketing)", "app/painel", "DESIGN.md"],
    notes:
      "Assinatura praiana e técnica (Jersey 25, JetBrains Mono, Kaisei Decol, ondas SVG). No portal, cliente A jamais vê dados do cliente B; projeto sem medição exibe 'Medição pendente'.",
  },
  {
    id: "pedidos-multi-tenant",
    name: "Dentro do Tubo Pedidos (Bun + Hono + Clover + Authentik)",
    category: "Plataforma SaaS / API",
    repoScope: "api",
    status: "code_truth",
    protectedPaths: ["packages/contracts", "docs/TDD.md", "docs/DECISIONS.md"],
    notes:
      "TDD obrigatório a partir de origin/main. Dinheiro em centavos com moeda, pedido e pagamento idempotentes, tenant_id e location_id em tudo.",
  },
];

export function suggestProductMap(input: {
  readonly projectName: string;
  readonly projectCwd?: string;
}): ProductMapConfig {
  const haystack = `${input.projectName} ${input.projectCwd ?? ""}`.toLowerCase();
  const isUarapoint = haystack.includes("uarapoint") || haystack.includes("uaraia");
  const isPahalla =
    haystack.includes("vitor") || haystack.includes("construtora") || haystack.includes("pahalla");
  const isAerolito = haystack.includes("aerolito");
  const isDentroDoTubo = haystack.includes("dentro-do-tubo") || haystack.includes("dentrodotubo");
  const isMare =
    haystack.includes("mare") || haystack.includes("maré") || haystack.includes("nautic");

  const items = isUarapoint
    ? UARAPOINT_DEFAULT_PRODUCT_MAP_ITEMS
    : isPahalla
      ? PAHALLA_DEFAULT_PRODUCT_MAP_ITEMS
      : isAerolito
        ? AEROLITO_DEFAULT_PRODUCT_MAP_ITEMS
        : isDentroDoTubo
          ? DENTRO_DO_TUBO_DEFAULT_PRODUCT_MAP_ITEMS
          : isMare
            ? MARE_DEFAULT_PRODUCT_MAP_ITEMS
            : [
                {
                  id: "core-ui",
                  name: "Interface Principal & Componentes Evoluídos",
                  category: "Frontend / UI",
                  repoScope: "web" as const,
                  status: "code_truth" as const,
                  protectedPaths: ["src/components"],
                  notes:
                    "Preservar melhorias visuais e interativas já consolidadas no código sem regredir para rascunhos antigos.",
                },
                {
                  id: "novas-telas-mockup",
                  name: "Novas Telas em Implementação",
                  category: "Produto / Spec",
                  repoScope: "both" as const,
                  status: "mockup_100" as const,
                  protectedPaths: ["src/pages", "src/features"],
                  notes: "Seguir o mockup e especificação aprovados pela Iris Tanaka e Dora Lins.",
                },
              ];

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items,
  };
}

export function parseProductMapConfig(rawJson: string | null | undefined): ProductMapConfig {
  if (!rawJson || rawJson.trim().length === 0) {
    return {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      items: [],
    };
  }
  try {
    const parsed = JSON.parse(rawJson) as Partial<ProductMapConfig>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((item): item is ProductMapItem =>
          Boolean(
            item &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            typeof item.status === "string",
          ),
        )
      : [];
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      items,
    };
  } catch {
    return {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      items: [],
    };
  }
}

export function serializeProductMapConfig(config: ProductMapConfig): string {
  return `${JSON.stringify(
    {
      ...config,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`;
}

export function formatProductMapGuardrailsPrompt(input: {
  readonly productMap: ProductMapConfig;
  readonly linkedRepos?: ReadonlyArray<ProjectLinkedRepo> | undefined;
  readonly workspaceContext?: string | undefined;
}): string {
  const { productMap, linkedRepos = [], workspaceContext } = input;
  const hasItems = productMap.items.length > 0;
  const hasLinkedRepos = linkedRepos.length > 0;
  const hasWorkspaceContext = Boolean(workspaceContext && workspaceContext.trim().length > 0);

  if (!hasItems && !hasLinkedRepos && !hasWorkspaceContext) {
    return "";
  }

  const lines: string[] = ["<product_source_of_truth_guardrails>"];

  if (hasWorkspaceContext && workspaceContext) {
    lines.push(workspaceContext.trim(), "");
  }

  if (hasLinkedRepos) {
    lines.push("## Arquitetura Multi-Repositório & Dono do Contrato");
    for (const repo of linkedRepos) {
      const contractBadge = repo.donoDoContrato
        ? " [DONO DO CONTRATO - atualizar e validar primeiro]"
        : "";
      const readFirst =
        repo.leiaAntes.length > 0 ? ` | Leia antes: ${repo.leiaAntes.join(", ")}` : "";
      lines.push(
        `- **${repo.label}** (\`${repo.cwd}\`, papel: \`${repo.role ?? "fullstack"}\`, branch base: \`${repo.baseBranch}\`)${contractBadge}${readFirst}`,
      );
    }
    lines.push("");
  }

  if (hasItems) {
    lines.push("## Mapa da Fonte da Verdade (Fidelidade Visual & Proteção contra Regressão)");
    for (const item of productMap.items) {
      const meta = PRODUCT_MAP_STATUS_META[item.status];
      const pathsLabel =
        item.protectedPaths.length > 0
          ? ` (Caminhos: \`${item.protectedPaths.join("`, `")}\`)`
          : "";
      lines.push(
        `- ${meta.badgeEmoji} **${item.name}** [${meta.label} · escopo: \`${item.repoScope}\`]${pathsLabel}: ${item.notes}`,
      );
    }
    lines.push(
      "",
      "**Regra Inegociável:** Jamais sobrescreva itens marcados como `🔒 Código é a Fonte da Verdade (Evoluído)` com versões simplificadas de mockups antigos, e jamais altere fluxos `🚀 Pronto para Lançamento` sem solicitação explícita.",
    );
  }

  lines.push("</product_source_of_truth_guardrails>");
  return lines.join("\n");
}
