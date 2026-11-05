const calendarFonts = new Set([
  "Noto Sans TC Variable",
  "Noto Serif TC Variable",
]);
const familyName = (value: string) => value.trim().replace(/["']/g, "");

function usedCharacters(node: HTMLElement) {
  const used = new Map<string, Set<number>>();
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const parent = walker.currentNode.parentElement;
    if (!parent) continue;
    const style = getComputedStyle(parent);
    let text = walker.currentNode.textContent ?? "";
    if (style.textTransform === "uppercase") text = text.toUpperCase();
    if (style.textTransform === "lowercase") text = text.toLowerCase();
    for (const family of style.fontFamily.split(",").map(familyName)) {
      if (!calendarFonts.has(family)) continue;
      const characters = used.get(family) ?? new Set<number>();
      for (const character of text) characters.add(character.codePointAt(0)!);
      used.set(family, characters);
    }
  }
  return used;
}

function coversText(range: string, characters: Set<number>) {
  if (!range) return true;
  const codes = [...characters];
  return range.split(",").some((part) => {
    const match = /^U\+([\dA-F?]+)(?:-([\dA-F]+))?$/i.exec(part.trim());
    if (!match) return true;
    const start = parseInt(match[1].replace(/\?/g, "0"), 16);
    const end = parseInt(match[2] ?? match[1].replace(/\?/g, "F"), 16);
    return codes.some((code) => code >= start && code <= end);
  });
}

function fontRules(rules: CSSRuleList): CSSFontFaceRule[] {
  return [...rules].flatMap((rule) => {
    if (rule.type === CSSRule.FONT_FACE_RULE) return [rule as CSSFontFaceRule];
    if ("cssRules" in rule)
      return fontRules((rule as CSSGroupingRule).cssRules);
    return [];
  });
}

function readDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not read the calendar font."));
    reader.readAsDataURL(blob);
  });
}

// Keep downloads local to this export job and reuse them across its PNG pages.
// Embedding every CJK subset would download both entire font families. Match
// the actual page text instead, including characters only shown in full exports.
export function createExportFontEmbedder() {
  const downloads = new Map<string, Promise<string>>();
  return async (node: HTMLElement): Promise<string> => {
    const used = usedCharacters(node);
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return fontRules(sheet.cssRules);
      } catch {
        // Third-party map stylesheets are not part of the calendar export.
        return [];
      }
    });
    const selected = rules.filter((rule) => {
      const characters = used.get(familyName(rule.style.fontFamily));
      return (
        characters &&
        coversText(rule.style.getPropertyValue("unicode-range"), characters)
      );
    });
    const embedded: string[] = [];
    // Bound concurrent font requests on mobile connections.
    for (let start = 0; start < selected.length; start += 4) {
      embedded.push(
        ...(await Promise.all(
          selected.slice(start, start + 4).map(async (rule) => {
            const source = /url\(["']?([^"')]+)["']?\)/.exec(
              rule.style.getPropertyValue("src"),
            )?.[1];
            if (!source) throw new Error("The calendar font is unavailable.");
            const url = new URL(
              source,
              rule.parentStyleSheet?.href ?? document.baseURI,
            );
            if (url.origin !== window.location.origin)
              throw new Error("Calendar fonts must load from this website.");
            let download = downloads.get(url.href);
            if (!download) {
              download = fetch(url, { credentials: "same-origin" }).then(
                async (response) => {
                  if (
                    !response.ok ||
                    !(response.headers.get("Content-Type") ?? "").includes(
                      "font",
                    )
                  )
                    throw new Error(
                      "The calendar fonts could not load. Reconnect or sign in again, then retry exporting.",
                    );
                  return readDataUrl(await response.blob());
                },
              );
              downloads.set(url.href, download);
            }
            const data = await download;
            return `@font-face { font-family: ${rule.style.fontFamily}; font-style: normal; font-weight: ${rule.style.fontWeight}; unicode-range: ${rule.style.getPropertyValue("unicode-range")}; src: url("${data}") format("woff2"); }`;
          }),
        )),
      );
    }
    return embedded.join("\n");
  };
}
