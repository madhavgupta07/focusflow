# FocusFlow

A small, self-contained Pomodoro **focus timer with a built-in task list**. Open it
and you get a working app: pick a task, start a focus round, take breaks on schedule,
and watch your completed sessions stack up — no build step, no accounts, no server.

Built as a mini app for **Global Hack Week: Hacktoberfest — CHALLENGE 1: Build a Mini App with Cursor**.

## What it does

- **Pomodoro timer** with Focus / Short break / Long break modes and a circular
  progress dial that drains as the round runs down.
- **Automatic cycles** — after every 4 focus rounds you get a long break instead
  of a short one.
- **Task list** stored in `localStorage`, so tasks (and your timer setup) survive a
  reload. Add, complete, delete, or mark a task as the one you're focusing on.
- **Optional auto-start** — flip one toggle and focus → break → focus runs hands-free.
- **Tunable durations** — focus, short break, long break, and rounds-to-long-break.
- **Dark / light theme** that remembers your choice.
- A short chime and a live tab title (`24:58 · Focus`) so the timer is useful even
  when the tab is in the background.

## Run it

No tooling required:

```bash
# Option 1: just open the file
start index.html        # macOS: open index.html

# Option 2: serve it locally
python -m http.server 5173
# then visit http://localhost:5173
```

## Stack

- HTML, CSS, and vanilla JavaScript (ES2020)
- Web Audio API for the completion chime
- `localStorage` for persistence
- Zero dependencies, zero build step

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup and layout |
| `styles.css` | Theming (CSS variables) and responsive layout |
| `app.js` | Timer engine, task store, settings, and persistence |

## License

MIT — see [LICENSE](LICENSE).
