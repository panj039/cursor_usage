"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/parser.ts
  async function readUsageFile(file) {
    const text = await file.text();
    return parseUsageCsv(text);
  }
  function parseUsageCsv(text) {
    const rows = parseCsv(text);
    if (!rows.length) {
      return [];
    }
    const header = rows[0].map((cell) => cell.trim());
    const records = [];
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.length === 1 && row[0].trim() === "") {
        continue;
      }
      const raw = mapRow(header, row);
      const dateRaw = raw["Date"];
      if (!dateRaw) {
        continue;
      }
      const date = new Date(dateRaw.replace(/"/g, ""));
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      records.push({
        date,
        kind: sanitize(raw["Kind"]),
        model: sanitize(raw["Model"]),
        maxMode: sanitize(raw["Max Mode"]),
        inputWithCache: toNumber(raw["Input (w/ Cache Write)"]),
        inputNoCache: toNumber(raw["Input (w/o Cache Write)"]),
        cacheRead: toNumber(raw["Cache Read"]),
        outputTokens: toNumber(raw["Output Tokens"]),
        totalTokens: toNumber(raw["Total Tokens"]),
        cost: toNumber(raw["Cost"])
      });
    }
    return records.sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  function sanitize(value) {
    if (!value) {
      return "";
    }
    return value.replace(/^"+|"+$/g, "");
  }
  function toNumber(value) {
    if (!value) {
      return 0;
    }
    const cleaned = value.replace(/"/g, "").trim();
    const parsed = Number(cleaned);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return parsed;
  }
  function mapRow(header, row) {
    const mapped = {};
    for (let i = 0; i < header.length; i += 1) {
      const key = header[i] ?? `${i}`;
      mapped[key] = row[i] ?? "";
    }
    return mapped;
  }
  function parseCsv(text) {
    const rows = [];
    let currentRow = [];
    let currentValue = "";
    let insideQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (insideQuotes && next === '"') {
          currentValue += '"';
          i += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }
      if (char === "," && !insideQuotes) {
        currentRow.push(currentValue);
        currentValue = "";
        continue;
      }
      if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && next === "\n") {
          i += 1;
        }
        currentRow.push(currentValue);
        rows.push(currentRow);
        currentRow = [];
        currentValue = "";
        continue;
      }
      currentValue += char;
    }
    if (currentValue.length || currentRow.length) {
      currentRow.push(currentValue);
      rows.push(currentRow);
    }
    return rows;
  }
  var init_parser = __esm({
    "src/parser.ts"() {
      "use strict";
    }
  });

  // src/filters.ts
  function applyDateRange(records, range) {
    if (!range.start && !range.end) {
      return records;
    }
    const startTime = range.start?.getTime();
    const endTime = range.end?.getTime();
    return records.filter((record) => {
      const recordTime = record.date.getTime();
      if (startTime !== void 0 && recordTime < startTime) {
        return false;
      }
      if (endTime !== void 0 && recordTime > endTime) {
        return false;
      }
      return true;
    });
  }
  function normalizeRange(range) {
    const { start, end } = range;
    if (start && end && start.getTime() > end.getTime()) {
      return { start: end, end: start };
    }
    return range;
  }
  function buildQuickRanges(records) {
    const dayMap = /* @__PURE__ */ new Map();
    const monthMap = /* @__PURE__ */ new Map();
    records.forEach((record) => {
      const dayKey = formatDateKey(record.date);
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          key: `day-${dayKey}`,
          label: dayKey,
          start: startOfDay(record.date),
          end: endOfDay(record.date)
        });
      }
      const monthKey = formatMonthKey(record.date);
      if (!monthMap.has(monthKey)) {
        const range = monthRange(record.date);
        monthMap.set(monthKey, {
          key: `month-${monthKey}`,
          label: monthKey,
          start: range.start,
          end: range.end
        });
      }
    });
    const days = Array.from(dayMap.values()).sort((a, b) => b.start.getTime() - a.start.getTime());
    const months = Array.from(monthMap.values()).sort((a, b) => b.start.getTime() - a.start.getTime());
    return { days, months };
  }
  function startOfDay(date) {
    const instance = new Date(date);
    instance.setHours(0, 0, 0, 0);
    return instance;
  }
  function endOfDay(date) {
    const instance = new Date(date);
    instance.setHours(23, 59, 59, 999);
    return instance;
  }
  function monthRange(date) {
    const start = new Date(date);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return { start, end };
  }
  function formatDateKey(date) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-");
  }
  function formatMonthKey(date) {
    return [date.getFullYear(), pad(date.getMonth() + 1)].join("-");
  }
  function pad(value) {
    return value.toString().padStart(2, "0");
  }
  var init_filters = __esm({
    "src/filters.ts"() {
      "use strict";
    }
  });

  // src/components.ts
  function renderApp(model) {
    return `
    <section class="panel file-panel">
      <div class="file-panel__actions">
        <label class="file-input">
          <span class="file-input__label">\u9009\u62E9 CSV \u6587\u4EF6</span>
          <input data-role="file-input" type="file" accept=".csv,text/csv" hidden />
        </label>
        ${model.fileName ? `<span class="file-panel__filename">\u5F53\u524D\u6587\u4EF6\uFF1A${escapeHtml(model.fileName)}</span>` : ""}
      </div>
      <div class="drop-zone" data-role="drop-zone">
        <p>\u5C06\u6587\u4EF6\u62D6\u62FD\u5230\u6B64\u5904\u6216\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE</p>
        <p class="hint">\u652F\u6301 Cursor \u5BFC\u51FA\u7684\u7528\u91CF CSV \u6587\u4EF6</p>
      </div>
    </section>

    <section class="panel plan-panel">
      <header class="panel__header">
        <h2>\u5957\u9910\u6A21\u5F0F</h2>
      </header>
      <div class="plan-panel__content">
        <div class="plan-options">
          ${model.planOptions.map((option) => renderPlanOption(option, model.activePlan)).join("")}
        </div>
        <div class="plan-usage">
          <div class="plan-usage__ring" style="--progress: ${model.planUsagePercent.toFixed(
      2
    )}; --ring-color: ${model.planUsageColor}">
            <div class="plan-usage__ring-inner">
              <span class="plan-usage__percent">${model.planUsageLabel}</span>
              <span class="plan-usage__caption">\u5DF2\u4F7F\u7528</span>
            </div>
          </div>
          <div class="plan-usage__details">
            <p>${escapeHtml(model.planUsageSummary)}</p>
            <p class="plan-usage__tokens">${escapeHtml(model.planTokensSummary)}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="floating-time" data-role="floating-time" style="${model.floatingStyle}">
      <div class="time-toolbar">
        <button class="time-badge" data-action="toggle-range" aria-expanded="${model.showRangePopover ? "true" : "false"}" title="Shift+\u62D6\u52A8\u53EF\u79FB\u52A8\u4F4D\u7F6E">
          <span class="time-badge__icon">\u{1F552}</span>
          <span class="time-badge__label">${escapeHtml(model.rangeLabel)}</span>
        </button>
        <button class="link-button" data-action="clear-range" title="\u6E05\u7A7A\u7B5B\u9009">\u6E05\u7A7A</button>
      </div>
      <div class="range-popover${model.showRangePopover ? " range-popover--open" : ""}" data-role="range-popover">
        <div class="range-popover__section">
          <div class="range-popover__title">\u5FEB\u901F\u9009\u62E9</div>
          <div class="range-popover__grid">
            ${[
      ["last-24h", "\u6700\u8FD124\u5C0F\u65F6"],
      ["last-3d", "\u6700\u8FD13\u5929"],
      ["last-7d", "\u6700\u8FD17\u5929"],
      ["last-30d", "\u6700\u8FD130\u5929"],
      ["this-month", "\u672C\u6708"],
      ["prev-month", "\u4E0A\u6708"]
    ].map(
      ([key, label]) => `<button class="quick-range" data-action="preset" data-preset="${key}">${label}</button>`
    ).join("")}
          </div>
        </div>
        <div class="range-popover__section">
          <div class="range-popover__title">\u81EA\u5B9A\u4E49</div>
          <div class="custom-range">
            <label>
              <span>\u5F00\u59CB</span>
              <div class="custom-range__row">
                <input type="date" data-filter="start-date" value="${model.filterValues.startDate}" />
                <input type="time" data-filter="start-time" value="${model.filterValues.startTime}" step="60" />
              </div>
            </label>
            <label>
              <span>\u7ED3\u675F</span>
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
        <h2>\u7EDF\u8BA1\u4FE1\u606F</h2>
      </header>
      <div class="stats-panel__content">
        ${model.hasData ? `
              <div class="stat-grid">
                ${model.stats.map((stat) => renderStatCard(stat)).join("")}
              </div>
            ` : `<p class="panel__empty">${escapeHtml(model.statusMessage)}</p>`}
      </div>
    </section>

    ${model.hasData ? `
            <section class="panel table-panel">
              <header class="panel__header">
                <h2>\u6309\u5929\u6C47\u603B</h2>
              </header>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>\u65E5\u671F</th>
                      <th>\u8C03\u7528\u6B21\u6570</th>
                      <th>Total Tokens</th>
                      <th>\u8D39\u7528 (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${model.dailyRows.length ? model.dailyRows.map(
      (row) => `
                                <tr>
                                  <td>${escapeHtml(row.label)}</td>
                                  <td>${escapeHtml(row.requests)}</td>
                                  <td>${escapeHtml(row.totalTokens)}</td>
                                  <td>${escapeHtml(row.cost)}</td>
                                </tr>
                              `
    ).join("") : `<tr><td colspan="4" class="panel__empty">\u5F53\u524D\u7B5B\u9009\u4E0B\u6682\u65E0\u6570\u636E</td></tr>`}
                  </tbody>
                </table>
              </div>
            </section>
          ` : ""}
  `;
  }
  function renderPlanOption(option, activePlan) {
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
  function renderStatCard(stat) {
    return `
    <article class="stat-card">
      <h3>${escapeHtml(stat.label)}</h3>
      <p class="stat-card__value">${escapeHtml(stat.value)}</p>
      ${stat.hint ? `<p class="stat-card__hint">${escapeHtml(stat.hint)}</p>` : ""}
    </article>
  `;
  }
  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  var init_components = __esm({
    "src/components.ts"() {
      "use strict";
    }
  });

  // src/main.ts
  var require_main = __commonJS({
    "src/main.ts"() {
      init_parser();
      init_filters();
      init_components();
      var PLAN_CONFIG = {
        free: {
          label: "Free",
          description: "\u57FA\u7840\u7248\u672C\uFF0C\u9002\u7528\u4E8E\u65E5\u5E38\u8F7B\u91CF\u4F7F\u7528",
          tokenLimit: 5e5
        },
        pro: {
          label: "Pro",
          description: "\u4E13\u4E1A\u7248\uFF0C\u7EA6 1,000 \u4E07 tokens/\u6708",
          tokenLimit: 1e7
        },
        proPlus: {
          label: "ProPlus",
          description: "\u8FDB\u9636\u7248\uFF0C\u7EA6 3,000 \u4E07 tokens/\u6708",
          tokenLimit: 3e7
        },
        ultra: {
          label: "Ultra",
          description: "\u65D7\u8230\u7248\uFF0C\u7EA6 1 \u4EBF tokens/\u6708",
          tokenLimit: 1e8
        }
      };
      var numberFormatter = new Intl.NumberFormat("zh-CN");
      var costFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      var state = {
        records: [],
        filter: {},
        plan: "pro",
        activeQuickRangeKey: void 0,
        fileName: void 0,
        rangePopoverOpen: false
      };
      var root = document.querySelector("[data-view-root]");
      if (!root) {
        throw new Error("\u65E0\u6CD5\u627E\u5230\u5E94\u7528\u5BB9\u5668");
      }
      init();
      function init() {
        bindGlobalDragGuards();
        render();
        bindDelegatedEvents();
        bindDropEvents();
        bindFloatingDragEvents();
        bindOutsidePopoverClose();
        window.addEventListener("resize", handleResizeForFloating);
      }
      function bindGlobalDragGuards() {
        const guard = (event) => {
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
      function bindDelegatedEvents() {
        root.addEventListener("click", (event) => {
          const target = event.target;
          if (!target) {
            return;
          }
          const withinPopover = Boolean(target.closest("[data-role='range-popover']")) || Boolean(target.closest("[data-action='toggle-range']"));
          if (state.rangePopoverOpen && !withinPopover) {
            state.rangePopoverOpen = false;
            queueMicrotask(() => {
              if (!state.rangePopoverOpen) {
                render();
              }
            });
          }
          const planElement = target.closest("[data-action='plan']");
          if (planElement?.dataset.plan) {
            event.preventDefault();
            handlePlanChange(planElement.dataset.plan);
            return;
          }
          const toggleRange = target.closest("[data-action='toggle-range']");
          if (toggleRange) {
            event.preventDefault();
            state.rangePopoverOpen = !state.rangePopoverOpen;
            render();
            return;
          }
          const preset = target.closest("[data-action='preset']");
          if (preset?.dataset.preset) {
            event.preventDefault();
            applyPresetRange(preset.dataset.preset);
            return;
          }
          const rangeElement = target.closest("[data-action='range']");
          if (rangeElement?.dataset.rangeKey) {
            event.preventDefault();
            handleQuickRange(rangeElement.dataset.rangeKey);
            return;
          }
          const clearRange = target.closest("[data-action='clear-range']");
          if (clearRange) {
            event.preventDefault();
            clearFilters();
            return;
          }
        });
        root.addEventListener("input", (event) => {
          const target = event.target;
          if (!target || !target.dataset.filter) {
            return;
          }
          handleFilterInput(target.dataset.filter, target.value);
        });
        root.addEventListener("change", (event) => {
          const input = event.target;
          if (!input) {
            return;
          }
          if (input.dataset.role === "file-input" && input.files?.length) {
            handleFiles(Array.from(input.files));
            input.value = "";
          }
        });
      }
      function bindDropEvents() {
        const getDropZone = () => root.querySelector("[data-role='drop-zone']");
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
          const zone = event.target?.closest("[data-role='drop-zone']");
          if (zone) {
            zone.classList.add("drop-zone--active");
            event.dataTransfer.dropEffect = "copy";
          }
        });
        root.addEventListener("dragleave", (event) => {
          const zone = event.target?.closest("[data-role='drop-zone']") ?? getDropZone();
          if (zone && !zone.contains(event.relatedTarget)) {
            zone.classList.remove("drop-zone--active");
          }
        });
        root.addEventListener("drop", (event) => {
          if (!event.dataTransfer) {
            return;
          }
          const zone = event.target?.closest("[data-role='drop-zone']") ?? getDropZone();
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
      function bindFloatingDragEvents() {
        window.addEventListener("mousedown", (event) => {
          const target = event.target;
          if (!target) return;
          const badge = target.closest(".time-badge");
          const container = document.querySelector("[data-role='floating-time']");
          if (!badge || !container) return;
          if (!(event instanceof MouseEvent) || event.button !== 0) return;
          if (!event.shiftKey) return;
          event.preventDefault();
          const rect = container.getBoundingClientRect();
          state.dragging = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
          state.floatingPos = { left: rect.left, top: rect.top };
          applyFloatingInlineStyle(container, state.floatingPos);
        });
        window.addEventListener("mousemove", (event) => {
          if (!state.dragging) return;
          const container = document.querySelector("[data-role='floating-time']");
          if (!container) return;
          const left = Math.max(8, Math.min(window.innerWidth - 8 - container.offsetWidth, event.clientX - state.dragging.offsetX));
          const top = Math.max(8, Math.min(window.innerHeight - 8 - container.offsetHeight, event.clientY - state.dragging.offsetY));
          state.floatingPos = { left, top };
          applyFloatingInlineStyle(container, state.floatingPos);
        });
        window.addEventListener("mouseup", () => {
          if (state.dragging) {
            state.dragging = void 0;
          }
        });
      }
      function bindOutsidePopoverClose() {
        window.addEventListener(
          "click",
          (event) => {
            if (!state.rangePopoverOpen) {
              return;
            }
            const target = event.target;
            if (!target) {
              return;
            }
            const within = Boolean(target.closest("[data-role='range-popover']")) || Boolean(target.closest("[data-action='toggle-range']"));
            if (within) {
              return;
            }
            state.rangePopoverOpen = false;
            render();
          },
          false
        );
      }
      function applyFloatingInlineStyle(container, pos) {
        if (pos) {
          container.style.left = `${Math.round(pos.left)}px`;
          container.style.top = `${Math.round(pos.top)}px`;
          container.style.right = "auto";
          container.style.position = "fixed";
        }
      }
      function handleFiles(files) {
        if (!files.length) {
          return;
        }
        const [file] = files;
        readUsageFile(file).then((records) => {
          state.records = records;
          state.fileName = file.name;
          state.activeQuickRangeKey = void 0;
          state.filter = {};
          render();
        }).catch((error) => {
          console.error("\u89E3\u6790 CSV \u65F6\u51FA\u9519\uFF1A", error);
          alert("\u65E0\u6CD5\u89E3\u6790\u8BE5\u6587\u4EF6\uFF0C\u8BF7\u786E\u8BA4\u5176\u4E3A\u6709\u6548\u7684 Cursor \u7528\u91CF CSV\u3002");
        });
      }
      function handlePlanChange(plan) {
        if (!PLAN_CONFIG[plan]) {
          return;
        }
        state.plan = plan;
        state.rangePopoverOpen = false;
        render();
      }
      function handleQuickRange(rangeKey) {
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
          endTime: toTimeInput(match.end)
        };
        state.activeQuickRangeKey = match.key;
        state.rangePopoverOpen = false;
        render();
      }
      function handleFilterInput(key, value) {
        if (!["start-date", "start-time", "end-date", "end-time"].includes(key)) {
          return;
        }
        if (value === "") {
          delete state.filter[normalizeFilterKey(key)];
        } else {
          const normalizedKey = normalizeFilterKey(key);
          state.filter[normalizedKey] = value;
        }
        state.activeQuickRangeKey = void 0;
        render();
      }
      function normalizeFilterKey(key) {
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
      function clearFilters() {
        if (!hasFilter(state.filter)) {
          return;
        }
        state.filter = {};
        state.activeQuickRangeKey = void 0;
        state.rangePopoverOpen = false;
        render();
      }
      function hasFilter(filter) {
        return Boolean(filter.startDate || filter.startTime || filter.endDate || filter.endTime);
      }
      function render() {
        const dateRange = normalizeRange(toDateRange(state.filter));
        const planConfig = PLAN_CONFIG[state.plan];
        const filteredRecords = applyDateRange(state.records, dateRange);
        const summary = summarize(filteredRecords);
        const quickRanges = buildQuickRanges(state.records);
        const percent = computeUsagePercent(summary.totalTokens, planConfig.tokenLimit);
        const percentLabel = formatPercentLabel(percent);
        const statusMessage = state.records.length ? "\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6682\u65E0\u6570\u636E\uFF0C\u8BF7\u5C1D\u8BD5\u5176\u4ED6\u65F6\u95F4\u8303\u56F4\u3002" : "\u8BF7\u9009\u62E9\u6216\u62D6\u5165 CSV \u6587\u4EF6\u4EE5\u67E5\u770B\u7528\u91CF\u7EDF\u8BA1\u3002";
        const renderModel = {
          hasData: filteredRecords.length > 0,
          fileName: state.fileName,
          statusMessage,
          planOptions: toPlanOptions(),
          activePlan: state.plan,
          planUsagePercent: percent,
          planUsageLabel: percentLabel,
          planUsageColor: usageColor(percent),
          planUsageSummary: `${planConfig.label} \u5957\u9910\u5DF2\u4F7F\u7528 ${formatNumber(summary.totalTokens)} tokens\uFF0C\u5360\u6BD4 ${percentLabel}`,
          planTokensSummary: `${formatNumber(summary.totalTokens)} / ${formatNumber(planConfig.tokenLimit)} tokens`,
          stats: summary.stats,
          quickRanges: toQuickRangeView(quickRanges, state.activeQuickRangeKey),
          filterValues: toFilterValues(state.filter),
          rangeLabel: currentRangeLabel(dateRange),
          showRangePopover: state.rangePopoverOpen,
          floatingStyle: initialFloatingStyle(state.floatingPos),
          dailyRows: summary.dailyRows,
          quickRangesAvailable: state.records.length > 0,
          activeQuickRangeKey: state.activeQuickRangeKey
        };
        root.innerHTML = renderApp(renderModel);
        if (state.rangePopoverOpen) {
          positionRangePopover();
        }
        const container = document.querySelector("[data-role='floating-time']");
        if (container) {
          if (state.floatingPos) {
            applyFloatingInlineStyle(container, state.floatingPos);
          } else {
            alignFloatingContainer(container);
          }
        }
      }
      function summarize(records) {
        const totals = {
          totalTokens: 0,
          totalCost: 0,
          inputWithCache: 0,
          inputNoCache: 0,
          cacheRead: 0,
          outputTokens: 0
        };
        const byDay = /* @__PURE__ */ new Map();
        records.forEach((record) => {
          totals.totalTokens += record.totalTokens;
          totals.totalCost += record.cost;
          totals.inputWithCache += record.inputWithCache;
          totals.inputNoCache += record.inputNoCache;
          totals.cacheRead += record.cacheRead;
          totals.outputTokens += record.outputTokens;
          const dayKey = formatDateKey2(record.date);
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
              cost: record.cost
            });
          }
        });
        const stats = [
          {
            label: "\u603B\u8C03\u7528\u6B21\u6570",
            value: formatNumber(records.length)
          },
          {
            label: "Total Tokens",
            value: formatNumber(totals.totalTokens),
            hint: `\u5E73\u5747 ${formatNumber(records.length ? Math.round(totals.totalTokens / records.length) : 0)} / \u8C03\u7528`
          },
          {
            label: "\u8F93\u5165 Tokens (\u542B\u7F13\u5B58\u5199\u5165)",
            value: formatNumber(totals.inputWithCache)
          },
          {
            label: "\u8F93\u5165 Tokens (\u65E0\u7F13\u5B58\u5199\u5165)",
            value: formatNumber(totals.inputNoCache)
          },
          {
            label: "\u7F13\u5B58\u8BFB\u53D6",
            value: formatNumber(totals.cacheRead)
          },
          {
            label: "\u8F93\u51FA Tokens",
            value: formatNumber(totals.outputTokens)
          },
          {
            label: "\u603B\u8D39\u7528 (USD)",
            value: formatCost(totals.totalCost)
          }
        ];
        const dailyRows = Array.from(byDay.entries()).map(([key, entry]) => ({
          key,
          label: key,
          requests: formatNumber(entry.requests),
          totalTokens: formatNumber(entry.tokens),
          cost: formatCost(entry.cost)
        })).sort((a, b) => a.key > b.key ? -1 : 1);
        return {
          stats,
          dailyRows,
          totalTokens: totals.totalTokens,
          totalCost: totals.totalCost
        };
      }
      function toPlanOptions() {
        return Object.entries(PLAN_CONFIG).map(([id, config]) => ({
          id,
          label: config.label,
          description: config.description
        }));
      }
      function toQuickRangeView(quickRanges, activeKey) {
        return {
          days: quickRanges.days.map((item) => ({
            key: item.key,
            label: formatDateLabel(item.start),
            active: activeKey === item.key
          })),
          months: quickRanges.months.map((item) => ({
            key: item.key,
            label: formatMonthLabel(item.start),
            active: activeKey === item.key
          }))
        };
      }
      function toFilterValues(filter) {
        return {
          startDate: filter.startDate ?? "",
          startTime: filter.startTime ?? "",
          endDate: filter.endDate ?? "",
          endTime: filter.endTime ?? ""
        };
      }
      function toDateRange(filter) {
        const range = {};
        if (filter.startDate) {
          range.start = composeDate(filter.startDate, filter.startTime ?? "00:00");
        }
        if (filter.endDate) {
          range.end = composeDate(filter.endDate, filter.endTime ?? "23:59");
        }
        return range;
      }
      function currentRangeLabel(range) {
        if (!range.start && !range.end) {
          return "\u5168\u90E8\u65F6\u95F4";
        }
        if (range.start && range.end) {
          return `${toDateInput(range.start)} ${toTimeInput(range.start)} \u2192 ${toDateInput(range.end)} ${toTimeInput(range.end)}`;
        }
        if (range.start) {
          return `${toDateInput(range.start)} ${toTimeInput(range.start)} \u2192 \u73B0\u5728`;
        }
        return `\u81F3 ${toDateInput(range.end)} ${toTimeInput(range.end)}`;
      }
      function applyPresetRange(key) {
        const now = /* @__PURE__ */ new Date();
        let start;
        let end;
        switch (key) {
          case "last-24h":
            end = now;
            start = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
            break;
          case "last-3d":
            end = now;
            start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1e3);
            break;
          case "last-7d":
            end = now;
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
            break;
          case "last-30d":
            end = now;
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
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
          startDate: toDateInput(start),
          startTime: toTimeInput(start),
          endDate: toDateInput(end),
          endTime: toTimeInput(end)
        };
        state.activeQuickRangeKey = void 0;
        state.rangePopoverOpen = false;
        render();
      }
      function composeDate(datePart, timePart) {
        const [year, month, day] = datePart.split("-").map((value) => Number(value));
        const [hour, minute] = timePart.split(":").map((value) => Number(value));
        return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
      }
      function toDateInput(date) {
        return [
          date.getFullYear(),
          pad2(date.getMonth() + 1),
          pad2(date.getDate())
        ].join("-");
      }
      function toTimeInput(date) {
        return [pad2(date.getHours()), pad2(date.getMinutes())].join(":");
      }
      function formatPercentLabel(percent) {
        return `${Math.min(100, Math.round(percent))}%`;
      }
      function computeUsagePercent(totalTokens, limit) {
        if (!limit) {
          return 0;
        }
        return Math.min(100, totalTokens / limit * 100);
      }
      function usageColor(percent) {
        if (percent < 60) {
          return "var(--success)";
        }
        if (percent < 85) {
          return "#facc15";
        }
        return "var(--danger)";
      }
      function formatNumber(value) {
        return numberFormatter.format(Math.round(value));
      }
      function formatCost(value) {
        return costFormatter.format(value);
      }
      function formatDateKey2(date) {
        return [
          date.getFullYear(),
          pad2(date.getMonth() + 1),
          pad2(date.getDate())
        ].join("-");
      }
      function formatDateLabel(date) {
        return [
          date.getFullYear(),
          pad2(date.getMonth() + 1),
          pad2(date.getDate())
        ].join("-");
      }
      function formatMonthLabel(date) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
      }
      function pad2(value) {
        return value.toString().padStart(2, "0");
      }
      function positionRangePopover() {
        const trigger = document.querySelector("[data-action='toggle-range']");
        const popover = document.querySelector("[data-role='range-popover']");
        if (!trigger || !popover) {
          return;
        }
        const rect = trigger.getBoundingClientRect();
        const gap = 8;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let left = rect.left;
        let top = rect.bottom + gap;
        const contentWidth = Math.min(popover.offsetWidth || 460, viewportWidth - 16);
        const contentHeight = popover.offsetHeight || 320;
        if (left + contentWidth > viewportWidth - 8) {
          left = Math.max(8, viewportWidth - 8 - contentWidth);
        }
        if (top + contentHeight > viewportHeight - 8) {
          const above = rect.top - gap - contentHeight;
          if (above >= 8) {
            top = above;
          } else {
            top = 8;
          }
        }
        popover.style.left = `${Math.round(left)}px`;
        popover.style.top = `${Math.round(top)}px`;
      }
      function initialFloatingStyle(pos) {
        if (!pos) {
          return "";
        }
        return `left:${Math.round(pos.left)}px;top:${Math.round(pos.top)}px;right:auto;`;
      }
      function alignFloatingContainer(container) {
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
      function handleResizeForFloating() {
        if (state.floatingPos) {
          return;
        }
        const container = document.querySelector("[data-role='floating-time']");
        if (container) {
          alignFloatingContainer(container);
        }
      }
    }
  });
  require_main();
})();
//# sourceMappingURL=main.js.map
