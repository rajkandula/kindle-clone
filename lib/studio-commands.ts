/**
 * Slash commands for the Studio composer.
 *
 * Each one is a prompt template, not a separate code path — typing `/draw a
 * lighthouse` sends the Studio a plainly-worded instruction. That keeps the
 * menu honest: anything listed here is something the writing agent can already
 * do with the tools it has, so a command can never promise more than the
 * product delivers.
 */
export interface StudioCommand {
  /** What the user types, without the slash. */
  name: string;
  label: string;
  hint: string;
  /** Placeholder shown after the command is picked. */
  argHint: string;
  /** Builds the message actually sent. */
  build: (arg: string) => string;
}

export const STUDIO_COMMANDS: StudioCommand[] = [
  {
    name: "image",
    label: "Add a picture",
    hint: "Talk it through first, then it's drawn",
    argHint: "optional: what you have in mind",
    build: (a) =>
      `I'd like a picture in this book${a ? `. What I have in mind: ${a}` : ""}.

Don't generate anything yet. You know this book — use that. Tell me:
· which chapter and which exact moment you'd illustrate, and why that one
· what the picture would show — subject, setting, time of day, mood
· how it should look so it suits this book

Then wait. I'll say yes, or tell you what to change.`,
  },
  {
    name: "cover",
    label: "Design the cover",
    hint: "Propose it, agree it, then paint it",
    argHint: "optional: what you want it to feel like",
    build: (a) =>
      `I'd like proper cover artwork for this book${a ? `. What I'm after: ${a}` : ""}.

Don't generate anything yet. Based on what this book actually is, describe the
cover you'd design: the single central image, the mood, the colour palette, and
why it fits the story. Mention anything about the title or blurb that shaped it.

Then wait for me to agree or push back.`,
  },
  {
    name: "outline",
    label: "Plan the book",
    hint: "Shape the arc before writing",
    argHint: "optional: how many chapters, what arc",
    build: (a) =>
      `Outline the book${a ? `: ${a}` : ""}. Give me the chapter list with a line on each, and don't write the chapters yet.`,
  },
];

/** Commands matching what's been typed after the slash. */
export function matchCommands(query: string): StudioCommand[] {
  const q = query.toLowerCase();
  return STUDIO_COMMANDS.filter(
    (c) => c.name.startsWith(q) || c.label.toLowerCase().includes(q)
  );
}

/**
 * The slash query currently being typed, or null.
 * Only counts when the slash opens the message — mid-sentence slashes (dates,
 * and/or, file paths) must never pop a menu.
 */
export function slashQuery(draft: string): string | null {
  if (!draft.startsWith("/")) return null;
  const rest = draft.slice(1);
  if (rest.includes("\n")) return null;
  const space = rest.indexOf(" ");
  return space === -1 ? rest : null;
}

/**
 * Turn a typed command into the instruction actually sent.
 * Anything that isn't a known command is passed through untouched, so a
 * message that merely happens to start with a slash still sends normally.
 */
export function expandCommand(text: string): string {
  if (!text.startsWith("/")) return text;
  const body = text.slice(1);
  const space = body.indexOf(" ");
  const name = (space === -1 ? body : body.slice(0, space)).toLowerCase();
  const arg = space === -1 ? "" : body.slice(space + 1).trim();
  const cmd = STUDIO_COMMANDS.find((c) => c.name === name);
  return cmd ? cmd.build(arg) : text;
}
