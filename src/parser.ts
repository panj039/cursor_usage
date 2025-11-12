export interface UsageRecord {
  date: Date;
  kind: string;
  model: string;
  maxMode: string;
  inputWithCache: number;
  inputNoCache: number;
  cacheRead: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

type RawRow = Record<string, string>;

export async function readUsageFile(file: File): Promise<UsageRecord[]> {
  const text = await file.text();
  return parseUsageCsv(text);
}

export function parseUsageCsv(text: string): UsageRecord[] {
  const rows = parseCsv(text);
  if (!rows.length) {
    return [];
  }

  const header = rows[0].map((cell) => cell.trim());
  const records: UsageRecord[] = [];

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
      cost: toNumber(raw["Cost"]),
    });
  }

  return records.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function sanitize(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/^"+|"+$/g, "");
}

function toNumber(value: string | undefined): number {
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

function mapRow(header: string[], row: string[]): RawRow {
  const mapped: RawRow = {};
  for (let i = 0; i < header.length; i += 1) {
    const key = header[i] ?? `${i}`;
    mapped[key] = row[i] ?? "";
  }
  return mapped;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
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

