import { tags as t } from "@lezer/highlight";
import { EditorView, Decoration, ViewPlugin, DecorationSet, ViewUpdate } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";

const myHighlightStyle = HighlightStyle.define([
  { tag: t.propertyName, color: "#7dd3fc", fontWeight: "500" },
  { tag: t.string, color: "#ffb86c" },
  { tag: t.number, color: "#98c379" },
  { tag: t.bool, color: "#ffb86c" },
  { tag: t.null, color: "#71717a", fontStyle: "italic" },
  { tag: t.punctuation, color: "#ffffff" },
  { tag: t.separator, color: "#ffffff" },
  { tag: t.operator, color: "#ffffff" },
  { tag: t.bracket, color: "#ffffff" },
  { tag: t.keyword, color: "#ff79c6" },
  { tag: t.variableName, color: "#ffffff" },
  { tag: t.comment, color: "hsl(var(--muted-foreground) / 0.65)", fontStyle: "italic" },
]);

const myThemeExtension = EditorView.theme({
  "&": {
    backgroundColor: "hsl(var(--input)) !important",
    color: "hsl(var(--foreground)) !important",
  },
  ".cm-scroller, .cm-content, .cm-line": {
    fontFamily: "'IBM Plex Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace !important",
  },
  ".cm-gutters": {
    backgroundColor: "transparent !important",
    color: "hsl(var(--muted-foreground) / 0.5) !important",
    borderRight: "1px solid hsl(var(--border) / 0.4) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.02) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(255, 255, 255, 0.02) !important",
    color: "hsl(var(--foreground)) !important",
  },
  ".cm-cursor": {
    borderLeft: "2px solid hsl(var(--primary)) !important",
  },
  ".cm-selectionBackground": {
    background: "rgba(75, 144, 226, 0.25) !important",
  },
  ".cm-comment-override, .cm-comment-override *": {
    color: "hsl(var(--muted-foreground) / 0.6) !important",
    fontStyle: "italic !important",
    textDecoration: "none !important",
  },
});

const indentGuidePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.compute(view);
    }

    update(update: any) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.compute(update.view);
      }
    }

    compute(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const indentUnit = 2; // Default JSON indent unit
      const state = view.state;
      const selection = state.selection.main;
      
      // Compute cursor info
      let cursorIndent = 0;
      let cursorLineNumber = 1;
      try {
        const cursorLine = state.doc.lineAt(selection.head);
        cursorLineNumber = cursorLine.number;
        cursorIndent = cursorLine.text.match(/^ */)?.[0].length || 0;
      } catch {
        // ignore if selection or head is out of bounds during updates
      }

      // Compute active boundaries for each indent level up to cursorIndent
      const activeBounds: Record<number, { up: number; down: number }> = {};
      const maxLevel = cursorIndent;
      
      for (let lvl = indentUnit; lvl <= maxLevel; lvl += indentUnit) {
        let up = cursorLineNumber;
        while (up > 1) {
          const l = state.doc.line(up - 1);
          const indent = l.text.match(/^ */)?.[0].length || 0;
          if (l.text.trim().length === 0) {
            up--;
            continue;
          }
          if (indent < lvl) break;
          up--;
        }
        
        let down = cursorLineNumber;
        const totalLines = state.doc.lines;
        while (down < totalLines) {
          const l = state.doc.line(down + 1);
          const indent = l.text.match(/^ */)?.[0].length || 0;
          if (l.text.trim().length === 0) {
            down++;
            continue;
          }
          if (indent < lvl) break;
          down++;
        }
        
        activeBounds[lvl] = { up, down };
      }

      const normalGuide = Decoration.mark({ class: "cm-indent-guide" });
      const activeGuide = Decoration.mark({ class: "cm-indent-guide-active" });

      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos < to) {
          const line = state.doc.lineAt(pos);
          const text = line.text;
          const leadingSpaces = text.match(/^ */)?.[0].length || 0;
          
          for (let i = indentUnit; i < leadingSpaces; i += indentUnit) {
            const bounds = activeBounds[i];
            const isActive = bounds && line.number >= bounds.up && line.number <= bounds.down;
            const dec = isActive ? activeGuide : normalGuide;
            
            // Add decoration at the exact position of the indent guide space character
            builder.add(line.from + i, line.from + i + 1, dec);
          }
          pos = line.to + 1;
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const commentDecoration = Decoration.mark({
  class: "cm-comment-override"
});

export const jsonCommentsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.compute(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.compute(update.view);
      }
    }

    compute(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const state = view.state;

      for (const { from, to } of view.visibleRanges) {
        const text = state.doc.sliceString(from, to);
        const regex = /("([^"\\]|\\.)*")|(\/\/.*|\/\*[\s\S]*?\*\/)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          if (!match[1]) {
            builder.add(from + match.index, from + match.index + match[0].length, commentDecoration);
          }
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const transparentThemeExtension = EditorView.theme({
  "&": {
    backgroundColor: "transparent !important",
    color: "hsl(var(--foreground)) !important",
  },
  ".cm-scroller, .cm-content, .cm-line": {
    fontFamily: "'IBM Plex Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace !important",
    backgroundColor: "transparent !important",
  },
  ".cm-gutters": {
    backgroundColor: "transparent !important",
    color: "hsl(var(--muted-foreground) / 0.5) !important",
    borderRight: "1px solid hsl(var(--border) / 0.3) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.02) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(255, 255, 255, 0.02) !important",
    color: "hsl(var(--foreground)) !important",
  },
  ".cm-cursor": {
    borderLeft: "2px solid hsl(var(--primary)) !important",
  },
  ".cm-selectionBackground": {
    background: "rgba(75, 144, 226, 0.25) !important",
  },
  ".cm-comment-override, .cm-comment-override *": {
    color: "hsl(var(--muted-foreground) / 0.6) !important",
    fontStyle: "italic !important",
    textDecoration: "none !important",
  },
});

export const postmanTheme = [
  myThemeExtension,
  syntaxHighlighting(myHighlightStyle),
  indentGuidePlugin,
];

export const postmanTransparentTheme = [
  transparentThemeExtension,
  syntaxHighlighting(myHighlightStyle),
  indentGuidePlugin,
];

