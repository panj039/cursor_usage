import { readUsageFile, UsageRecord } from "./parser";
import { applyDateRange, buildQuickRanges, DateRange, QuickRanges, normalizeRange } from "./filters";
import {
  DailyRow,
  ModelChartMetric,
  ModelChartSegment,
  ModelChip,
  ModelLegendItem,
  PlanOption,
  renderApp,
  StatCard,
} from "./components";

type PlanId = keyof typeof PLAN_CONFIG;

interface FilterInputs {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}

interface AppState {
  records: UsageRecord[];
  filter: FilterInputs;
  plan: PlanId;
  activeQuickRangeKey?: string;
  fileName?: string;
  rangePopoverOpen: boolean;
  models: string[];
  selectedModels: string[];
  floatingPos?: { left: number; top: number };
  dragging?: { offsetX: number; offsetY: number };
}

interface SummaryResult {
  stats: StatCard[];
  dailyRows: DailyRow[];
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  modelMetrics: ModelMetric[];
}

interface ModelMetric {
  model: string;
  requests: number;
  tokens: number;
  cost: number;
}

const PLAN_CONFIG = {
  free: {
    label: "Free",
    description: "基础版本，适用于日常轻量使用",
    costLimit: 0,
  },
  pro: {
    label: "Pro",
    description: "专业版，$20/月",
    costLimit: 20,
  },
  proPlus: {
    label: "ProPlus",
    description: "进阶版，$60/月",
    costLimit: 60,
  },
  ultra: {
    label: "Ultra",
    description: "旗舰版，$200/月",
    costLimit: 200,
  },
} as const;

const PLAN_USAGE_NOTE =
  "套餐用量仅供参考，实际限额与服务状态以 Cursor 账户提示为准，软阈值可能允许继续使用并按政策计费。";

const numberFormatter = new Intl.NumberFormat("zh-CN");
const costFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const state: AppState = {
  records: [],
  filter: {},
  plan: "pro",
  activeQuickRangeKey: undefined,
  fileName: undefined,
  rangePopoverOpen: false,
  models: [],
  selectedModels: [],
};

const rootQuery = document.querySelector<HTMLElement>("[data-view-root]");

if (!rootQuery) {
  throw new Error("无法找到应用容器");
}

const root: HTMLElement = rootQuery;

init();

function init(): void {
  bindGlobalDragGuards();
  render();
  bindDelegatedEvents();
  bindDropEvents();
  bindFloatingDragEvents();
  bindOutsidePopoverClose();
  window.addEventListener("resize", handleResizeForFloating);
}

function bindGlobalDragGuards(): void {
  const guard = (event: DragEvent): void => {
    if (!event.dataTransfer) {
      return;
    }
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
    }
  };
  window.addEventListener("dragover", guard, { capture: true });
  window.addEventListener("drop", guard, { capture: true });
}

function bindDelegatedEvents(): void {
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    // close popover when clicking outside
    const withinPopover =
      Boolean(target.closest("[data-role='range-popover']")) ||
      Boolean(target.closest("[data-action='toggle-range']"));
    if (state.rangePopoverOpen && !withinPopover) {
      state.rangePopoverOpen = false;
      queueMicrotask(() => {
        if (!state.rangePopoverOpen) {
          render();
        }
      });
    }

    const planElement = target.closest<HTMLElement>("[data-action='plan']");
    if (planElement?.dataset.plan) {
      event.preventDefault();
      handlePlanChange(planElement.dataset.plan as PlanId);
      return;
    }

    const toggleRange = target.closest<HTMLElement>("[data-action='toggle-range']");
    if (toggleRange) {
      event.preventDefault();
      state.rangePopoverOpen = !state.rangePopoverOpen;
      render();
      return;
    }

    const modelToggle = target.closest<HTMLElement>("[data-action='model-toggle']");
    if (modelToggle?.dataset.model) {
      event.preventDefault();
      handleModelToggle(modelToggle.dataset.model);
      return;
    }

    const modelAll = target.closest<HTMLElement>("[data-action='model-all']");
    if (modelAll) {
      event.preventDefault();
      handleModelSelectAll();
      return;
    }

    const preset = target.closest<HTMLElement>("[data-action='preset']");
    if (preset?.dataset.preset) {
      event.preventDefault();
      applyPresetRange(preset.dataset.preset);
      return;
    }

    const rangeElement = target.closest<HTMLElement>("[data-action='range']");
    if (rangeElement?.dataset.rangeKey) {
      event.preventDefault();
      handleQuickRange(rangeElement.dataset.rangeKey);
      return;
    }

    const clearRange = target.closest<HTMLElement>("[data-action='clear-range']");
    if (clearRange) {
      event.preventDefault();
      clearFilters();
      return;
    }

  });

  root.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    if (input.dataset.role === "file-input" && input.files?.length) {
      handleFiles(Array.from(input.files));
      input.value = "";
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target || !target.dataset.filter) {
      return;
    }

    handleFilterInput(target.dataset.filter, target.value);
  });

  root.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    if (input.dataset.role === "file-input" && input.files?.length) {
      handleFiles(Array.from(input.files));
      input.value = "";
    }
  });
}

function bindDropEvents(): void {
  const getDropZone = (): HTMLElement | null => root.querySelector("[data-role='drop-zone']");

  root.addEventListener("dragover", (event) => {
    if (!event.dataTransfer) {
      return;
    }

    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      const zone = getDropZone();
      if (zone) {
        zone.classList.add("drop-zone--active");
      }
    }
  });

  root.addEventListener("dragover", (event) => {
    if (!event.dataTransfer) {
      return;
    }

    const zone = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-role='drop-zone']");
    if (zone) {
      zone.classList.add("drop-zone--active");
      event.dataTransfer.dropEffect = "copy";
    }
  });

  root.addEventListener("dragleave", (event) => {
    const zone = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-role='drop-zone']") ?? getDropZone();
    if (zone && !zone.contains(event.relatedTarget as Node | null)) {
      zone.classList.remove("drop-zone--active");
    }
  });

  root.addEventListener("drop", (event) => {
    if (!event.dataTransfer) {
      return;
    }
    const zone = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-role='drop-zone']") ?? getDropZone();
    const files = Array.from(event.dataTransfer.files).filter((file) => file.name.toLowerCase().endsWith(".csv"));
    if (files.length) {
      event.preventDefault();
      if (zone) {
        zone.classList.remove("drop-zone--active");
      }
      handleFiles(files);
    }
  });
}

function bindFloatingDragEvents(): void {
  window.addEventListener("mousedown", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const badge = target.closest<HTMLElement>(".time-badge");
    const container = document.querySelector<HTMLElement>("[data-role='floating-time']");
    if (!badge || !container) return;
    if (!(event instanceof MouseEvent) || event.button !== 0) return;
    if (!event.shiftKey) return; // 仅在按住 Shift 时允许拖动
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    state.dragging = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    // 开始拖动时切换为通过 left/top 定位
    state.floatingPos = { left: rect.left, top: rect.top };
    applyFloatingInlineStyle(container, state.floatingPos);
  });

  window.addEventListener("mousemove", (event) => {
    if (!state.dragging) return;
    const container = document.querySelector<HTMLElement>("[data-role='floating-time']");
    if (!container) return;
    const left = Math.max(8, Math.min(window.innerWidth - 8 - container.offsetWidth, event.clientX - state.dragging.offsetX));
    const top = Math.max(8, Math.min(window.innerHeight - 8 - container.offsetHeight, event.clientY - state.dragging.offsetY));
    state.floatingPos = { left, top };
    applyFloatingInlineStyle(container, state.floatingPos);
  });

  window.addEventListener("mouseup", () => {
    if (state.dragging) {
      state.dragging = undefined;
    }
  });
}

function bindOutsidePopoverClose(): void {
  window.addEventListener(
    "click",
    (event) => {
      if (!state.rangePopoverOpen) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const within =
        Boolean(target.closest("[data-role='range-popover']")) ||
        Boolean(target.closest("[data-action='toggle-range']"));
      if (within) {
        return;
      }
      state.rangePopoverOpen = false;
      render();
    },
    false,
  );
}

function applyFloatingInlineStyle(container: HTMLElement, pos?: { left: number; top: number }): void {
  if (pos) {
    container.style.left = `${Math.round(pos.left)}px`;
    container.style.top = `${Math.round(pos.top)}px`;
    container.style.right = "auto";
    container.style.position = "fixed";
  }
}

function handleFiles(files: File[]): void {
  if (!files.length) {
    return;
  }
  const [file] = files;
  readUsageFile(file)
    .then((records) => {
      state.records = records;
      state.fileName = file.name;
      state.activeQuickRangeKey = undefined;
      state.filter = {};
      state.models = collectModels(records);
      state.selectedModels = defaultSelectedModels(state.models);
      state.rangePopoverOpen = false;
      render();
    })
    .catch((error) => {
      console.error("解析 CSV 时出错：", error);
      alert("无法解析该文件，请确认其为有效的 Cursor 用量 CSV。");
    });
}

function handlePlanChange(plan: PlanId): void {
  if (!PLAN_CONFIG[plan]) {
    return;
  }
  state.plan = plan;
  state.rangePopoverOpen = false;
  render();
}

function handleModelToggle(model: string): void {
  if (!model) {
    return;
  }
  if (!state.models.length) {
    return;
  }
  const baseline = state.selectedModels.length ? state.selectedModels : state.models;
  const selection = new Set(baseline);
  if (selection.has(model)) {
    selection.delete(model);
  } else {
    selection.add(model);
  }
  if (selection.size === 0) {
    selection.add(model);
  }
  state.selectedModels = Array.from(selection);
  render();
}

function handleModelSelectAll(): void {
  if (!state.models.length) {
    return;
  }
  state.selectedModels = [...state.models];
  render();
}

function handleQuickRange(rangeKey: string): void {
  const quickRanges = buildQuickRanges(state.records);
  const allRanges = [...quickRanges.days, ...quickRanges.months];
  const match = allRanges.find((item) => item.key === rangeKey);
  if (!match) {
    return;
  }

  state.filter = {
    startDate: toDateInput(match.start),
    startTime: toTimeInput(match.start),
    endDate: toDateInput(match.end),
    endTime: toTimeInput(match.end),
  };
  state.activeQuickRangeKey = match.key;
  state.rangePopoverOpen = false;
  render();
}

function handleFilterInput(key: string, value: string): void {
  if (!["start-date", "start-time", "end-date", "end-time"].includes(key)) {
    return;
  }

  if (value === "") {
    delete (state.filter as Record<string, string | undefined>)[normalizeFilterKey(key)];
  } else {
    const normalizedKey = normalizeFilterKey(key);
    (state.filter as Record<string, string | undefined>)[normalizedKey] = value;
  }

  state.activeQuickRangeKey = undefined;
  render();
}

function normalizeFilterKey(key: string): keyof FilterInputs {
  switch (key) {
    case "start-date":
      return "startDate";
    case "start-time":
      return "startTime";
    case "end-date":
      return "endDate";
    case "end-time":
      return "endTime";
    default:
      return "startDate";
  }
}

function clearFilters(): void {
  if (!hasFilter(state.filter)) {
    return;
  }
  state.filter = {};
  state.activeQuickRangeKey = undefined;
  state.rangePopoverOpen = false;
  render();
}

function hasFilter(filter: FilterInputs): boolean {
  return Boolean(filter.startDate || filter.startTime || filter.endDate || filter.endTime);
}

function render(): void {
  const dateRange = normalizeRange(toDateRange(state.filter));
  const planConfig = PLAN_CONFIG[state.plan];
  const dateFiltered = applyDateRange(state.records, dateRange);
  const modelsAll = state.models;
  const selectedModels = state.selectedModels.length ? state.selectedModels : modelsAll;
  const modelColors = buildModelColorMap(modelsAll);
  const filteredRecords = applyModelFilter(dateFiltered, selectedModels.length ? selectedModels : modelsAll);
  const summary = summarize(filteredRecords);
  const modelLegend = buildModelLegend(summary.modelMetrics, modelColors);
  const modelChartMetrics = buildModelChartMetrics(summary, modelColors);
  const modelChips = buildModelChips(modelsAll, selectedModels, modelColors);
  const quickRanges = buildQuickRanges(state.records);

  const percent = computeUsagePercent(summary.totalCost, planConfig.costLimit);
  const percentLabel = formatPercentLabel(percent);
  const statusMessage = state.records.length
    ? "当前筛选条件下暂无数据，请尝试其他时间范围。"
    : "请选择或拖入 CSV 文件以查看用量统计。";

  const renderModel = {
    hasData: filteredRecords.length > 0,
    fileName: state.fileName,
    statusMessage,
    planOptions: toPlanOptions(),
    activePlan: state.plan,
    planUsagePercent: percent,
    planUsageLabel: percentLabel,
    planUsageNote: PLAN_USAGE_NOTE,
    planUsageColor: usageColor(percent),
    planUsageSummary: `${planConfig.label} 套餐已使用 ${formatCost(summary.totalCost)}，占比 ${percentLabel}`,
    planTokensSummary: `${formatCost(summary.totalCost)} / ${formatCost(planConfig.costLimit)}`,
    stats: summary.stats,
    quickRanges: toQuickRangeView(quickRanges, state.activeQuickRangeKey),
    filterValues: toFilterValues(state.filter),
    rangeLabel: currentRangeLabel(dateRange),
    showRangePopover: state.rangePopoverOpen,
    floatingStyle: initialFloatingStyle(state.floatingPos),
    dailyRows: summary.dailyRows,
    quickRangesAvailable: state.records.length > 0,
    activeQuickRangeKey: state.activeQuickRangeKey,
    modelChips,
    hasModelOptions: modelsAll.length > 0,
    hasModelData: summary.modelMetrics.length > 0,
    modelChartMetrics,
    modelLegend,
  };

  root.innerHTML = renderApp(renderModel);
  if (state.rangePopoverOpen) {
    positionRangePopover();
  }
  const container = document.querySelector<HTMLElement>("[data-role='floating-time']");
  if (container) {
    if (state.floatingPos) {
      applyFloatingInlineStyle(container, state.floatingPos);
    } else {
      alignFloatingContainer(container);
    }
  }
}

function summarize(records: UsageRecord[]): SummaryResult {
  const totals = {
    totalTokens: 0,
    totalCost: 0,
    inputWithCache: 0,
    inputNoCache: 0,
    cacheRead: 0,
    outputTokens: 0,
  };

  const byDay = new Map<string, { date: Date; requests: number; tokens: number; cost: number }>();

  records.forEach((record) => {
    totals.totalTokens += record.totalTokens;
    totals.totalCost += record.cost;
    totals.inputWithCache += record.inputWithCache;
    totals.inputNoCache += record.inputNoCache;
    totals.cacheRead += record.cacheRead;
    totals.outputTokens += record.outputTokens;

    const dayKey = formatDateKey(record.date);
    const entry = byDay.get(dayKey);
    if (entry) {
      entry.requests += 1;
      entry.tokens += record.totalTokens;
      entry.cost += record.cost;
    } else {
      byDay.set(dayKey, {
        date: record.date,
        requests: 1,
        tokens: record.totalTokens,
        cost: record.cost,
      });
    }

  });

  const totalRequests = records.length;
  const totalTokens = totals.totalTokens;
  const totalCost = totals.totalCost;

  const stats: StatCard[] = [
    {
      label: "总调用次数",
      value: formatNumber(records.length),
    },
    {
      label: "Total Tokens",
      value: formatNumber(totals.totalTokens),
      hint: `平均 ${formatNumber(records.length ? Math.round(totals.totalTokens / records.length) : 0)} / 调用`,
    },
    {
      label: "输入 Tokens (含缓存写入)",
      value: formatNumber(totals.inputWithCache),
    },
    {
      label: "输入 Tokens (无缓存写入)",
      value: formatNumber(totals.inputNoCache),
    },
    {
      label: "缓存读取",
      value: formatNumber(totals.cacheRead),
    },
    {
      label: "输出 Tokens",
      value: formatNumber(totals.outputTokens),
    },
    {
      label: "总费用 (USD)",
      value: formatCost(totals.totalCost),
    },
  ];

  const dailyRows: DailyRow[] = Array.from(byDay.entries())
    .map(([key, entry]) => ({
      key,
      label: key,
      requests: formatNumber(entry.requests),
      requestsPercentLabel: formatPercentDisplay(totalRequests ? (entry.requests / totalRequests) * 100 : 0),
      requestsPercentValue: totalRequests ? (entry.requests / totalRequests) * 100 : 0,
      totalTokens: formatNumber(entry.tokens),
      tokensPercentLabel: formatPercentDisplay(totalTokens ? (entry.tokens / totalTokens) * 100 : 0),
      tokensPercentValue: totalTokens ? (entry.tokens / totalTokens) * 100 : 0,
      cost: formatCost(entry.cost),
      costPercentLabel: formatPercentDisplay(totalCost ? (entry.cost / totalCost) * 100 : 0),
      costPercentValue: totalCost ? (entry.cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => (a.key > b.key ? -1 : 1));

  const modelMetrics = buildModelMetrics(records);

  return {
    stats,
    dailyRows,
    totalTokens,
    totalCost,
    totalRequests,
    modelMetrics,
  };
}

function toPlanOptions(): PlanOption[] {
  return Object.entries(PLAN_CONFIG).map(([id, config]) => ({
    id,
    label: config.label,
    description: config.description,
  }));
}

function toQuickRangeView(quickRanges: QuickRanges, activeKey?: string) {
  return {
    days: quickRanges.days.map((item) => ({
      key: item.key,
      label: formatDateLabel(item.start),
      active: activeKey === item.key,
    })),
    months: quickRanges.months.map((item) => ({
      key: item.key,
      label: formatMonthLabel(item.start),
      active: activeKey === item.key,
    })),
  };
}

function toFilterValues(filter: FilterInputs) {
  return {
    startDate: filter.startDate ?? "",
    startTime: filter.startTime ?? "",
    endDate: filter.endDate ?? "",
    endTime: filter.endTime ?? "",
  };
}

function toDateRange(filter: FilterInputs): DateRange {
  const range: DateRange = {};

  if (filter.startDate) {
    range.start = composeDate(filter.startDate, filter.startTime ?? "00:00");
  }

  if (filter.endDate) {
    range.end = composeDate(filter.endDate, filter.endTime ?? "23:59");
  }

  return range;
}

function currentRangeLabel(range: DateRange): string {
  if (!range.start && !range.end) {
    return "全部时间";
  }
  if (range.start && range.end) {
    return `${toDateInput(range.start)} ${toTimeInput(range.start)} → ${toDateInput(range.end)} ${toTimeInput(range.end)}`;
    }
  if (range.start) {
    return `${toDateInput(range.start)} ${toTimeInput(range.start)} → 现在`;
  }
  return `至 ${toDateInput(range.end as Date)} ${toTimeInput(range.end as Date)}`;
}

function applyPresetRange(key?: string): void {
  const now = new Date();
  let start: Date | undefined;
  let end: Date | undefined;
  switch (key) {
    case "last-24h":
      end = now;
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "last-3d":
      end = now;
      start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      break;
    case "last-7d":
      end = now;
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "last-30d":
      end = now;
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "this-month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      start = s;
      end = now;
      break;
    }
    case "prev-month": {
      const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const startPrev = new Date(firstThisMonth);
      startPrev.setMonth(startPrev.getMonth() - 1);
      const endPrev = new Date(firstThisMonth.getTime() - 1);
      start = startPrev;
      end = endPrev;
      break;
    }
    default:
      return;
  }
  state.filter = {
    startDate: toDateInput(start as Date),
    startTime: toTimeInput(start as Date),
    endDate: toDateInput(end as Date),
    endTime: toTimeInput(end as Date),
  };
  state.activeQuickRangeKey = undefined;
  state.rangePopoverOpen = false;
  render();
}
function composeDate(datePart: string, timePart: string): Date {
  const [year, month, day] = datePart.split("-").map((value) => Number(value));
  const [hour, minute] = timePart.split(":").map((value) => Number(value));
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
}

function toDateInput(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function toTimeInput(date: Date): string {
  return [pad(date.getHours()), pad(date.getMinutes())].join(":");
}

function collectModels(records: UsageRecord[]): string[] {
  const seen = new Set<string>();
  records.forEach((record) => {
    seen.add(record.model ?? "");
  });
  return Array.from(seen).sort((a, b) =>
    formatModelLabel(a).localeCompare(formatModelLabel(b), "zh-CN"),
  );
}

function applyModelFilter(records: UsageRecord[], selected: string[]): UsageRecord[] {
  if (!selected.length) {
    return records;
  }
  const selectedSet = new Set(selected);
  return records.filter((record) => selectedSet.has(record.model ?? ""));
}

function buildModelMetrics(records: UsageRecord[]): ModelMetric[] {
  const byModel = new Map<string, { requests: number; tokens: number; cost: number }>();
  records.forEach((record) => {
    const key = record.model ?? "";
    const entry = byModel.get(key);
    if (entry) {
      entry.requests += 1;
      entry.tokens += record.totalTokens;
      entry.cost += record.cost;
    } else {
      byModel.set(key, {
        requests: 1,
        tokens: record.totalTokens,
        cost: record.cost,
      });
    }
  });
  return Array.from(byModel.entries())
    .map(([model, entry]) => ({
      model,
      requests: entry.requests,
      tokens: entry.tokens,
      cost: entry.cost,
    }))
    .sort((a, b) => b.tokens - a.tokens);
}

function buildModelColorMap(models: string[]): Map<string, string> {
  const map = new Map<string, string>();
  models.forEach((model, index) => {
    map.set(model ?? "", generateModelColor(index));
  });
  return map;
}

function buildModelChips(
  models: string[],
  selected: string[],
  colorMap: Map<string, string>,
): ModelChip[] {
  if (!models.length) {
    return [];
  }
  const baseline = selected.length ? selected : models;
  const selectedSet = new Set(baseline);
  return models.map((model) => ({
    value: model,
    label: formatModelLabel(model),
    active: selectedSet.has(model),
    color: getModelColor(model, colorMap),
  }));
}

function buildModelLegend(metrics: ModelMetric[], colorMap: Map<string, string>): ModelLegendItem[] {
  const unique = new Map<string, ModelLegendItem>();
  metrics.forEach((metric) => {
    unique.set(metric.model, {
      label: formatModelLabel(metric.model),
      color: getModelColor(metric.model, colorMap),
    });
  });
  return Array.from(unique.values());
}

function buildModelChartMetrics(
  summary: SummaryResult,
  colorMap: Map<string, string>,
): ModelChartMetric[] {
  const definitions: Array<{
    key: string;
    label: string;
    total: number;
    getter: (metric: ModelMetric) => number;
    formatter: (value: number) => string;
  }> = [
    {
      key: "requests",
      label: "调用次数占比",
      total: summary.totalRequests,
      getter: (metric) => metric.requests,
      formatter: (value) => formatNumber(value),
    },
    {
      key: "tokens",
      label: "Total Tokens 占比",
      total: summary.totalTokens,
      getter: (metric) => metric.tokens,
      formatter: (value) => formatNumber(value),
    },
    {
      key: "cost",
      label: "费用占比 (USD)",
      total: summary.totalCost,
      getter: (metric) => metric.cost,
      formatter: (value) => formatCost(value),
    },
  ];

  return definitions.map((definition) => {
    const { total, getter, formatter } = definition;
    const segments = summary.modelMetrics
      .map((metric) => {
        const rawValue = getter(metric);
        const percentValue = total > 0 ? (rawValue / total) * 100 : 0;
        return {
          label: formatModelLabel(metric.model),
          percentLabel: formatPercentDisplay(percentValue),
          percentValue,
          color: getModelColor(metric.model, colorMap),
          valueLabel: formatter(rawValue),
        };
      })
      .filter((segment) => segment.percentValue > 0);

    const gradient = buildPieGradient(segments);

    return {
      key: definition.key,
      label: definition.label,
      totalLabel: formatter(total),
      empty: total === 0 || segments.length === 0,
      segments,
      gradient,
    };
  });
}

function defaultSelectedModels(models: string[]): string[] {
  if (!models.length) {
    return [];
  }
  const paidModels = models.filter(
    (model) => model && model.trim().toLowerCase() !== "auto",
  );
  if (paidModels.length) {
    return paidModels;
  }
  return [...models];
}

function getModelColor(model: string, colorMap: Map<string, string>): string {
  if (colorMap.has(model)) {
    return colorMap.get(model)!;
  }
  return colorFromString(model);
}

function generateModelColor(index: number): string {
  const hue = (index * 67) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

function colorFromString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

function formatModelLabel(model: string): string {
  return model ? model : "未标记模型";
}

function buildPieGradient(segments: ModelChartSegment[]): string {
  if (!segments.length) {
    return "conic-gradient(rgba(148, 163, 184, 0.35) 0 100%)";
  }
  let current = 0;
  const parts = segments.map((segment, index) => {
    const start = current;
    let span = segment.percentValue;
    if (index === segments.length - 1) {
      span = 100 - start;
    }
    const end = Math.min(100, start + span);
    current = end;
    return `${segment.color} ${start}% ${end}%`;
  });
  return `conic-gradient(${parts.join(",")})`;
}

function formatPercentLabel(percent: number): string {
  return `${Math.min(100, Math.round(percent))}%`;
}

function computeUsagePercent(totalTokens: number, limit: number): number {
  if (!limit) {
    return 0;
  }
  return Math.min(100, (totalTokens / limit) * 100);
}

function usageColor(percent: number): string {
  if (percent < 60) {
    return "var(--success)";
  }
  if (percent < 85) {
    return "#facc15";
  }
  return "var(--danger)";
}

function formatPercentDisplay(value: number): string {
  if (value <= 0) {
    return "0%";
  }
  if (value >= 100) {
    return "100%";
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

function formatCost(value: number): string {
  return costFormatter.format(value);
}

function formatDateKey(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function formatDateLabel(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function positionRangePopover(): void {
  const trigger = document.querySelector<HTMLElement>("[data-action='toggle-range']");
  const popover = document.querySelector<HTMLElement>("[data-role='range-popover']");
  if (!trigger || !popover) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const gap = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 初步位置：按钮左对齐，下方 8px
  let left = rect.left;
  let top = rect.bottom + gap;

  // 估计弹层尺寸（未布局时取已有宽度，否则用最大宽度）
  const contentWidth = Math.min(popover.offsetWidth || 460, viewportWidth - 16);
  const contentHeight = popover.offsetHeight || 320;

  // 右侧溢出时向左收敛
  if (left + contentWidth > viewportWidth - 8) {
    left = Math.max(8, viewportWidth - 8 - contentWidth);
  }
  // 底部溢出时放到按钮上方
  if (top + contentHeight > viewportHeight - 8) {
    const above = rect.top - gap - contentHeight;
    if (above >= 8) {
      top = above;
    } else {
      // 仍然溢出：贴近顶部
      top = 8;
    }
  }

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function initialFloatingStyle(pos?: { left: number; top: number }): string {
  if (!pos) {
    return ""; // 使用默认右上角
  }
  return `left:${Math.round(pos.left)}px;top:${Math.round(pos.top)}px;right:auto;`;
}

function alignFloatingContainer(container: HTMLElement): void {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }
  const rect = app.getBoundingClientRect();
  const offsetRight = Math.max(12, window.innerWidth - rect.right + 24);
  container.style.left = "auto";
  container.style.right = `${Math.round(offsetRight)}px`;
  container.style.top = "12px";
}

function handleResizeForFloating(): void {
  if (state.floatingPos) {
    return;
  }
  const container = document.querySelector<HTMLElement>("[data-role='floating-time']");
  if (container) {
    alignFloatingContainer(container);
  }
}

