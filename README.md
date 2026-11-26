# How to use this folder

1. Put this whole folder in Google Antigravity as the workspace (one project = one folder).
2. Set mode to **Planning** (not Fast). Set Auto Execution / Review Policy to require approval.
3. Paste this single prompt:

> Read SPEC.md, AGENTS.md and SAFETY.md in this folder. Build Phase 1 only (local prototype). Give me an implementation plan first and wait for my approval before writing code. Test the core flows in the browser when done.

4. When Phase 1 works, commit to Git, then add ONE file from `phases/` at a time with this prompt:

> Read phases/<filename>. Build only this feature on top of the existing app. Give me a plan first and wait for approval.

Note: commands like /swarm, /automation and Remote Agents came from a generated summary. Check they exist in your Antigravity version before relying on them.
