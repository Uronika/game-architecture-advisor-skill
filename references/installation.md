# Codex and Claude Code Installation

The folder is the canonical source. Both agents recognize a skill folder containing `SKILL.md`, so copy or symlink this whole directory rather than duplicating its instructions.

## Codex

Place `game-architecture-advisor/` under your Codex skills directory (commonly `%USERPROFILE%\\.codex\\skills\\`). Restart or refresh Codex so it discovers the skill.

## Claude Code

For a repository-scoped installation, place or symlink the folder at `.claude/skills/game-architecture-advisor/`. For a user-wide installation, use Claude Code's configured user skills directory. Keep `knowledge/` beside `SKILL.md` in either installation so local-first lookup works identically.

After installing, invoke `$game-architecture-advisor` with a concrete design question. It should produce a decision record and ask for approval before it proposes any code change.
