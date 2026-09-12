// ============ KONFIGURACE ============
const REAL_PASSWORD = "DM1b6UuHjpTpAY8nCzWZDWBLyXQs55A9dyLkEv8r";
const TOTAL_TASKS = 8;

const LS_AUTHED = "lq_authed";
const LS_PROGRESS = "lq_progress";
const LS_FAILS = "lq_fails";

// ============ POMOCNÉ ============
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isAuthed() { return localStorage.getItem(LS_AUTHED) === "true"; }
function getProgress() { return parseInt(localStorage.getItem(LS_PROGRESS) || "0", 10); }
function setProgress(n) { localStorage.setItem(LS_PROGRESS, String(n)); }

function showScreen(id) {
  $all(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

function screenForProgress(p) {
  if (p >= TOTAL_TASKS) return "screen-finale";
  return "screen-task-" + (p + 1);
}

function goToCurrentState() {
  if (!isAuthed()) {
    showScreen("screen-login");
    return;
  }
  showScreen(screenForProgress(getProgress()));
}

function advanceTo(n) {
  setProgress(n);
  showScreen(screenForProgress(n));
}

// ============ LOGIN ============
function initLogin() {
  const form = $("#login-form");
  const input = $("#login-input");
  const errorEl = $("#login-error");
  const hintBox = $("#login-hint");
  const realPasswordEl = $("#real-password");
  const copyBtn = $("#copy-password");
  const copyConfirm = $("#copy-confirm");

  realPasswordEl.textContent = REAL_PASSWORD;

  let fails = parseInt(localStorage.getItem(LS_FAILS) || "0", 10);
  if (fails >= 3) {
    hintBox.hidden = false;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (value === REAL_PASSWORD) {
      localStorage.setItem(LS_AUTHED, "true");
      errorEl.hidden = true;
      goToCurrentState();
      return;
    }
    fails++;
    localStorage.setItem(LS_FAILS, String(fails));
    if (fails >= 3) {
      hintBox.hidden = false;
      errorEl.hidden = false;
      errorEl.textContent = "Jsi naprosto neschopný. Ale aspoň to zkoušíš.";
    } else {
      errorEl.hidden = false;
      errorEl.textContent = `Špatné heslo. Pokus ${fails}/3.`;
    }
    input.value = "";
    input.focus();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(REAL_PASSWORD);
    } catch (err) {
      const range = document.createRange();
      range.selectNode(realPasswordEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
    copyConfirm.hidden = false;
    setTimeout(() => { copyConfirm.hidden = true; }, 2000);
  });
}

// ============ TASK 1: RANNÍ PROBOUZENÍ ============
function initTask1() {
  const hours = $("#slider-hours");
  const protivnost = $("#slider-protivnost");
  const hoursVal = $("#slider-hours-value");
  const protivnostVal = $("#slider-protivnost-value");
  const msg = $("#task1-msg");
  const btn = $("#task1-continue");

  function render() {
    hoursVal.textContent = hours.value == 10 ? "10 hodin (klidně do oběda)" : hours.value + " hodin";
    protivnostVal.textContent = protivnost.value;
    const maxed = hours.value == "10" && protivnost.value == "10";
    btn.disabled = !maxed;
    msg.textContent = maxed
      ? "Přesně tak. Ticho. Nikdo nic neříká."
      : "Ještě víc. Nikdo na tebe nesmí promluvit.";
  }

  hours.addEventListener("input", render);
  protivnost.addEventListener("input", render);
  render();

  btn.addEventListener("click", () => advanceTo(1));
}

// ============ TASK 2: BLUDIŠTĚ ============
const MAZE = [
  [1,1,1,1,1,1,1,1,1],
  [1,0,0,0,1,0,0,0,1],
  [1,0,1,0,1,0,1,0,1],
  [1,0,1,0,0,0,1,0,1],
  [1,0,1,1,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1],
];
const MAZE_START = { r: 1, c: 1 };
const MAZE_COMPUTER = { r: 3, c: 4 };
const MAZE_HOME = { r: 1, c: 7 };

let mazeState = null;

function resetMazeState() {
  mazeState = {
    player: { ...MAZE_START },
    pcCollected: false,
    teacher: { r: 5, c: 2 },
    teacherDir: 1,
    won: false,
  };
}

function initTask2() {
  resetMazeState();
  const grid = $("#maze-grid");
  grid.style.gridTemplateColumns = `repeat(${MAZE[0].length}, 34px)`;
  grid.innerHTML = "";
  for (let r = 0; r < MAZE.length; r++) {
    for (let c = 0; c < MAZE[0].length; c++) {
      const cell = document.createElement("div");
      cell.className = "maze-cell " + (MAZE[r][c] === 1 ? "maze-wall" : "maze-floor");
      cell.id = `mcell-${r}-${c}`;
      grid.appendChild(cell);
    }
  }
  renderMaze();

  $all(".dpad button").forEach(btn => {
    btn.addEventListener("click", () => moveMazePlayer(btn.dataset.dir));
  });

  document.addEventListener("keydown", mazeKeyHandler);
}

function mazeKeyHandler(e) {
  if (!$("#screen-task-2").classList.contains("active")) return;
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  const dir = map[e.key];
  if (dir) {
    e.preventDefault();
    moveMazePlayer(dir);
  }
}

function renderMaze() {
  for (let r = 0; r < MAZE.length; r++) {
    for (let c = 0; c < MAZE[0].length; c++) {
      const cell = document.getElementById(`mcell-${r}-${c}`);
      if (!cell) continue;
      let content = "";
      if (r === MAZE_COMPUTER.r && c === MAZE_COMPUTER.c && !mazeState.pcCollected) content = "💻";
      if (r === MAZE_HOME.r && c === MAZE_HOME.c) content = "🏠";
      if (mazeState.teacher.r === r && mazeState.teacher.c === c) content = "👨‍🏫";
      if (mazeState.player.r === r && mazeState.player.c === c) content = "🧑";
      cell.textContent = content;
    }
  }
  $("#maze-status").textContent = `💻 Počítač: ${mazeState.pcCollected ? "ano" : "ne"} | Cíl: domov 🏠`;
}

function moveMazePlayer(dir) {
  if (mazeState.won) return;
  const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
  if (!delta) return;
  const nr = mazeState.player.r + delta[0];
  const nc = mazeState.player.c + delta[1];
  if (MAZE[nr] && MAZE[nr][nc] === 0) {
    mazeState.player = { r: nr, c: nc };
  }

  if (mazeState.player.r === MAZE_COMPUTER.r && mazeState.player.c === MAZE_COMPUTER.c) {
    mazeState.pcCollected = true;
  }

  // pohyb učitele (hlídkuje po chodbě mezi sloupci 2 a 6 na řádku 5)
  let nt = mazeState.teacher.c + mazeState.teacherDir;
  if (nt > 6 || nt < 2) {
    mazeState.teacherDir *= -1;
    nt = mazeState.teacher.c + mazeState.teacherDir;
  }
  mazeState.teacher = { r: 5, c: nt };

  const msg = $("#task2-msg");

  if (mazeState.player.r === mazeState.teacher.r && mazeState.player.c === mazeState.teacher.c) {
    mazeState.player = { ...MAZE_START };
    msg.textContent = "Chytili tě! Zpátky do lavice.";
    renderMaze();
    return;
  }

  if (mazeState.player.r === MAZE_HOME.r && mazeState.player.c === MAZE_HOME.c) {
    if (mazeState.pcCollected) {
      mazeState.won = true;
      msg.textContent = "Utekl jsi a stihl jsi vzít počítač. Hrdina.";
      $("#task2-continue").hidden = false;
    } else {
      msg.textContent = "Bez počítače se domů nechoď.";
    }
  } else {
    msg.textContent = "";
  }

  renderMaze();
}

// ============ TASK 3: TUREK ============
const TUREK_STEPS = ["Vezmi sklenici", "Nasyp mletou kávu", "Zalij vroucí vodou", "Zamíchej", "Nech usadit"];
let turekNextIndex = 0;

function initTask3() {
  const container = $("#turek-steps");
  container.innerHTML = "";
  turekNextIndex = 0;
  const shuffled = shuffle(TUREK_STEPS);
  shuffled.forEach(step => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = step;
    chip.dataset.text = step;
    chip.addEventListener("click", () => handleTurekClick(chip));
    container.appendChild(chip);
  });
}

function handleTurekClick(chip) {
  if (chip.classList.contains("used")) return;
  const msg = $("#task3-msg");
  if (chip.dataset.text === TUREK_STEPS[turekNextIndex]) {
    chip.classList.add("used", "picked");
    turekNextIndex++;
    if (turekNextIndex === TUREK_STEPS.length) {
      msg.textContent = "Turek hotový. Zákazník spokojen (výjimečně).";
      $("#task3-continue").hidden = false;
    } else {
      msg.textContent = "";
    }
  } else {
    msg.textContent = "Tohle by ti zákazník vrátil. Zkus to znovu.";
    turekNextIndex = 0;
    $all("#turek-steps .chip").forEach(c => c.classList.remove("used", "picked"));
  }
}

// ============ TASK 4: BÁBOVKA ============
const RECIPE_LINES = [
  "Smíchej mouku s cukrem a práškem do pečiva.",
  "Yes, přidej i vanilkový cukr, ať to má chuť.",
  "Rozšlehej vejce s olejem a mlékem.",
  "Opatrně vlij tekutou směs do sypké.",
  "Vmíchej všechno dohromady, dokud nezmizí hrudky.",
  "Éčka v tom nejsou, je to poctivá domácí bábovka.",
];
const RECIPE_ANSWER = "SYROVE";

function initTask4() {
  const box = $("#recipe-box");
  box.innerHTML = "";
  RECIPE_LINES.forEach(line => {
    const p = document.createElement("p");
    p.innerHTML = `<span class="letter">${line[0]}</span>${line.slice(1)}`;
    box.appendChild(p);
  });

  const form = $("#task4-form");
  const input = $("#task4-input");
  const msg = $("#task4-msg");

  form.onsubmit = (e) => {
    e.preventDefault();
    if (normalize(input.value) === RECIPE_ANSWER) {
      msg.textContent = "Přesně. Stejně ji sníš syrovou, než se dostane do trouby.";
      $("#task4-continue").hidden = false;
    } else {
      msg.textContent = "Zkus se podívat na první písmenka. Pěkně popořadě odshora dolů.";
    }
  };
}

// ============ TASK 5: MINECRAFT CRAFTING ============
const CRAFT_PATTERN = ["diamond", "diamond", "diamond", "empty", "stick", "empty", "empty", "stick", "empty"];
const CRAFT_ICONS = { diamond: "💎", stick: "🥢", empty: "" };
let craftGridState = new Array(9).fill("empty");
let craftSelected = "diamond";

function initTask5() {
  craftGridState = new Array(9).fill("empty");
  craftSelected = "diamond";

  const palette = $("#craft-palette");
  palette.innerHTML = "";
  [["diamond", "💎"], ["stick", "🥢"], ["empty", "🧹"]].forEach(([key, icon]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = icon;
    b.dataset.key = key;
    if (key === craftSelected) b.classList.add("selected");
    b.addEventListener("click", () => {
      craftSelected = key;
      $all("#craft-palette button").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
    });
    palette.appendChild(b);
  });

  const grid = $("#craft-grid");
  grid.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.className = "craft-cell";
    cell.dataset.index = i;
    cell.addEventListener("click", () => {
      craftGridState[i] = craftSelected;
      cell.textContent = CRAFT_ICONS[craftSelected];
    });
    grid.appendChild(cell);
  }

  $("#craft-reset").onclick = () => {
    craftGridState = new Array(9).fill("empty");
    $all("#craft-grid .craft-cell").forEach(c => c.textContent = "");
    $("#task5-msg").textContent = "";
  };

  $("#craft-check").onclick = () => {
    const msg = $("#task5-msg");
    const correct = craftGridState.every((v, i) => v === CRAFT_PATTERN[i]);
    if (correct) {
      msg.textContent = "Diamantový krumpáč hotový. Konečně něco umíš pořádně.";
      $("#task5-continue").hidden = false;
    } else {
      msg.textContent = "To se nikdy nevykraftuje. Zkus to jinak.";
    }
  };
}

// ============ TASK 6: SUBNAUTICA ============
const SUBNAUTICA_ITEMS = [
  { id: "knife", text: "Nůž", correct: true },
  { id: "oxygen", text: "Kyslíková láhev", correct: true },
  { id: "seaglide", text: "Seaglide", correct: true },
  { id: "pda", text: "PDA", correct: true },
  { id: "fins", text: "Ploutve", correct: true },
  { id: "umbrella", text: "Deštník", correct: false },
  { id: "phone", text: "Mobilní telefon", correct: false },
  { id: "sunglasses", text: "Brýle na sluníčko", correct: false },
  { id: "sandwich", text: "Sendvič s tuňákem (ironie, já vím)", correct: false },
];

function initTask6() {
  const list = $("#subnautica-list");
  list.innerHTML = "";
  shuffle(SUBNAUTICA_ITEMS).forEach(item => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" data-id="${item.id}"> ${item.text}`;
    list.appendChild(label);
  });

  $("#task6-submit").onclick = () => {
    const checked = $all("#subnautica-list input:checked").map(i => i.dataset.id);
    const correctIds = SUBNAUTICA_ITEMS.filter(i => i.correct).map(i => i.id);
    const isMatch = checked.length === correctIds.length && checked.every(id => correctIds.includes(id));
    const msg = $("#task6-msg");
    if (isMatch) {
      msg.textContent = "Přežil jsi Safe Shallows. Gratulace, méně schopní umřeli na reachera.";
      $("#task6-submit").hidden = true;
      $("#task6-continue").hidden = false;
    } else {
      msg.textContent = "To bys nepřežil ani prvních 5 minut v Safe Shallows. Zkus to znovu.";
    }
  };
}

// ============ TASK 7: METAL ============
const METAL_ANSWER = "METALLICA";

function initTask7() {
  $("#reversed-word").textContent = METAL_ANSWER.split("").reverse().join("");
  const form = $("#task7-form");
  const input = $("#task7-input");
  const msg = $("#task7-msg");

  form.onsubmit = (e) => {
    e.preventDefault();
    if (normalize(input.value) === METAL_ANSWER) {
      msg.textContent = "Jasně že to poznáš i pozpátku, vždyť to hraješ na plnou hlasitost furt dokola.";
      $("#task7-continue").hidden = false;
    } else {
      msg.textContent = "Zkus to přečíst pozpátku. Fakt to není složité.";
    }
  };
}

// ============ TASK 8: MODRÁ BUNDA ============
const JACKET_ROUNDS = [
  { q: "Měl jsi tu moji modrou bundu, co byla na věšáku?", options: ["Jakou modrou bundu?", "Jako na tom věšáku vzadu?"] },
  { q: "Ne, ptám se, jestli jsi bral tu bundu z předsíně.", options: ["Bundu? Jakou bundu?", "Z předsíně, nebo z pokoje?"] },
  { q: "Tu modrou! Co visela vedle dveří!", options: ["Aha, TU bundu.", "Vedle jakých dveří?"] },
  { q: "Jako fakt, viděl jsi ji, nebo ne?", options: ["Možná. Nevím. Asi.", "Neviděl, ale hledám ji taky."] },
  { q: "Tak jo, zapomeň na to. Kde je ten počítač, cos mi vzal v levelu 2?", options: ["Jaký počítač?", "Který level?"] },
];
let jacketRound = 0;

function initTask8() {
  jacketRound = 0;
  renderJacketRound();
}

function renderJacketRound() {
  const progress = $("#task8-progress");
  if (jacketRound >= JACKET_ROUNDS.length) {
    progress.textContent = "Fajn, fajn. Pojď se podívat na ten dárek.";
    $("#jacket-question").textContent = "";
    $("#jacket-options").innerHTML = "";
    setTimeout(() => advanceTo(8), 1000);
    return;
  }
  const round = JACKET_ROUNDS[jacketRound];
  progress.textContent = `Otázka ${jacketRound + 1}/${JACKET_ROUNDS.length}`;
  $("#jacket-question").textContent = round.q;
  const optionsEl = $("#jacket-options");
  optionsEl.innerHTML = "";
  round.options.forEach(opt => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = opt;
    b.addEventListener("click", () => {
      jacketRound++;
      renderJacketRound();
    });
    optionsEl.appendChild(b);
  });
}

// ============ FINÁLE ============
function initFinale() {
  $("#unwrap-btn").addEventListener("click", () => {
    $("#gift-wrapped").hidden = true;
    $("#gift-revealed").hidden = false;
    launchConfetti();
  });
}

function launchConfetti() {
  const layer = $("#confetti-layer");
  const colors = ["#ff5fa2", "#5fe3ff", "#ffd25f", "#6dffb0"];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    const duration = 2.5 + Math.random() * 2;
    piece.style.animationDuration = duration + "s";
    piece.style.animationDelay = (Math.random() * 0.5) + "s";
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + 1) * 1000);
  }
}

// ============ INIT ============
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initTask1();
  initTask2();
  initTask3();
  initTask4();
  initTask5();
  initTask6();
  initTask7();
  initTask8();
  initFinale();
  goToCurrentState();
});
