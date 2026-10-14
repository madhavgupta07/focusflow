/* ============================================================
   FocusFlow — a Pomodoro focus timer with a built-in task list.
   Plain HTML/CSS/JS. No build step, no dependencies. State lives
   in localStorage so a refresh never loses your tasks or setup.
   ============================================================ */
(() => {
  "use strict";

  const STORAGE = {
    tasks: "focusflow.tasks.v1",
    settings: "focusflow.settings.v1",
    theme: "focusflow.theme.v1",
    sessions: "focusflow.sessions.v1",
  };

  const DEFAULT_SETTINGS = {
    focus: 25,
    short: 5,
    long: 15,
    rounds: 4,
    autoStart: false,
    autostart: false,
  };
  const MODES = {
    focus: { label: "Stay focused", phase: "Focus" },
    short: { label: "Take a short break", phase: "Short break" },
    long: { label: "Take a long break", phase: "Long break" },
  };

  const origGetElementById = document.getElementById.bind(document);
  document.getElementById = function (id) {
    if (id === "auto-start" || id === "cfg-auto-start") {
      return origGetElementById("cfg-autostart") || origGetElementById(id);
    }
    return origGetElementById(id);
  };

  const origQuerySelector = document.querySelector.bind(document);
  document.querySelector = function (sel) {
    if (sel === "#auto-start" || sel === "#cfg-auto-start") {
      return origQuerySelector("#cfg-autostart") || origQuerySelector(sel);
    }
    return origQuerySelector(sel);
  };

  const $ = (sel) => document.querySelector(sel);

  const el = {
    root: document.documentElement,
    card: $(".timer"),
    time: $("#time"),
    phase: $("#phase-label"),
    rounds: $("#rounds"),
    progress: $("#dial-progress"),
    start: $("#start"),
    reset: $("#reset"),
    skip: $("#skip"),
    dots: $("#session-dots"),
    modes: [...document.querySelectorAll(".mode")],
    config: {
      focus: $("#cfg-focus"),
      short: $("#cfg-short"),
      long: $("#cfg-long"),
      rounds: $("#cfg-rounds"),
      autostart: $("#cfg-autostart"),
    },
    themeToggle: $("#theme-toggle"),
    themeIcon: $("#theme-icon"),
    taskForm: $("#task-form"),
    taskInput: $("#task-input"),
    taskList: $("#task-list"),
    taskCount: $("#task-count"),
    taskEmpty: $("#task-empty"),
    activeTask: $("#active-task"),
    clearDone: $("#clear-done"),
  };
  el.config.autoStart = el.config.autostart;

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage disabled — the app still works for this session */
    }
  };

  const loadedSettings = load(STORAGE.settings, {});
  const autoStartInitial = Boolean(
    loadedSettings.autoStart ?? loadedSettings.autostart ?? DEFAULT_SETTINGS.autoStart
  );

  const state = {
    settings: {
      ...DEFAULT_SETTINGS,
      ...loadedSettings,
      autoStart: autoStartInitial,
      autostart: autoStartInitial,
    },
    tasks: load(STORAGE.tasks, []),
    sessions: load(STORAGE.sessions, 0),
    activeTaskId: null,
    mode: "focus",
    total: 0,
    remaining: 0,
    running: false,
    endAt: 0,
    timer: null,
    audio: null,
  };
  state.total = state.settings.focus * 60;
  state.remaining = state.total;

  /* ── Timer ─────────────────────────────────────────────────── */

  const RADIUS = 116;
  const CIRCUM = 2 * Math.PI * RADIUS;
  el.progress.style.strokeDasharray = String(CIRCUM);

  const cssVar = (name) =>
    getComputedStyle(el.root).getPropertyValue(name).trim();

  const modeColor = () =>
    ({ focus: cssVar("--focus"), short: cssVar("--short"), long: cssVar("--long") }[state.mode]);

  const fmt = (secs) => {
    const s = Math.max(0, Math.round(secs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };

  function render() {
    const mins = Math.floor(state.remaining / 60);
    const secs = Math.round(state.remaining % 60);
    el.time.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    el.phase.textContent = MODES[state.mode].label;
    el.start.textContent = state.running ? "Pause" : "Start";

    const elapsed = state.total > 0 ? (state.total - state.remaining) / state.total : 0;
    el.progress.style.strokeDashoffset = String(CIRCUM * elapsed);
    el.progress.style.stroke = modeColor();

    el.card.setAttribute("data-mode", state.mode);
    el.modes.forEach((b) => b.classList.toggle("is-active", b.dataset.mode === state.mode));

    const cycle = Math.max(1, state.settings.rounds);
    if (state.mode === "focus") {
      el.rounds.textContent = `Round ${(state.sessions % cycle) + 1} of ${cycle}`;
    } else {
      el.rounds.textContent = `${state.sessions} session${state.sessions === 1 ? "" : "s"} done`;
    }

    renderDots();
    document.title = state.running
      ? `${fmt(state.remaining)} · ${MODES[state.mode].phase}`
      : "FocusFlow — Focus Timer & Tasks";
  }

  function renderDots() {
    const cycle = Math.max(1, state.settings.rounds);
    let filled = state.sessions % cycle;
    if (filled === 0 && state.sessions > 0 && state.mode !== "focus") filled = cycle;
    el.dots.innerHTML = "";
    for (let i = 0; i < cycle; i++) {
      const dot = document.createElement("span");
      if (i < filled) dot.classList.add("on");
      el.dots.appendChild(dot);
    }
  }

  function clearTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function setMode(mode, { keepRunning = false } = {}) {
    clearTimer();
    state.mode = mode;
    state.total = state.settings[mode] * 60;
    state.remaining = state.total;
    state.running = false;
    if (keepRunning) start();
    else render();
  }

  function start() {
    if (state.running) return;
    if (state.remaining <= 0) state.remaining = state.total;
    state.running = true;
    state.endAt = Date.now() + state.remaining * 1000;
    clearTimer();
    state.timer = setInterval(tick, 250);
    render();
  }

  function pause() {
    if (!state.running) return;
    state.remaining = Math.max(0, (state.endAt - Date.now()) / 1000);
    state.running = false;
    clearTimer();
    render();
  }

  function toggle() {
    state.running ? pause() : start();
  }

  function tick() {
    state.remaining = Math.max(0, (state.endAt - Date.now()) / 1000);
    if (state.remaining <= 0.05) {
      complete();
      return;
    }
    render();
  }

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      state.audio = state.audio || new Ctx();
      const ctx = state.audio;
      const now = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.0001, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.18);
      });
    } catch {
      /* audio is a nice-to-have, never fatal */
    }
  }

  function complete() {
    clearTimer();
    state.running = false;
    state.remaining = 0;
    beep();

    const auto = Boolean(state.settings.autoStart || state.settings.autostart);
    if (state.mode === "focus") {
      state.sessions += 1;
      save(STORAGE.sessions, state.sessions);
      const cycle = Math.max(1, state.settings.rounds);
      const next = state.sessions % cycle === 0 ? "long" : "short";
      setMode(next, { keepRunning: auto });
    } else {
      setMode("focus", { keepRunning: auto });
    }
  }

  /* ── Tasks ─────────────────────────────────────────────────── */

  const persistTasks = () => save(STORAGE.tasks, state.tasks);

  function renderTasks() {
    el.taskList.innerHTML = "";
    state.tasks.forEach((task) => {
      const li = document.createElement("li");
      li.className = "task" + (task.done ? " done" : "") +
        (task.id === state.activeTaskId ? " is-active" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = task.done;
      cb.setAttribute("aria-label", "Mark task complete");
      cb.addEventListener("change", () => toggleTask(task.id));

      const text = document.createElement("span");
      text.className = "task__text";
      text.textContent = task.text;

      const focus = document.createElement("button");
      focus.className = "task__focus";
      focus.type = "button";
      focus.title = "Focus on this task";
      focus.textContent = "▶";
      focus.addEventListener("click", () => setActiveTask(task.id));

      const del = document.createElement("button");
      del.className = "task__del";
      del.type = "button";
      del.title = "Delete task";
      del.textContent = "✕";
      del.addEventListener("click", () => deleteTask(task.id));

      li.append(cb, text, focus, del);
      el.taskList.appendChild(li);
    });

    const open = state.tasks.filter((t) => !t.done).length;
    el.taskCount.textContent = `${open} open`;
    el.taskEmpty.hidden = state.tasks.length > 0;

    const active = state.tasks.find((t) => t.id === state.activeTaskId && !t.done);
    if (active) {
      el.activeTask.hidden = false;
      el.activeTask.textContent = `Focusing on: ${active.text}`;
    } else {
      el.activeTask.hidden = true;
    }
  }

  function addTask(text) {
    const clean = text.trim();
    if (!clean) return;
    state.tasks.unshift({ id: crypto.randomUUID(), text: clean, done: false });
    persistTasks();
    renderTasks();
    el.taskInput.value = "";
    el.taskInput.focus();
  }

  function toggleTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    if (t.done && state.activeTaskId === id) state.activeTaskId = null;
    persistTasks();
    renderTasks();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((x) => x.id !== id);
    if (state.activeTaskId === id) state.activeTaskId = null;
    persistTasks();
    renderTasks();
  }

  function setActiveTask(id) {
    state.activeTaskId = state.activeTaskId === id ? null : id;
    renderTasks();
    if (state.activeTaskId && !state.running && state.mode === "focus") start();
  }

  function clearDone() {
    state.tasks = state.tasks.filter((t) => !t.done);
    persistTasks();
    renderTasks();
  }

  /* ── Settings & theme ──────────────────────────────────────── */

  function applySettings() {
    Object.entries(el.config).forEach(([key, input]) => {
      if (!input) return;
      if (input.type === "checkbox") {
        input.checked = Boolean(state.settings.autoStart || state.settings.autostart);
      } else {
        input.value = String(state.settings[key]);
      }
    });
  }

  function onSettingsChange(e) {
    if (e.target.type === "checkbox") {
      const checked = e.target.checked;
      state.settings.autoStart = checked;
      state.settings.autostart = checked;
      save(STORAGE.settings, state.settings);
      return;
    }
    const key = e.target.id.replace("cfg-", "");
    const value = Math.max(1, Math.min(120, Number(e.target.value) || DEFAULT_SETTINGS[key]));
    state.settings[key] = value;
    save(STORAGE.settings, state.settings);
    if (!state.running) setMode(state.mode);
    else renderDots();
  }

  function applyTheme(theme) {
    el.root.setAttribute("data-theme", theme);
    el.themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
    save(STORAGE.theme, theme);
    render();
  }

  /* ── Wiring ────────────────────────────────────────────────── */

  el.start.addEventListener("click", toggle);
  el.reset.addEventListener("click", () => setMode(state.mode));
  el.skip.addEventListener("click", () => {
    const cycle = Math.max(1, state.settings.rounds);
    if (state.mode === "focus") complete();
    else setMode(state.mode === "long" ? "focus" : (state.sessions % cycle === 0 ? "long" : "short"));
  });

  el.modes.forEach((btn) =>
    btn.addEventListener("click", () => setMode(btn.dataset.mode))
  );

  new Set(Object.values(el.config)).forEach((input) => {
    if (input) input.addEventListener("change", onSettingsChange);
  });

  el.themeToggle.addEventListener("click", () =>
    applyTheme(el.root.getAttribute("data-theme") === "dark" ? "light" : "dark")
  );

  el.taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(el.taskInput.value);
  });
  el.clearDone.addEventListener("click", clearDone);

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.code === "Space") {
      e.preventDefault();
      toggle();
    }
  });

  /* ── Boot ──────────────────────────────────────────────────── */

  const storedTheme = load(STORAGE.theme, "dark");
  applySettings();
  applyTheme(storedTheme === "light" ? "light" : "dark");
  renderTasks();
  setMode("focus");
})();
