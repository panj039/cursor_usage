import { QuickRanges } from "./filters";

export interface PlanOption {
  id: string;
  label: string;
  description?: string;
}

export interface StatCard {
  label: string;
  value: string;
  hint?: string;
}

export interface DailyRow {
  key: string;
  label: string;
  totalTokens: string;
  requests: string;
  cost: string;
}

export interface FilterValues {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export interface QuickRangeView {
  days: QuickRangeViewItem[];
  months: QuickRangeViewItem[];
}

export interface QuickRangeViewItem {
  key: string;
  label: string;
  active: boolean;
}

export interface RenderModel {
  hasData: boolean;
  fileName?: string;
  statusMessage: string;
  planOptions: PlanOption[];
  activePlan: string;
  planUsagePercent: number;
  planUsageLabel: string;
  planUsageSummary: string;
  planTokensSummary: string;
  planUsageNote: string;
  planUsageColor: string;
  stats: StatCard[];
  quickRanges: QuickRangeView;
  filterValues: FilterValues;
  rangeLabel: string;
  showRangePopover: boolean;
  dailyRows: DailyRow[];
  quickRangesAvailable: boolean;
  activeQuickRangeKey?: string;
  floatingStyle: string;
}

export function renderApp(model: RenderModel): string {
  return `
    <section class="panel file-panel">
      <div class="file-panel__actions">
        <label class="file-input">
          <span class="file-input__label">选择 CSV 文件</span>
          <input data-role="file-input" type="file" accept=".csv,text/csv" hidden />
        </label>
        ${model.fileName ? `<span class="file-panel__filename">当前文件：${escapeHtml(model.fileName)}</span>` : ""}
      </div>
      <div class="drop-zone" data-role="drop-zone">
        <p>将文件拖拽到此处或点击上方按钮</p>
        <p class="hint">支持 Cursor 导出的用量 CSV 文件</p>
      </div>
    </section>

    <section class="panel plan-panel">
      <header class="panel__header">
        <h2>套餐模式</h2>
      </header>
      <div class="plan-panel__content">
        <div class="plan-options">
          ${model.planOptions.map((option) => renderPlanOption(option, model.activePlan)).join("")}
        </div>
        <div class="plan-usage">
          <div class="plan-usage__ring" style="--progress: ${model.planUsagePercent.toFixed(
            2,
          )}; --ring-color: ${model.planUsageColor}">
            <div class="plan-usage__ring-inner">
              <span class="plan-usage__percent">${model.planUsageLabel}</span>
              <span class="plan-usage__caption">已使用</span>
            </div>
          </div>
          <div class="plan-usage__details">
            <p>${escapeHtml(model.planUsageSummary)}</p>
            <p class="plan-usage__tokens">${escapeHtml(model.planTokensSummary)}</p>
            <p class="plan-usage__note">${escapeHtml(model.planUsageNote)}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="floating-time" data-role="floating-time" style="${model.floatingStyle}">
      <div class="time-toolbar">
        <button class="time-badge" data-action="toggle-range" aria-expanded="${model.showRangePopover ? "true" : "false"}" title="Shift+拖动可移动位置">
          <span class="time-badge__icon">🕒</span>
          <span class="time-badge__label">${escapeHtml(model.rangeLabel)}</span>
        </button>
        <button class="link-button" data-action="clear-range" title="清空筛选">清空</button>
      </div>
      <div class="range-popover${model.showRangePopover ? " range-popover--open" : ""}" data-role="range-popover">
        <div class="range-popover__section">
          <div class="range-popover__title">快速选择</div>
          <div class="range-popover__grid">
            ${[
              ["last-24h", "最近24小时"],
              ["last-3d", "最近3天"],
              ["last-7d", "最近7天"],
              ["last-30d", "最近30天"],
              ["this-month", "本月"],
              ["prev-month", "上月"],
            ]
              .map(
                ([key, label]) =>
                  `<button class="quick-range" data-action="preset" data-preset="${key}">${label}</button>`,
              )
              .join("")}
          </div>
        </div>
        <div class="range-popover__section">
          <div class="range-popover__title">自定义</div>
          <div class="custom-range">
            <label>
              <span>开始</span>
              <div class="custom-range__row">
                <input type="date" data-filter="start-date" value="${model.filterValues.startDate}" />
                <input type="time" data-filter="start-time" value="${model.filterValues.startTime}" step="60" />
              </div>
            </label>
            <label>
              <span>结束</span>
              <div class="custom-range__row">
                <input type="date" data-filter="end-date" value="${model.filterValues.endDate}" />
                <input type="time" data-filter="end-time" value="${model.filterValues.endTime}" step="60" />
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>

    <section class="panel stats-panel">
      <header class="panel__header">
        <h2>统计信息</h2>
      </header>
      <div class="stats-panel__content">
        ${
          model.hasData
            ? `
              <div class="stat-grid">
                ${model.stats.map((stat) => renderStatCard(stat)).join("")}
              </div>
            `
            : `<p class="panel__empty">${escapeHtml(model.statusMessage)}</p>`
        }
      </div>
    </section>

    ${
      model.hasData
        ? `
            <section class="panel table-panel">
              <header class="panel__header">
                <h2>按天汇总</h2>
              </header>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>调用次数</th>
                      <th>Total Tokens</th>
                      <th>费用 (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      model.dailyRows.length
                        ? model.dailyRows
                            .map(
                              (row) => `
                                <tr>
                                  <td>${escapeHtml(row.label)}</td>
                                  <td>${escapeHtml(row.requests)}</td>
                                  <td>${escapeHtml(row.totalTokens)}</td>
                                  <td>${escapeHtml(row.cost)}</td>
                                </tr>
                              `,
                            )
                            .join("")
                        : `<tr><td colspan="4" class="panel__empty">当前筛选下暂无数据</td></tr>`
                    }
                  </tbody>
                </table>
              </div>
            </section>
          `
        : ""
    }
  `;
}

function renderPlanOption(option: PlanOption, activePlan: string): string {
  const isActive = option.id === activePlan;
  return `
    <button
      class="plan-option${isActive ? " plan-option--active" : ""}"
      data-action="plan"
      data-plan="${option.id}"
      type="button"
    >
      <span class="plan-option__label">${escapeHtml(option.label)}</span>
      ${option.description ? `<span class="plan-option__desc">${escapeHtml(option.description)}</span>` : ""}
    </button>
  `;
}

function renderQuickRange(item: QuickRangeViewItem): string {
  return `
    <button
      class="quick-range${item.active ? " quick-range--active" : ""}"
      data-action="range"
      data-range-key="${item.key}"
      type="button"
    >
      ${escapeHtml(item.label)}
    </button>
  `;
}

function renderStatCard(stat: StatCard): string {
  return `
    <article class="stat-card">
      <h3>${escapeHtml(stat.label)}</h3>
      <p class="stat-card__value">${escapeHtml(stat.value)}</p>
      ${stat.hint ? `<p class="stat-card__hint">${escapeHtml(stat.hint)}</p>` : ""}
    </article>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

