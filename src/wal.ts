import fs from "fs";
import path from "path";
import { MemoryRecord } from "./types";

export type WalOperation = "add" | "delete";

export interface WalEntry {
  op: WalOperation;
  memory?: MemoryRecord;
  id?: string;
  ts: number;
}

export class WriteAheadLog {
  private walPath: string;

  constructor(walPath: string) {
    this.walPath = walPath;
    this.ensureDir();
  }

  get path(): string {
    return this.walPath;
  }

  appendAdd(memory: MemoryRecord): void {
    const entry: WalEntry = { op: "add", memory, ts: Date.now() };
    this.append(entry);
  }

  appendDelete(id: string): void {
    const entry: WalEntry = { op: "delete", id, ts: Date.now() };
    this.append(entry);
  }

  readAll(): WalEntry[] {
    if (!fs.existsSync(this.walPath)) return [];
    const content = fs.readFileSync(this.walPath, "utf8");
    if (!content.trim()) return [];
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as WalEntry);
  }

  clear(): void {
    fs.writeFileSync(this.walPath, "", "utf8");
  }

  private append(entry: WalEntry): void {
    fs.appendFileSync(this.walPath, `${JSON.stringify(entry)}\n`, "utf8");
  }

  private ensureDir(): void {
    const dir = path.dirname(this.walPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.walPath)) {
      fs.writeFileSync(this.walPath, "", "utf8");
    }
  }
}
