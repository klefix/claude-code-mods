# claude-code-mods

A few [Claude Code mods](https://code.claude.com/docs/en/plugins/mods/overview). A mod is a plugin with a JavaScript hooks module that Claude Code runs on events such as tool calls, prompts and rendering. The mods need Claude Code v2.1.287 or later.

## The mods

| Mod | What it does |
|---|---|
| `git-status` | Runs `git status --porcelain` at session start, after each prompt, after file-changing tool calls and when the working directory changes. It keeps the changed, staged and unstaged file counts in session state. |
| `tool-calls` | Counts how often each tool and each skill was used in the session. `/clear` resets the counts. |
| `sidebar` | A pane that shows the `git-status` counts above the `tool-calls` counts. It opens at session start in terminals at least 144 columns wide. `/sidebar` opens it at any width. It needs `git-status` and `tool-calls` to be loaded. |
| `jev-guard` | Asks Jev, a classifier model on the Vercel AI Gateway, two kinds of questions. See below. |

### jev-guard

On each prompt you type, jev-guard asks Jev whether the request leaves a choice open, such as which fix or what scope. If it does, and the prompt is not a question, a dialog asks you to clarify, send the prompt as written, or cancel it.

Before each `Edit`, `Write`, `MultiEdit`, `NotebookEdit` and `Bash` call, jev-guard asks Jev whether the call stays within what you approved and whether it removes behavior you did not ask to remove. It denies the call if the in-scope rating is below 0.5 or the removes-behavior rating is 0.7 or more. Claude then sees the reason and is told to ask you. A `Bash` command that Jev rates as read-only is allowed without those checks. The thresholds are at the top of `jev-guard/hooks/judge.js`.

Things to know before you enable jev-guard:

- It sends your prompt, recent assistant text and the tool call input to `https://ai-gateway.vercel.sh`. For a `Write` call it also sends the current content of the file being overwritten.
- It fails closed. If Jev cannot be reached or takes longer than 5 seconds, it drops the prompt or denies the tool call. Each block is reported in the transcript.
- It writes the last request it sent to `jev-guard/.debug/last-request.json`. That folder is git-ignored.

It needs a Vercel AI Gateway API key. Run `jev-guard/set-key.sh`, which saves the key to `~/.config/jev-guard/key` with permissions 600.

## Setup

Clone the repo:

```sh
git clone https://github.com/klefix/claude-code-mods.git ~/claude-code-mods
```

To load mods in every session, add their directories to `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`. The value is a list of absolute paths separated by `:`. Use the path you cloned to:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/Users/you/claude-code-mods/git-status:/Users/you/claude-code-mods/tool-calls:/Users/you/claude-code-mods/sidebar"
  }
}
```

Add `/Users/you/claude-code-mods/jev-guard` to the list if you want jev-guard, after you have set the key.

To try one mod for a single session, run `claude --plugin-dir ./sidebar` from the repo. Claude Code reloads the mod when you save a file.

To check that a mod is loaded, open `/plugin` and look at the Installed tab.

## Development

```sh
npm install
npm run lint        # Biome lint and format check
npm run lint:fix    # apply the fixes
claude plugin validate ./jev-guard
claude plugin test jev-guard
```

Claude Code generates `.claude-plugin/types/` and `tsconfig.json` in each mod directory when it loads the mod. Both are git-ignored.
