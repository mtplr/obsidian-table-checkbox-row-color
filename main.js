"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  DEFAULT_SETTINGS: () => DEFAULT_SETTINGS,
  ObsidianTableCheckboxRowColorSettingTab: () => ObsidianTableCheckboxRowColorSettingTab,
  default: () => ObsidianTableCheckboxRowColorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/markdown-helpers.ts
function getCheckboxCountsPerCell(line) {
  const cells = line.split("|");
  if (cells.length > 1 && !cells[0].trim()) cells.shift();
  if (cells.length > 1 && !cells[cells.length - 1].trim()) cells.pop();
  return cells.map((cell) => (cell.match(/\[( |x)\]/g) || []).length);
}
function getSourceLineNumber(section, row) {
  if (!section) return null;
  return section.lineStart + row + 2;
}

// src/obsidian-helpers.ts
var import_obsidian = require("obsidian");
async function getSourceLine(plugin, file, idx) {
  try {
    const content = await plugin.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    return idx >= 0 && idx < lines.length ? lines[idx] : null;
  } catch {
    return null;
  }
}

// src/dom-helpers.ts
var CHECKED_ROW_CLASS = "obsidian-table-checkbox-row-color-row-checked";
var CHECKED_CELL_CLASS = "obsidian-table-checkbox-row-color-cell-checked";
function updateRowHighlight(target) {
  if (typeof target?.closest !== "function") return;
  const row = target.closest("tr");
  if (!row || !row.classList) return;
  const hasCheckedCheckbox = Array.from(row.querySelectorAll("input.task-list-item-checkbox")).some((checkbox) => checkbox.checked);
  row.classList.toggle(CHECKED_ROW_CLASS, hasCheckedCheckbox);
  Array.from(row.children).forEach((child) => {
    if (child instanceof HTMLElement && (child.tagName === "TD" || child.tagName === "TH")) {
      child.classList.toggle(CHECKED_CELL_CLASS, hasCheckedCheckbox);
    }
  });
}
async function handleCheckboxChange({ box, plugin, file, lineNum, idx }) {
  const vault = plugin?.app?.vault;
  if (!vault || typeof vault.process !== "function") return;
  await vault.process(file, (data) => {
    const lines = data.split(/\r?\n/);
    if (lineNum >= lines.length) return data;
    const line = lines[lineNum];
    const srcMatches = [...line.matchAll(/\[( |x)\]/g)];
    const mIdx = srcMatches[idx]?.index ?? -1;
    if (mIdx === -1) return data;
    const newState = box.checked ? "[x]" : "[ ]";
    lines[lineNum] = line.substring(0, mIdx) + newState + line.substring(mIdx + 3);
    box.checked = newState === "[x]";
    return lines.join("\n");
  });
  updateRowHighlight(box);
}

// src/render-cell-checkboxes.ts
var TEXT_NODE = 3;
var ELEMENT_NODE = 1;
function renderCellCheckboxes({
  cell,
  cellIdx,
  counts,
  srcLine,
  lineNum,
  file,
  plugin,
  idx
}) {
  let localIdx = 0;
  const processTextNode = (textNode) => {
    const text = textNode.textContent || "";
    const actions = renderCellCheckboxesPure(text);
    if (actions.length === 1 && actions[0].type === "span") {
      return [textNode];
    }
    const fragment = [];
    actions.forEach((action) => {
      if (action.type === "span") {
        fragment.push(document.createTextNode(action.text));
      } else if (action.type === "checkbox") {
        const globalIdx = idx + localIdx;
        const box = document.createElement("input");
        box.type = "checkbox";
        box.className = "task-list-item-checkbox";
        box.checked = action.checked;
        box.addEventListener("change", () => {
          handleCheckboxChange({ box, plugin, file, lineNum, idx: globalIdx });
        });
        fragment.push(box);
        localIdx++;
      }
    });
    return fragment;
  };
  const processNode = (node) => {
    const childNodes = Array.from(node.childNodes);
    for (const child of childNodes) {
      if (child.nodeType === TEXT_NODE) {
        const replacements = processTextNode(child);
        if (replacements.length === 1 && replacements[0] === child) {
          continue;
        }
        const parent = child.parentNode;
        if (parent) {
          replacements.forEach((newNode) => {
            parent.insertBefore(newNode, child);
          });
          parent.removeChild(child);
        }
      } else if (child.nodeType === ELEMENT_NODE) {
        processNode(child);
      }
    }
  };
  processNode(cell);
  return idx + localIdx;
}
function renderCellCheckboxesPure(text) {
  const pattern = /\[( |x)\]/g;
  const matches = [...text.matchAll(pattern)];
  if (!matches.length) return [{ type: "span", text }];
  let last = 0;
  const actions = [];
  matches.forEach((match) => {
    if (match.index > last) {
      actions.push({ type: "span", text: text.slice(last, match.index) });
    }
    actions.push({ type: "checkbox", checked: match[0] === "[x]" });
    last = match.index + match[0].length;
  });
  if (last < text.length) {
    actions.push({ type: "span", text: text.slice(last) });
  }
  return actions;
}

// src/main.ts
var STYLE_ELEMENT_ID = "obsidian-table-checkbox-row-color-style";
var DEFAULT_HIGHLIGHT_COLOR = "#fff4b8";
var DEFAULT_SETTINGS = {
  highlightColor: DEFAULT_HIGHLIGHT_COLOR,
  strikeThroughCheckedRows: false
};
var ObsidianTableCheckboxRowColorPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.styleElement = null;
  }
  async onload() {
    await this.loadSettings();
    this.ensureRowHighlightStyle();
    this.addSettingTab(new ObsidianTableCheckboxRowColorSettingTab(this.app, this));
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      el.querySelectorAll("table").forEach((table) => {
        let dataRowIdx = 0;
        table.querySelectorAll("tr").forEach(async (row) => {
          if (!row.querySelector("td")) return;
          const section = typeof ctx.getSectionInfo === "function" ? ctx.getSectionInfo(el) : null;
          const lineNum = getSourceLineNumber(section, dataRowIdx);
          dataRowIdx++;
          const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
          if (!file || lineNum == null) return;
          const srcLine = await getSourceLine(this, file, lineNum);
          if (!srcLine) return;
          const counts = getCheckboxCountsPerCell(srcLine);
          let idx = 0;
          row.querySelectorAll("td").forEach((cell, cellIdx) => {
            idx = renderCellCheckboxes({
              cell,
              cellIdx,
              counts,
              srcLine,
              lineNum,
              file,
              plugin: this,
              idx
            });
          });
          updateRowHighlight(row);
        });
      });
    });
  }
  onunload() {
    this.styleElement?.remove();
    this.styleElement = null;
  }
  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loadedData,
      highlightColor: normalizeHexColor(loadedData?.highlightColor)
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshRowHighlightStyle();
  }
  ensureRowHighlightStyle() {
    const existingStyle = document.getElementById(STYLE_ELEMENT_ID);
    if (existingStyle?.tagName === "STYLE") {
      this.styleElement = existingStyle;
    } else {
      const styleElement = document.createElement("style");
      styleElement.id = STYLE_ELEMENT_ID;
      document.head.appendChild(styleElement);
      this.styleElement = styleElement;
    }
    this.refreshRowHighlightStyle();
  }
  refreshRowHighlightStyle() {
    if (!this.styleElement) return;
    this.styleElement.textContent = this.getRowHighlightCss();
  }
  getRowHighlightCss() {
    return `
tr.${CHECKED_ROW_CLASS},
tr.${CHECKED_ROW_CLASS} > td,
tr.${CHECKED_ROW_CLASS} > th,
td.${CHECKED_CELL_CLASS},
th.${CHECKED_CELL_CLASS} {
  background-color: color-mix(in srgb, ${this.settings.highlightColor} 18%, transparent) !important;
}

tr.${CHECKED_ROW_CLASS} > td,
tr.${CHECKED_ROW_CLASS} > th {
  transition: background-color 140ms ease, color 140ms ease, text-decoration-color 140ms ease;
  text-decoration: ${this.settings.strikeThroughCheckedRows ? "line-through" : "none"};
  text-decoration-thickness: 1.5px;
}
`;
  }
};
var ObsidianTableCheckboxRowColorSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Row highlight color").setDesc("Choose the color used to tint checked table rows in Reading Mode.").addColorPicker((component) => {
      component.setValue(this.plugin.settings.highlightColor).onChange(async (value) => {
        this.plugin.settings.highlightColor = normalizeHexColor(value);
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Strike through checked rows").setDesc("Apply a strikethrough to the row text when at least one checkbox in that row is checked.").addToggle((component) => {
      component.setValue(this.plugin.settings.strikeThroughCheckedRows).onChange(async (value) => {
        this.plugin.settings.strikeThroughCheckedRows = value;
        await this.plugin.saveSettings();
      });
    });
  }
};
function normalizeHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_HIGHLIGHT_COLOR;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_SETTINGS,
  ObsidianTableCheckboxRowColorSettingTab
});
//# sourceMappingURL=main.js.map
