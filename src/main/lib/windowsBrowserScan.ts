import { nativeImage } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { DetectedBrowser } from "../../types";

function execFileAsync(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { windowsHide: true, maxBuffer: 1024 * 1024 * 4 },
      (err, stdout, stderr) => {
        if (err) {
          reject(Object.assign(err, { stdout, stderr }));
          return;
        }
        resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      },
    );
  });
}

function parseRegQueryValues(output: string): string[] {
  // `reg query` output can be localized; we use a loose heuristic:
  // - ignore blank lines
  // - return the last column(s) after REG_* token
  const lines = output.split(/\r?\n/).map((l) => l.trimEnd());
  const values: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Example: (Default)    REG_SZ    "C:\\...\\chrome.exe" -- "%1"
    const m = trimmed.match(/\sREG_\w+\s+/);
    if (!m) continue;
    const idx = trimmed.indexOf(m[0]);
    const rest = trimmed.slice(idx + m[0].length).trim();
    if (rest) values.push(rest);
  }

  return values;
}

function stripQuotes(s: string) {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2)
    return t.slice(1, -1);
  return t;
}

function parseCommandToExe(command: string): {
  exePath?: string;
  args?: string;
} {
  const c = command.trim();
  if (!c) return {};

  if (c.startsWith('"')) {
    const end = c.indexOf('"', 1);
    if (end > 1) {
      const exePath = c.slice(1, end);
      const args = c.slice(end + 1).trim();
      return { exePath, args };
    }
  }

  const first = c.split(/\s+/)[0];
  return { exePath: first, args: c.slice(first.length).trim() };
}

function iconDataUrlFromPath(
  iconPathMaybeWithIndex: string | undefined,
): string | undefined {
  if (!iconPathMaybeWithIndex) return undefined;
  const p = stripQuotes(iconPathMaybeWithIndex.split(",")[0]);
  if (!p) return undefined;

  try {
    const img = nativeImage.createFromPath(p);
    if (!img || img.isEmpty()) return undefined;
    return img.resize({ width: 32, height: 32 }).toDataURL() || undefined;
  } catch {
    return undefined;
  }
}

async function getSubkeys(root: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("reg", ["query", root]);
    const lines = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    // Keys are full paths; subkeys start with root + '\\'
    return lines.filter((l) =>
      l.toLowerCase().startsWith(root.toLowerCase() + "\\"),
    );
  } catch {
    return [];
  }
}

async function regGetDefaultValue(key: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("reg", ["query", key, "/ve"]);
    const vals = parseRegQueryValues(stdout);
    return vals[0];
  } catch {
    return undefined;
  }
}

export async function scanInstalledBrowsersWindows(): Promise<
  DetectedBrowser[]
> {
  const roots = [
    "HKCU\\Software\\Clients\\StartMenuInternet",
    "HKLM\\Software\\Clients\\StartMenuInternet",
    "HKLM\\Software\\WOW6432Node\\Clients\\StartMenuInternet",
  ];

  const subkeys = (await Promise.all(roots.map(getSubkeys))).flat();
  const uniqueKeys = Array.from(new Set(subkeys));

  const results: DetectedBrowser[] = [];

  for (const key of uniqueKeys) {
    const id = key.split("\\").pop() || key;

    const displayName = (await regGetDefaultValue(key)) || id;
    const command =
      (await regGetDefaultValue(`${key}\\shell\\open\\command`)) || "";
    const defaultIcon = await regGetDefaultValue(`${key}\\DefaultIcon`);

    const { exePath } = parseCommandToExe(command);
    const iconDataUrl =
      iconDataUrlFromPath(defaultIcon) ||
      (exePath ? iconDataUrlFromPath(exePath) : undefined);

    if (!command) continue;

    results.push({
      id,
      name: displayName,
      command,
      exePath,
      iconDataUrl,
    });
  }

  // Sort stable by name
  results.sort((a, b) => a.name.localeCompare(b.name));

  // Fallback if registry keys are missing/unreadable
  if (results.length === 0) {
    const candidates: Array<{ name: string; exe: string }> = [
      {
        name: "Google Chrome",
        exe: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      },
      {
        name: "Google Chrome",
        exe: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      },
      {
        name: "Microsoft Edge",
        exe: "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      },
      {
        name: "Microsoft Edge",
        exe: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      },
      {
        name: "Mozilla Firefox",
        exe: "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      },
      {
        name: "Mozilla Firefox",
        exe: "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe",
      },
    ];

    const uniq = new Map<string, DetectedBrowser>();
    for (const c of candidates) {
      try {
        if (!fs.existsSync(c.exe)) continue;
        const id = path.basename(c.exe).toLowerCase();
        uniq.set(id, {
          id,
          name: c.name,
          command: `"${c.exe}" -- "%1"`,
          exePath: c.exe,
          iconDataUrl: iconDataUrlFromPath(c.exe),
        });
      } catch {
        // ignore
      }
    }
    return Array.from(uniq.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  return results;
}

export function buildBrowserCommandForUrl(args: {
  command: string;
  url: string;
  privateMode?: boolean;
  newWindow?: boolean;
}): string {
  const raw = String(args.command ?? "").trim();
  const url = String(args.url ?? "").trim();
  if (!raw || !url) return raw;

  // Replace common placeholders
  let cmd = raw;
  cmd = cmd.replace(/%1/g, url);
  cmd = cmd.replace(/\$\{url\}/g, url);

  const { exePath } = parseCommandToExe(raw);
  const exeName = exePath ? path.basename(exePath).toLowerCase() : "";

  const isFirefox =
    exeName === "firefox.exe" || raw.toLowerCase().includes("firefox.exe");
  const isEdge =
    exeName === "msedge.exe" ||
    raw.toLowerCase().includes("msedge.exe") ||
    raw.toLowerCase().includes("microsoftedge");
  const isChromiumFamily =
    isEdge ||
    exeName === "chrome.exe" ||
    exeName === "brave.exe" ||
    exeName === "brave-browser.exe" ||
    exeName === "chromium.exe" ||
    exeName === "vivaldi.exe" ||
    exeName === "opera.exe" ||
    raw.toLowerCase().includes("googlechrome") ||
    raw.toLowerCase().includes("brave") ||
    raw.toLowerCase().includes("chromium");

  const insertAfterExe = (cmd: string, toInsert: string) => {
    const trimmed = cmd.trim();
    if (!toInsert.trim()) return cmd;

    // If command starts with quoted exe path, insert after the closing quote.
    if (trimmed.startsWith('"')) {
      const end = trimmed.indexOf('"', 1);
      if (end > 1) {
        return (
          trimmed.slice(0, end + 1) + ` ${toInsert}` + trimmed.slice(end + 1)
        );
      }
    }

    // Otherwise, insert after the first token.
    const first = trimmed.split(/\s+/)[0];
    return first + ` ${toInsert} ` + trimmed.slice(first.length).trim();
  };

  // If no placeholder exists, append URL.
  if (cmd === raw) {
    cmd = `${raw} "${url.replace(/"/g, '\\"')}"`;
  }

  // Best-effort private/new-window flags based on detected exe.
  const lower = cmd.toLowerCase();

  if (args.privateMode) {
    if (isChromiumFamily) {
      if (isEdge) {
        if (!lower.includes("-inprivate"))
          cmd = insertAfterExe(cmd, "-inprivate");
      } else {
        if (!lower.includes("--incognito"))
          cmd = insertAfterExe(cmd, "--incognito");
      }
    } else if (isFirefox) {
      if (!lower.includes("-private-window"))
        cmd = insertAfterExe(cmd, "-private-window");
    }
  }

  if (args.newWindow) {
    if (isChromiumFamily) {
      if (!lower.includes("--new-window"))
        cmd = insertAfterExe(cmd, "--new-window");
    } else if (isFirefox) {
      if (!lower.includes("-new-window"))
        cmd = insertAfterExe(cmd, "-new-window");
    }
  }

  // Normalize: if command starts with an exe path, keep it as-is.
  // (We run via cmd.exe /c, so no extra quoting here.)
  return cmd;
}

export function browserNameFromExe(exePath?: string): string | undefined {
  if (!exePath) return undefined;
  const base = path.basename(exePath).toLowerCase();
  if (base.includes("chrome")) return "chrome";
  if (base.includes("msedge")) return "edge";
  if (base.includes("firefox")) return "firefox";
  return undefined;
}
