const DATA = window.TIMESHEET_DATA;
const CONFIG_KEY = "timesheet-calendar-config-v2";
const LEGACY_CONFIG_KEY = DATA.month ? `timesheet-calendar-config-${DATA.month}` : "";

const CATEGORY_META = {
  Project: { label: "Project", color: "#d71920" },
  CR: { label: "CR", color: "#4069b1" },
  Mgmt: { label: "Mgmt", color: "#7b5aa6" },
  Sup: { label: "Sup", color: "#117b73" },
  Other: { label: "Other", color: "#7c8791" },
  PTO: { label: "PTO", color: "#ba7a15" },
  Holiday: { label: "Holiday", color: "#4f8a38" },
  Reminder: { label: "Reminder", color: "#a4aab1" },
  Canceled: { label: "Canceled", color: "#5f646b" },
};

const MEMBER_COLORS = {
  Dai: "#117b73",
  Mia: "#4069b1",
  Sky: "#d71920",
};

const DATA_MONTHS = Array.isArray(DATA.months) && DATA.months.length
  ? DATA.months
  : buildMonthsFromEvents(DATA.events || []);
const DATA_DATE_RANGE = normalizeDateRange(DATA.dateRange, DATA_MONTHS, DATA.events || []);
const CALENDAR_DATE_RANGE = {
  start: DATA_DATE_RANGE.monthStart || DATA_DATE_RANGE.start,
  end: DATA_DATE_RANGE.monthEnd || DATA_DATE_RANGE.end,
};
const DEFAULT_MONTH = DATA_MONTHS.at(-1)?.value || DATA_DATE_RANGE.start.slice(0, 7);

const state = {
  selectedMember: "All",
  rangeMode: "all",
  selectedMonth: DEFAULT_MONTH,
  selectedMonths: new Set(DATA_MONTHS.map((month) => month.value)),
  rangeStart: DATA_DATE_RANGE.start,
  rangeEnd: DATA_DATE_RANGE.end,
  search: "",
  calendarConfig: loadCalendarConfig(),
};

const els = {
  scopeLine: document.querySelector("#scopeLine"),
  memberFilter: document.querySelector("#memberFilter"),
  rangeMode: document.querySelector("#rangeMode"),
  singleMonth: document.querySelector("#singleMonth"),
  multiMonthList: document.querySelector("#multiMonthList"),
  rangeStart: document.querySelector("#rangeStart"),
  rangeEnd: document.querySelector("#rangeEnd"),
  rangeSummary: document.querySelector("#rangeSummary"),
  singleMonthPanel: document.querySelector("#singleMonthPanel"),
  multiMonthPanel: document.querySelector("#multiMonthPanel"),
  customRangePanel: document.querySelector("#customRangePanel"),
  sourceFiles: document.querySelector("#sourceFiles"),
  sourceUrl: document.querySelector("#sourceUrl"),
  kpis: document.querySelector("#kpis"),
  noticeBar: document.querySelector("#noticeBar"),
  memberLoad: document.querySelector("#memberLoad"),
  dailyChart: document.querySelector("#dailyChart"),
  categoryBars: document.querySelector("#categoryBars"),
  projectSpend: document.querySelector("#projectSpend"),
  weeklyBalance: document.querySelector("#weeklyBalance"),
  exceptionList: document.querySelector("#exceptionList"),
  eventTable: document.querySelector("#eventTable"),
  tableFooter: document.querySelector("#tableFooter"),
  searchInput: document.querySelector("#searchInput"),
  exportButton: document.querySelector("#exportButton"),
  calendarConfigButton: document.querySelector("#calendarConfigButton"),
  calendarDialog: document.querySelector("#calendarDialog"),
  closeCalendarDialog: document.querySelector("#closeCalendarDialog"),
  calendarOverrideForm: document.querySelector("#calendarOverrideForm"),
  overrideDate: document.querySelector("#overrideDate"),
  overrideType: document.querySelector("#overrideType"),
  overrideName: document.querySelector("#overrideName"),
  configuredWorkdays: document.querySelector("#configuredWorkdays"),
  configuredStandardHours: document.querySelector("#configuredStandardHours"),
  overrideCount: document.querySelector("#overrideCount"),
  holidayList: document.querySelector("#holidayList"),
  workdayList: document.querySelector("#workdayList"),
  resetCalendarConfig: document.querySelector("#resetCalendarConfig"),
  rebuildNoteButton: document.querySelector("#rebuildNoteButton"),
  assumptionDialog: document.querySelector("#assumptionDialog"),
  assumptionList: document.querySelector("#assumptionList"),
  closeDialog: document.querySelector("#closeDialog"),
};

function defaultCalendarConfig() {
  const overrides = {};
  DATA.events
    .filter((event) => event.category === "Holiday")
    .forEach((event) => {
      overrides[event.date] = {
        type: "holiday",
        name: event.subject || "Holiday",
        source: "calendar",
      };
    });
  return { overrides };
}

function loadCalendarConfig() {
  try {
    for (const key of [CONFIG_KEY, LEGACY_CONFIG_KEY].filter(Boolean)) {
      const saved = localStorage.getItem(key);
      if (!saved) continue;
      const parsed = JSON.parse(saved);
      return { overrides: parsed.overrides || {} };
    }
  } catch {
    // Ignore corrupt local settings and fall back to detected holidays.
  }
  return defaultCalendarConfig();
}

function saveCalendarConfig() {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(state.calendarConfig));
}

function formatHours(value) {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  return `${rounded.toLocaleString("zh-CN", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })}h`;
}

function formatSignedHours(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatHours(value)}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSelectedMembers() {
  if (state.selectedMember === "All") return DATA.members;
  return [state.selectedMember];
}

function toDateText(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateObject(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthStartText(monthText) {
  return `${monthText}-01`;
}

function monthEndText(monthText) {
  const [year, month] = monthText.split("-").map(Number);
  return toDateText(new Date(year, month, 0));
}

function daysBetween(startText, endText) {
  if (!startText || !endText || startText > endText) return [];
  const days = [];
  const current = dateObject(startText);
  const end = dateObject(endText);
  while (current <= end) {
    days.push(toDateText(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function monthDays(monthText) {
  return daysBetween(monthStartText(monthText), monthEndText(monthText));
}

function buildMonthsFromEvents(events) {
  const monthValues = [...new Set(events.map((event) => event.date?.slice(0, 7)).filter(Boolean))]
    .sort();
  return monthValues.map((month) => ({
    value: month,
    label: month,
    start: monthStartText(month),
    end: monthEndText(month),
  }));
}

function normalizeDateRange(range, months, events) {
  if (range?.start && range?.end) return range;
  if (months.length) {
    return {
      start: months[0].start,
      end: months.at(-1).end,
      eventStart: events.map((event) => event.date).filter(Boolean).sort()[0] || "",
      eventEnd: events.map((event) => event.date).filter(Boolean).sort().at(-1) || "",
    };
  }
  const today = toDateText(new Date());
  return {
    start: monthStartText(today.slice(0, 7)),
    end: monthEndText(today.slice(0, 7)),
    eventStart: "",
    eventEnd: "",
  };
}

function selectedRangeBounds() {
  if (state.rangeMode === "single") {
    const month = DATA_MONTHS.find((item) => item.value === state.selectedMonth);
    return month
      ? { start: month.start, end: month.end, label: month.label }
      : { start: "", end: "", label: "未选择月份" };
  }

  if (state.rangeMode === "multi") {
    const months = DATA_MONTHS.filter((item) => state.selectedMonths.has(item.value));
    if (!months.length) return { start: "", end: "", label: "未选择月份" };
    const first = months[0];
    const last = months.at(-1);
    const label = months.length === 1 ? first.label : `${first.label} 至 ${last.label}（${months.length} 个月）`;
    return { start: first.start, end: last.end, label };
  }

  if (state.rangeMode === "custom") {
    return {
      start: state.rangeStart,
      end: state.rangeEnd,
      label: `${state.rangeStart} 至 ${state.rangeEnd}`,
    };
  }

  return {
    start: DATA_DATE_RANGE.start,
    end: DATA_DATE_RANGE.end,
    label: `${DATA_DATE_RANGE.start} 至 ${DATA_DATE_RANGE.end}`,
  };
}

function rangeDays() {
  if (state.rangeMode === "single") return monthDays(state.selectedMonth);
  if (state.rangeMode === "multi") {
    return DATA_MONTHS
      .filter((month) => state.selectedMonths.has(month.value))
      .flatMap((month) => daysBetween(month.start, month.end));
  }
  const range = selectedRangeBounds();
  return daysBetween(range.start, range.end);
}

function dateInSelectedRange(dateText) {
  if (!dateText) return false;
  if (state.rangeMode === "single") return dateText.slice(0, 7) === state.selectedMonth;
  if (state.rangeMode === "multi") return state.selectedMonths.has(dateText.slice(0, 7));
  const range = selectedRangeBounds();
  return Boolean(range.start && range.end && dateText >= range.start && dateText <= range.end);
}

function isWeekend(dateText) {
  const day = dateObject(dateText).getDay();
  return day === 0 || day === 6;
}

function isDefaultWorkday(dateText) {
  return !isWeekend(dateText);
}

function isConfiguredWorkday(dateText) {
  const override = state.calendarConfig.overrides[dateText];
  if (override?.type === "holiday") return false;
  if (override?.type === "workday") return true;
  return isDefaultWorkday(dateText);
}

function configuredWorkdays() {
  return rangeDays().filter(isConfiguredWorkday);
}

function dailyChartDays() {
  const days = new Set(configuredWorkdays());
  workEvents().forEach((event) => {
    if (event.hours > 0) {
      days.add(event.date);
    }
  });
  return [...days].sort((a, b) => a.localeCompare(b));
}

function weekStart(dateText) {
  const date = dateObject(dateText);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toDateText(date);
}

function weekEnd(weekStartText) {
  const date = dateObject(weekStartText);
  date.setDate(date.getDate() + 6);
  return toDateText(date);
}

function weekTargets() {
  const targets = new Map();
  configuredWorkdays().forEach((day) => {
    const week = weekStart(day);
    targets.set(week, (targets.get(week) || 0) + DATA.workdayHours);
  });
  return [...targets.entries()]
    .map(([week, hours]) => ({ weekStart: week, weekEnd: weekEnd(week), targetHours: hours }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function standardHoursPerMember() {
  return configuredWorkdays().length * DATA.workdayHours;
}

function isInMemberScope(event) {
  return getSelectedMembers().includes(event.member);
}

function isTrackedEvent(event) {
  return !event.canceled && !event.allDay && !event.isReminder;
}

function isWorkEvent(event) {
  return isTrackedEvent(event) && event.isWork;
}

function isPtoEvent(event) {
  return isTrackedEvent(event) && event.category === "PTO";
}

function isHolidayEvent(event) {
  return isTrackedEvent(event) && event.category === "Holiday";
}

function isTimeOffEvent(event) {
  return isPtoEvent(event) || isHolidayEvent(event);
}

function isCreditEvent(event) {
  return isWorkEvent(event) || isPtoEvent(event);
}

function passesDisplayToggles(event) {
  return !event.canceled && !event.allDay && !event.isReminder;
}

function passesSearch(event) {
  const query = state.search.trim().toLowerCase();
  if (!query) return true;
  return [
    event.subject,
    event.member,
    event.category,
    event.prefix,
    event.projectName,
    event.crSystem,
    event.workItemName,
    event.showTimeAs,
    event.organizer,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function visibleEvents({ includeSearch = true } = {}) {
  return DATA.events
    .filter(isInMemberScope)
    .filter((event) => dateInSelectedRange(event.date))
    .filter(passesDisplayToggles)
    .filter((event) => (includeSearch ? passesSearch(event) : true))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function scopedEvents() {
  return DATA.events.filter(isInMemberScope).filter((event) => dateInSelectedRange(event.date));
}

function workEvents() {
  return scopedEvents().filter(isWorkEvent).sort((a, b) => a.start.localeCompare(b.start));
}

function distributionEvents() {
  return workEvents().filter((event) => DATA.distributionCategories.includes(event.category));
}

function ptoEvents() {
  return scopedEvents().filter(isPtoEvent);
}

function holidayEvents() {
  return scopedEvents().filter(isHolidayEvent);
}

function creditEvents() {
  return scopedEvents().filter(isCreditEvent);
}

function sumHours(events) {
  return events.reduce((total, event) => total + Number(event.hours || 0), 0);
}

function groupBy(items, getKey) {
  return items.reduce((map, item) => {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function categoryLabel(category) {
  return CATEGORY_META[category]?.label ?? category;
}

function categoryColor(category) {
  return CATEGORY_META[category]?.color ?? "#65717d";
}

function renderRangeControls() {
  els.rangeMode.value = state.rangeMode;
  els.singleMonth.innerHTML = DATA_MONTHS
    .map((month) => `<option value="${escapeHtml(month.value)}">${escapeHtml(month.label)}</option>`)
    .join("");
  els.singleMonth.value = state.selectedMonth;

  els.multiMonthList.innerHTML = DATA_MONTHS.length
    ? DATA_MONTHS
        .map((month) => {
          const checked = state.selectedMonths.has(month.value) ? "checked" : "";
          return `
            <label class="month-row">
              <input type="checkbox" value="${escapeHtml(month.value)}" ${checked} />
              <span>${escapeHtml(month.label)}</span>
            </label>
          `;
        })
        .join("")
    : `<div class="empty-state compact-empty">没有可选择的月份</div>`;

  [els.rangeStart, els.rangeEnd].forEach((input) => {
    input.min = DATA_DATE_RANGE.start;
    input.max = DATA_DATE_RANGE.end;
  });
  els.rangeStart.value = state.rangeStart;
  els.rangeEnd.value = state.rangeEnd;
  updateRangeControlVisibility();
  renderScopeLine();
}

function updateRangeControlVisibility() {
  els.singleMonthPanel.hidden = state.rangeMode !== "single";
  els.multiMonthPanel.hidden = state.rangeMode !== "multi";
  els.customRangePanel.hidden = state.rangeMode !== "custom";
}

function renderScopeLine() {
  const range = selectedRangeBounds();
  const memberCount = getSelectedMembers().length;
  const workdayCount = configuredWorkdays().length;
  const rangeText = range.start && range.end ? range.label : "未选择时间范围";
  els.scopeLine.textContent = `范围：${rangeText}，${memberCount} 位成员，${workdayCount} 个配置工作日；生成时间 ${DATA.generatedAt}`;
  if (els.rangeSummary) {
    els.rangeSummary.textContent = range.start && range.end
      ? `${range.start} 至 ${range.end} · ${workdayCount} 个配置工作日`
      : "请选择至少一个月份";
  }
}

function initControls() {
  els.memberFilter.innerHTML = ["All", ...DATA.members]
    .map((member) => {
      const label = member === "All" ? "全部" : member;
      return `<button type="button" data-member="${member}" aria-pressed="${member === state.selectedMember}">${label}</button>`;
    })
    .join("");

  renderRangeControls();

  els.sourceFiles.innerHTML = DATA.sourceFiles
    .map(
      (source) => `
        <div class="source-file">
          <span>${escapeHtml(source.member)}</span>
          <strong>${source.rows}</strong>
        </div>
      `
    )
    .join("");
  if (DATA.appMappingSource) {
    els.sourceFiles.innerHTML += `
      <div class="source-file">
        <span>APP mapping</span>
        <strong>${DATA.appMappingSource.mappedCodes}</strong>
      </div>
    `;
  }

  if (DATA.sourceUrl) {
    els.sourceUrl.href = DATA.sourceUrl;
  } else {
    els.sourceUrl.remove();
  }

  renderScopeLine();

  els.assumptionList.innerHTML = DATA.assumptions
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  els.overrideDate.min = CALENDAR_DATE_RANGE.start;
  els.overrideDate.max = CALENDAR_DATE_RANGE.end;
  els.overrideDate.value = els.overrideDate.min;
}

function attachEvents() {
  els.memberFilter.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-member]");
    if (!button) return;
    state.selectedMember = button.dataset.member;
    [...els.memberFilter.querySelectorAll("button")].forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    render();
  });

  els.rangeMode.addEventListener("change", (event) => {
    state.rangeMode = event.target.value;
    updateRangeControlVisibility();
    render();
  });

  els.singleMonth.addEventListener("change", (event) => {
    state.selectedMonth = event.target.value;
    render();
  });

  els.multiMonthList.addEventListener("change", (event) => {
    if (!event.target.matches("input[type='checkbox']")) return;
    if (event.target.checked) {
      state.selectedMonths.add(event.target.value);
    } else {
      state.selectedMonths.delete(event.target.value);
    }
    render();
  });

  [els.rangeStart, els.rangeEnd].forEach((input) => {
    input.addEventListener("change", () => {
      state.rangeStart = els.rangeStart.value || DATA_DATE_RANGE.start;
      state.rangeEnd = els.rangeEnd.value || DATA_DATE_RANGE.end;
      if (state.rangeStart > state.rangeEnd) {
        [state.rangeStart, state.rangeEnd] = [state.rangeEnd, state.rangeStart];
        els.rangeStart.value = state.rangeStart;
        els.rangeEnd.value = state.rangeEnd;
      }
      render();
    });
  });

  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderTable();
  });

  els.exportButton.addEventListener("click", exportCsv);
  els.calendarConfigButton.addEventListener("click", openCalendarDialog);
  els.closeCalendarDialog.addEventListener("click", () => els.calendarDialog.close());
  els.calendarOverrideForm.addEventListener("submit", saveCalendarOverride);
  els.resetCalendarConfig.addEventListener("click", () => {
    state.calendarConfig = defaultCalendarConfig();
    saveCalendarConfig();
    render();
  });

  els.rebuildNoteButton.addEventListener("click", () => {
    if (typeof els.assumptionDialog.showModal === "function") {
      els.assumptionDialog.showModal();
    } else {
      alert(DATA.assumptions.join("\n"));
    }
  });

  els.closeDialog.addEventListener("click", () => els.assumptionDialog.close());
}

function openCalendarDialog() {
  renderCalendarConfig();
  if (typeof els.calendarDialog.showModal === "function") {
    els.calendarDialog.showModal();
  }
}

function saveCalendarOverride(event) {
  event.preventDefault();
  const date = els.overrideDate.value;
  if (!date || date < CALENDAR_DATE_RANGE.start || date > CALENDAR_DATE_RANGE.end) {
    alert("请选择导入月份范围内的日期。");
    return;
  }

  const type = els.overrideType.value;
  if (type === "normal") {
    delete state.calendarConfig.overrides[date];
  } else {
    state.calendarConfig.overrides[date] = {
      type,
      name: els.overrideName.value.trim() || (type === "holiday" ? "节假日" : "补班工作日"),
      source: "manual",
    };
  }

  saveCalendarConfig();
  els.overrideName.value = "";
  render();
}

function renderCalendarConfig() {
  const workdays = configuredWorkdays();
  const overrides = state.calendarConfig.overrides;
  const holidays = Object.entries(overrides)
    .filter(([, item]) => item.type === "holiday")
    .sort((a, b) => a[0].localeCompare(b[0]));
  const workdayOverrides = Object.entries(overrides)
    .filter(([, item]) => item.type === "workday")
    .sort((a, b) => a[0].localeCompare(b[0]));

  els.configuredWorkdays.textContent = workdays.length;
  els.configuredStandardHours.textContent = formatHours(workdays.length * DATA.workdayHours);
  els.overrideCount.textContent = Object.keys(overrides).length;
  renderScopeLine();

  els.holidayList.innerHTML = renderOverrideList(holidays, "暂无节假日配置");
  els.workdayList.innerHTML = renderOverrideList(workdayOverrides, "暂无补班日配置");
}

function renderOverrideList(items, emptyText) {
  if (!items.length) return `<div class="empty-state compact-empty">${emptyText}</div>`;
  return items
    .map(([date, item]) => {
      return `
        <div class="override-row">
          <div>
            <strong>${escapeHtml(date)}</strong>
            <span>${escapeHtml(item.name || item.type)}</span>
          </div>
          <button type="button" data-remove-override="${escapeHtml(date)}">移除</button>
        </div>
      `;
    })
    .join("");
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-remove-override]");
  if (!button) return;
  delete state.calendarConfig.overrides[button.dataset.removeOverride];
  saveCalendarConfig();
  render();
});

function renderKpis() {
  const selectedMembers = getSelectedMembers();
  const work = workEvents();
  const distribution = distributionEvents();
  const pto = ptoEvents();
  const standard = standardHoursPerMember() * selectedMembers.length;
  const workHours = sumHours(work);
  const distributionHours = sumHours(distribution);
  const ptoHours = sumHours(pto);
  const creditHours = sumHours(creditEvents());
  const variance = creditHours - standard;
  const coverage = workHours ? distributionHours / workHours : 0;

  const kpis = [
    {
      label: "工作时间",
      value: formatHours(workHours),
      delta: "Project / CR / Mgmt / Sup / Other",
    },
    {
      label: "四类分布覆盖",
      value: formatHours(distributionHours),
      delta: `${formatPercent(coverage)} 已归入 Project/CR/Mgmt/Sup`,
    },
    {
      label: "PTO",
      value: formatHours(ptoHours),
      delta: `${pto.length} 条个人休假记录`,
    },
    {
      label: "标准工时",
      value: formatHours(standard),
      delta: `${selectedMembers.length} 人 × ${configuredWorkdays().length} 工作日 × ${DATA.workdayHours}h`,
    },
    {
      label: "校验差异",
      value: formatSignedHours(variance),
      delta: "工作 + PTO - 标准工时",
    },
  ];

  els.kpis.innerHTML = kpis
    .map(
      (kpi) => `
        <div class="kpi">
          <div class="label">${escapeHtml(kpi.label)}</div>
          <div class="value">${escapeHtml(kpi.value)}</div>
          <div class="delta">${escapeHtml(kpi.delta)}</div>
        </div>
      `
    )
    .join("");
}

function renderNotice() {
  const scoped = DATA.events.filter(isInMemberScope).filter((event) => dateInSelectedRange(event.date));
  const canceled = scoped.filter((event) => event.canceled).length;
  const allDay = scoped.filter((event) => event.allDay).length;
  const reminders = scoped.filter((event) => event.isReminder).length;
  const otherHours = sumHours(workEvents().filter((event) => event.category === "Other"));
  const configuredHolidays = Object.entries(state.calendarConfig.overrides)
    .filter(([, item]) => item.type === "holiday")
    .filter(([date]) => dateInSelectedRange(date))
    .map(([date]) => date);
  const parts = [];

  if (canceled) parts.push(`${canceled} 条取消会议已隐藏`);
  if (allDay) parts.push(`${allDay} 条全天事件已隐藏`);
  if (reminders) parts.push(`${reminders} 条提醒类事件已隐藏`);
  if (configuredHolidays.length) parts.push(`${configuredHolidays.join(", ")} 已按节假日扣除标准工时`);
  if (otherHours > 0) parts.push(`${formatHours(otherHours)} 工作时间未匹配四类命名前缀`);

  if (!parts.length) {
    els.noticeBar.classList.remove("visible");
    els.noticeBar.textContent = "";
    return;
  }

  els.noticeBar.textContent = parts.join("；") + "。";
  els.noticeBar.classList.add("visible");
}

function totalsByCategory(events, categories = DATA.categories) {
  return categories.map((category) => ({
    category,
    hours: sumHours(events.filter((event) => event.category === category)),
  }));
}

function renderStackSegments(totals, denominator) {
  let left = 0;
  return totals
    .filter((item) => item.hours > 0)
    .map((item) => {
      const width = denominator ? Math.max(1.5, (item.hours / denominator) * 100) : 0;
      const cappedWidth = Math.max(0, Math.min(width, 100 - left));
      const segment = `
        <span class="stack-segment" title="${categoryLabel(item.category)} ${formatHours(item.hours)}"
          style="left:${left}%;width:${cappedWidth}%;background:${categoryColor(item.category)}"></span>
      `;
      left = Math.min(100, left + width);
      return segment;
    })
    .join("");
}

function memberMetrics(member) {
  const memberWork = workEvents().filter((event) => event.member === member);
  const memberPto = ptoEvents().filter((event) => event.member === member);
  const memberHoliday = holidayEvents().filter((event) => event.member === member);
  const standard = standardHoursPerMember();
  const workHours = sumHours(memberWork);
  const ptoHours = sumHours(memberPto);
  const holidayHours = sumHours(memberHoliday);
  const creditHours = workHours + ptoHours;
  const available = standard - ptoHours;
  return {
    standard,
    workHours,
    ptoHours,
    holidayHours,
    creditHours,
    available,
    variance: creditHours - standard,
    utilization: available ? workHours / available : 0,
    categoryTotals: totalsByCategory(
      [...memberWork, ...memberPto, ...memberHoliday],
      ["Project", "CR", "Mgmt", "Sup", "Other", "PTO", "Holiday"]
    ),
  };
}

function renderMemberLoad() {
  const selectedMembers = getSelectedMembers();

  els.memberLoad.innerHTML = selectedMembers
    .map((member) => {
      const metrics = memberMetrics(member);
      return `
        <div class="member-row">
          <div>
            <div class="member-name">${escapeHtml(member)}</div>
            <div class="member-meta">${formatHours(metrics.available)} 可用 · ${formatPercent(metrics.utilization)} 利用率</div>
          </div>
          <div>
            <div class="stacked-bar" aria-label="${escapeHtml(member)} 工时构成">
              ${renderStackSegments(metrics.categoryTotals, Math.max(metrics.standard, metrics.creditHours, 1))}
            </div>
          </div>
          <div class="member-stats">
            <div class="stat-mini"><strong>${formatHours(metrics.workHours)}</strong><span>工作</span></div>
            <div class="stat-mini"><strong>${formatHours(metrics.ptoHours)}</strong><span>PTO</span></div>
            <div class="stat-mini"><strong>${formatSignedHours(metrics.variance)}</strong><span>差异</span></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDailyChart() {
  const members = getSelectedMembers();
  const work = workEvents();
  const days = dailyChartDays();
  const width = 720;
  const height = 260;
  const margin = { top: 16, right: 18, bottom: 34, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const series = members.map((member) => {
    const values = days.map((day) => {
      return sumHours(work.filter((event) => event.member === member && event.date === day));
    });
    return { member, values };
  });
  const maxValue = Math.max(8, ...series.flatMap((item) => item.values));
  const yMax = Math.ceil(maxValue / 2) * 2;
  const xFor = (index) => margin.left + (index / Math.max(1, days.length - 1)) * plotWidth;
  const yFor = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;
  const ticks = [0, yMax / 2, yMax];

  if (!work.length || !days.length) {
    els.dailyChart.innerHTML = `<div class="empty-state">当前筛选下没有工作事件。</div>`;
    return;
  }

  const grid = ticks
    .map((tick) => {
      const y = yFor(tick);
      return `
        <line class="grid-line" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
        <text class="axis-label" x="8" y="${y + 4}">${formatHours(tick)}</text>
      `;
    })
    .join("");

  const paths = series
    .map((item) => {
      const color = MEMBER_COLORS[item.member] || "#65717d";
      const points = item.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
      const circles = item.values
        .map((value, index) => {
          if (value <= 0) return "";
          return `<circle class="point" cx="${xFor(index)}" cy="${yFor(value)}" r="4" fill="${color}"></circle>`;
        })
        .join("");
      return `<polyline class="line-path" points="${points}" stroke="${color}"></polyline>${circles}`;
    })
    .join("");

  const labelStep = Math.max(1, Math.ceil(days.length / 8));
  const labels = days
    .map((day, index) => {
      if (index % labelStep !== 0 && index !== days.length - 1) return "";
      const label = day.slice(5).replace("-", "/");
      return `<text class="axis-label" x="${xFor(index) - 12}" y="${height - 8}">${label}</text>`;
    })
    .join("");

  const legend = series
    .map((item) => {
      const color = MEMBER_COLORS[item.member] || "#65717d";
      return `<span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${escapeHtml(item.member)}</span>`;
    })
    .join("");

  els.dailyChart.innerHTML = `
    <svg class="daily-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="每日工作时间折线图">
      ${grid}
      ${paths}
      ${labels}
    </svg>
    <div class="legend">${legend}</div>
  `;
}

function renderCategoryBars() {
  const totals = totalsByCategory(distributionEvents(), DATA.distributionCategories)
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours);
  const totalHours = sumHours(distributionEvents());
  const max = Math.max(1, ...totals.map((item) => item.hours));

  if (!totals.length) {
    els.categoryBars.innerHTML = `<div class="empty-state">当前筛选下没有四类工作时间。</div>`;
    return;
  }

  els.categoryBars.innerHTML = totals
    .map((item) => {
      const width = Math.max(2, (item.hours / max) * 100);
      const share = totalHours ? item.hours / totalHours : 0;
      return `
        <div class="bar-row">
          <div class="bar-label">${categoryLabel(item.category)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${categoryColor(item.category)}"></div></div>
          <div class="bar-value">${formatHours(item.hours)} · ${formatPercent(share)}</div>
        </div>
      `;
    })
    .join("");
}

function projectRows() {
  const rows = new Map();
  const selectedMembers = getSelectedMembers();
  workEvents()
    .filter((event) => event.category === "Project" || event.category === "CR")
    .forEach((event) => {
      const type = event.category === "Project" ? "Project" : "CR";
      const name = event.category === "Project" ? event.projectName || "Unspecified Project" : event.crSystem || "Unspecified CR";
      const key = `${type}|${name}`;
      if (!rows.has(key)) {
        rows.set(key, {
          type,
          name,
          total: 0,
          members: Object.fromEntries(DATA.members.map((member) => [member, 0])),
        });
      }
      const row = rows.get(key);
      row.total += event.hours;
      row.members[event.member] += event.hours;
    });

  return [...rows.values()]
    .map((row) => ({
      ...row,
      total: Math.round(row.total * 100) / 100,
    }))
    .filter((row) => selectedMembers.some((member) => row.members[member] > 0))
    .sort((a, b) => b.total - a.total)
    .slice(0, 16);
}

function renderProjectSpend() {
  const rows = projectRows();
  const selectedMembers = getSelectedMembers();
  const gridTemplate = `minmax(180px,2fr) 76px repeat(${selectedMembers.length}, minmax(70px,1fr)) 86px`;

  if (!rows.length) {
    els.projectSpend.innerHTML = `<div class="empty-state">当前筛选下没有 Project 或 CR 工作时间。</div>`;
    return;
  }

  const header = `
    <div class="project-row project-header" style="grid-template-columns:${gridTemplate}">
      <div>项目 / 系统</div>
      <div>类型</div>
      ${selectedMembers.map((member) => `<div>${escapeHtml(member)}</div>`).join("")}
      <div>合计</div>
    </div>
  `;

  const body = rows
    .map((row) => {
      return `
        <div class="project-row" style="grid-template-columns:${gridTemplate}">
          <div class="project-name" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</div>
          <div><span class="pill" style="background:${categoryColor(row.type)}">${row.type}</span></div>
          ${selectedMembers.map((member) => `<div>${formatHours(row.members[member] || 0)}</div>`).join("")}
          <div><strong>${formatHours(row.total)}</strong></div>
        </div>
      `;
    })
    .join("");

  els.projectSpend.innerHTML = `${header}${body}`;
}

function weeklyRows() {
  const targets = weekTargets();
  return getSelectedMembers().flatMap((member) => {
    return targets.map((target) => {
      const scoped = scopedEvents()
        .filter((event) => event.member === member)
        .filter((event) => event.weekStart === target.weekStart)
        .filter(isTrackedEvent);
      const work = scoped.filter(isWorkEvent);
      const pto = scoped.filter(isPtoEvent);
      const holiday = scoped.filter(isHolidayEvent);
      const workHours = sumHours(work);
      const ptoHours = sumHours(pto);
      const holidayHours = sumHours(holiday);
      const creditHours = workHours + ptoHours;
      return {
        member,
        ...target,
        workHours,
        ptoHours,
        holidayHours,
        creditHours,
        varianceHours: creditHours - target.targetHours,
        categoryHours: Object.fromEntries(
          totalsByCategory(scoped, ["Project", "CR", "Mgmt", "Sup", "Other", "PTO", "Holiday"])
            .map((item) => [item.category, item.hours])
        ),
      };
    });
  });
}

function renderWeeklyBalance() {
  const rows = weeklyRows();

  if (!rows.length) {
    els.weeklyBalance.innerHTML = `<div class="empty-state">当前日历配置下没有工作周。</div>`;
    return;
  }

  els.weeklyBalance.innerHTML = rows
    .map((row) => {
      const status =
        Math.abs(row.varianceHours) <= 0.25
          ? "balanced"
          : row.varianceHours < 0
            ? "under"
            : "over";
      const totals = ["Project", "CR", "Mgmt", "Sup", "Other", "PTO", "Holiday"].map((category) => ({
        category,
        hours: row.categoryHours[category] || 0,
      }));
      return `
        <div class="weekly-row ${status}">
          <div>
            <strong>${escapeHtml(row.member)}</strong>
            <span>${escapeHtml(row.weekStart.slice(5))} - ${escapeHtml(row.weekEnd.slice(5))}</span>
          </div>
          <div class="stacked-bar compact">
            ${renderStackSegments(totals, Math.max(row.targetHours, row.creditHours, 1))}
          </div>
          <div class="weekly-numbers">
            <strong>${formatHours(row.creditHours)} / ${formatHours(row.targetHours)}</strong>
            <span>${formatSignedHours(row.varianceHours)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderExceptions() {
  const exceptions = workEvents()
    .filter((event) => event.category === "Other")
    .sort((a, b) => b.hours - a.hours || a.start.localeCompare(b.start))
    .slice(0, 12);

  if (!exceptions.length) {
    els.exceptionList.innerHTML = `<div class="empty-state">当前筛选下没有 Other 工作事件。</div>`;
    return;
  }

  els.exceptionList.innerHTML = exceptions
    .map(
      (event) => `
        <div class="exception-row">
          <div>
            <strong>${escapeHtml(event.subject)}</strong>
            <span>${escapeHtml(event.member)} · ${escapeHtml(event.date)} · prefix: ${escapeHtml(event.prefix || "N/A")}</span>
          </div>
          <b>${formatHours(event.hours)}</b>
        </div>
      `
    )
    .join("");
}

function renderTable() {
  const events = visibleEvents();
  const limit = 220;
  const rows = events.slice(0, limit);

  if (!rows.length) {
    els.eventTable.innerHTML = `
      <tr><td colspan="8"><div class="empty-state">当前筛选下没有明细事件。</div></td></tr>
    `;
    els.tableFooter.textContent = "0 条事件";
    return;
  }

  els.eventTable.innerHTML = rows
    .map((event) => {
      const flags = [
        event.showTimeAs,
        event.prefix ? `Prefix ${event.prefix}` : "",
        event.canceled ? "Canceled" : "",
        event.allDay ? "All day" : "",
        event.isReminder ? "Reminder" : "",
      ].filter(Boolean);
      const itemName = event.category === "Project" ? event.projectName : event.category === "CR" ? event.crSystem : event.workItemName;
      return `
        <tr>
          <td>${escapeHtml(event.date)}</td>
          <td><strong>${escapeHtml(event.member)}</strong></td>
          <td>${escapeHtml(event.startTime)} - ${escapeHtml(event.endTime)}</td>
          <td class="hours">${formatHours(event.hours)}</td>
          <td><span class="pill" style="background:${categoryColor(event.category)}">${categoryLabel(event.category)}</span></td>
          <td>${escapeHtml(itemName || "-")}</td>
          <td class="subject-cell">${escapeHtml(event.subject)}</td>
          <td class="status-muted">${escapeHtml(flags.join(" · "))}</td>
        </tr>
      `;
    })
    .join("");

  const hidden = events.length > limit ? `，仅显示前 ${limit} 条` : "";
  els.tableFooter.textContent = `${events.length.toLocaleString("zh-CN")} 条事件${hidden}`;
}

function exportCsv() {
  const rows = visibleEvents();
  const headers = [
    "date",
    "member",
    "startTime",
    "endTime",
    "hours",
    "category",
    "prefix",
    "projectName",
    "crCode",
    "appName",
    "crSystem",
    "workItemName",
    "subject",
    "showTimeAs",
    "sourceFile",
  ];
  const csvRows = [
    headers.join(","),
    ...rows.map((event) =>
      headers
        .map((key) => `"${String(event[key] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  const blob = new Blob(["\ufeff" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const range = selectedRangeBounds();
  const suffix = range.start && range.end ? `${range.start}_${range.end}` : "selected-range";
  link.href = url;
  link.download = `timesheet-dashboard-${suffix}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function render() {
  renderKpis();
  renderNotice();
  renderMemberLoad();
  renderDailyChart();
  renderCategoryBars();
  renderProjectSpend();
  renderWeeklyBalance();
  renderExceptions();
  renderTable();
  renderCalendarConfig();
}

initControls();
attachEvents();
render();
