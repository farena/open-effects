# Next Steps

This document collects upcoming ideas and tasks for project development. Each proposed task is discussed in detail with the user, considering opportunities to merge related items into a single actionable task to optimize planning and execution. Prioritization, consolidation, and task breakdown are performed collaboratively before advancing with the work plan.

When a task graduates to an active plan, it gets a checkbox tick and a link to the plan that owns it.

## Tasks

[x] Audio track cut (with start and end time) and split into another track. Using same audio asset → [`11-audio-overhaul.md`](./11-audio-overhaul.md)
[x] Allow multiple audio track layers, all together grouped as AUDIO group (similar behavior than scene => layer) → [`11-audio-overhaul.md`](./11-audio-overhaul.md)
[x] Treat audio track same as layer, remove icon should be in the same spot, keyframes should be the same design, list of available props to be keyed + add keyframe button => list of keyframes added with options depending on type → [`11-audio-overhaul.md`](./11-audio-overhaul.md)
[x] Sidebar tabs vertical menu with icons + tooltip → [`12-ui-layout-polish.md`](./12-ui-layout-polish.md)
[x] Vertical adjustable border for top side in timeline, allow the user make the timeline bigger (max 45% viewport min 250px) → [`12-ui-layout-polish.md`](./12-ui-layout-polish.md)
[x] Topbar add button to go back to projects → [`12-ui-layout-polish.md`](./12-ui-layout-polish.md)
[x] API Documentation to allow agent to create videos → [`13-api-docs.md`](./13-api-docs.md) — scope: documenting existing endpoints (no new agent endpoint)

## Plan summary

| Plan | Tasks | Estimate |
|---|---|---|
| `11-audio-overhaul.md` | Audio cut+split, multi-track AUDIO group, layer-parity UI | ~2 weeks |
| `12-ui-layout-polish.md` | Vertical sidebar, resizable timeline, back-to-projects button | 3–4 days |
| `13-api-docs.md` | OpenAPI 3.1 spec + programmatic guide + worked example | 3–5 days |

Recommended execution order: 12 → 11 → 13 (lightest-to-heaviest, lets the audio overhaul land on a polished UI surface). Plans are independent — order can change without breaking dependencies.
