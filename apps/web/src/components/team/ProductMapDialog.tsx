import { BotIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  PRODUCT_MAP_STATUS_META,
  type ProductMapConfig,
  type ProductMapItem,
  type ProductMapRepoScope,
  type ProductMapStatus,
} from "./productMap.logic";

interface ProductMapDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly projectName: string | null;
  readonly productMap: ProductMapConfig;
  readonly onSave: (nextMap: ProductMapConfig) => Promise<boolean>;
  readonly onSuggestMap: () => Promise<ProductMapConfig | null>;
}

const STATUS_OPTIONS: ReadonlyArray<ProductMapStatus> = [
  "code_truth",
  "mockup_100",
  "ready_for_launch",
];

const REPO_SCOPE_OPTIONS: ReadonlyArray<{
  readonly value: ProductMapRepoScope;
  readonly label: string;
}> = [
  { value: "web", label: "Web (Frontend)" },
  { value: "api", label: "API (Backend / Contrato)" },
  { value: "both", label: "Ambos (Web + API)" },
];

export function ProductMapDialog({
  open,
  onOpenChange,
  projectName,
  productMap,
  onSave,
  onSuggestMap,
}: ProductMapDialogProps) {
  const [items, setItems] = useState<ReadonlyArray<ProductMapItem>>(productMap.items);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setItems(productMap.items);
    }
    onOpenChange(nextOpen);
  };

  const updateItem = (index: number, patch: Partial<ProductMapItem>) => {
    setItems((current) =>
      current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    const nextIndex = items.length + 1;
    setItems((current) => [
      ...current,
      {
        id: `area-${Date.now()}-${nextIndex}`,
        name: `Nova Tela / Módulo ${nextIndex}`,
        category: "Produto / UI",
        repoScope: "web",
        status: "code_truth",
        protectedPaths: ["src/components"],
        notes:
          "Descreva o que já está evoluído no código ou qual mockup deve ser seguido sem desvios.",
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, idx) => idx !== index));
  };

  const handleSuggest = async () => {
    setIsSaving(true);
    try {
      const suggested = await onSuggestMap();
      if (suggested) {
        setItems(suggested.items);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await onSave({
        version: 1,
        updatedAt: new Date().toISOString(),
        items,
      });
      if (saved) {
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const codeTruthCount = items.filter((item) => item.status === "code_truth").length;
  const mockupCount = items.filter((item) => item.status === "mockup_100").length;
  const readyCount = items.filter((item) => item.status === "ready_for_launch").length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-5xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle>Mapa da Fonte da Verdade: {projectName ?? "Projeto Atual"}</DialogTitle>
              <DialogDescription>
                Proteja componentes evoluídos no código (ex.: Quiver 3D) contra regressões de
                mockups antigos e defina onde seguir o mockup 100% em{" "}
                <code>.t3/product-map.json</code>.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSuggest()}
                disabled={isSaving}
              >
                <BotIcon className="size-3.5" />
                Sugerir Mapa do Produto
              </Button>
              <Button variant="outline" size="sm" onClick={addItem} disabled={isSaving}>
                <PlusIcon className="size-3.5" />
                Adicionar Tela/Módulo
              </Button>
            </div>
          </div>
        </DialogHeader>

        <DialogPanel>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {STATUS_OPTIONS.map((statusKey) => {
                const meta = PRODUCT_MAP_STATUS_META[statusKey];
                const count =
                  statusKey === "code_truth"
                    ? codeTruthCount
                    : statusKey === "mockup_100"
                      ? mockupCount
                      : readyCount;
                return (
                  <div
                    key={statusKey}
                    className="rounded-xl border border-border/70 bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground text-xs">
                        {meta.badgeEmoji} {meta.shortLabel}
                      </span>
                      <Badge variant="outline" size="sm">
                        {count} {count === 1 ? "item" : "itens"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-2xs text-muted-foreground leading-relaxed">
                      {meta.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
                <ShieldCheckIcon className="size-8 text-muted-foreground" />
                <div className="max-w-md space-y-1">
                  <p className="font-medium text-foreground text-sm">
                    Nenhuma tela ou componente mapeado ainda
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Clique em &ldquo;Sugerir Mapa do Produto&rdquo; para gerar automaticamente as
                    regras de proteção de código evoluído (ex.: Quiver 3D, Tela Hoje, Contratos API)
                    e fidelidade visual.
                  </p>
                </div>
                <Button size="sm" onClick={() => void handleSuggest()} disabled={isSaving}>
                  <BotIcon className="size-3.5" />
                  Gerar Mapa Automaticamente
                </Button>
              </div>
            ) : (
              <div className="flex max-h-[54vh] flex-col gap-3 overflow-y-auto pr-1">
                {items.map((item, index) => {
                  const meta = PRODUCT_MAP_STATUS_META[item.status];
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs"
                            style={{
                              backgroundColor: `${meta.colorHex}22`,
                              border: `1px solid ${meta.colorHex}55`,
                            }}
                          >
                            {meta.badgeEmoji}
                          </span>
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(index, { name: e.target.value })}
                            placeholder="Nome da tela ou componente (ex.: Quiver 3D)"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" size="sm">
                            {meta.shortLabel}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => removeItem(index)}
                            aria-label={`Remover ${item.name}`}
                          >
                            <Trash2Icon className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">
                            Fonte da Verdade
                          </span>
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={item.status}
                            onChange={(e) =>
                              updateItem(index, {
                                status: e.target.value as ProductMapStatus,
                              })
                            }
                          >
                            {STATUS_OPTIONS.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {PRODUCT_MAP_STATUS_META[statusOption].badgeEmoji}{" "}
                                {PRODUCT_MAP_STATUS_META[statusOption].label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">
                            Escopo Multi-Repo
                          </span>
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={item.repoScope}
                            onChange={(e) =>
                              updateItem(index, {
                                repoScope: e.target.value as ProductMapRepoScope,
                              })
                            }
                          >
                            {REPO_SCOPE_OPTIONS.map((scope) => (
                              <option key={scope.value} value={scope.value}>
                                {scope.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">
                            Caminhos Protegidos (separados por vírgula)
                          </span>
                          <Input
                            value={item.protectedPaths.join(", ")}
                            onChange={(e) =>
                              updateItem(index, {
                                protectedPaths: e.target.value
                                  .split(",")
                                  .map((entry) => entry.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="src/components/quiver, src/pages/today"
                          />
                        </label>
                      </div>

                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">
                          Diretriz de Proteção / Regra para os Agentes (injetada no prompt)
                        </span>
                        <Textarea
                          rows={2}
                          value={item.notes}
                          onChange={(e) => updateItem(index, { notes: e.target.value })}
                          placeholder="Explique o que não pode regredir ou qual referência visual seguir..."
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            Salvar em .t3/product-map.json
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
