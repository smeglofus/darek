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
  updateGameNav();
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
  [1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1],
  [1,0,0,0,1,0,0,0,1,0,1,0,1],
  [1,1,1,0,1,1,1,0,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,1,1,0,1],
  [1,0,0,0,1,0,0,0,0,0,1,0,1],
  [1,0,1,0,1,1,1,0,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1],
];
const MAZE_START = { r: 9, c: 1 };
const MAZE_COMPUTER = { r: 3, c: 6 };
const MAZE_HOME = { r: 1, c: 11 };

// Hlídky chodí po dlouhých chodbách (řádky 1, 5 a 9) mezi cMin a cMax.
const TEACHERS = [
  { r: 9, cMin: 1, cMax: 7,  startC: 7,  startDir: -1, icon: "👨‍🏫" },
  { r: 5, cMin: 1, cMax: 11, startC: 6,  startDir: 1,  icon: "👩‍🏫" },
  { r: 1, cMin: 5, cMax: 11, startC: 11, startDir: -1, icon: "🧑‍🏫" },
];

let mazeState = null;

function resetMazeState() {
  mazeState = {
    player: { ...MAZE_START },
    pcCollected: false,
    teachers: TEACHERS.map(t => ({ r: t.r, c: t.startC, dir: t.startDir, icon: t.icon })),
    caught: 0,
    won: false,
  };
}

function resetMazeRun() {
  mazeState.player = { ...MAZE_START };
  mazeState.teachers = TEACHERS.map(t => ({ r: t.r, c: t.startC, dir: t.startDir, icon: t.icon }));
}

function initTask2() {
  resetMazeState();
  const grid = $("#maze-grid");
  grid.style.gridTemplateColumns = `repeat(${MAZE[0].length}, minmax(0, 1fr))`;
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
      const t = mazeState.teachers.find(t => t.r === r && t.c === c);
      if (t) content = t.icon;
      if (mazeState.player.r === r && mazeState.player.c === c) content = "🧑";
      cell.textContent = content;
    }
  }
  const caught = mazeState.caught > 0 ? ` | Chycen: ${mazeState.caught}×` : "";
  $("#maze-status").textContent = `💻 Počítač: ${mazeState.pcCollected ? "ano" : "ne"} | Cíl: domov 🏠${caught}`;
}

function moveMazePlayer(dir) {
  if (mazeState.won) return;
  const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
  if (!delta) return;

  const prevPlayer = { ...mazeState.player };
  const nr = mazeState.player.r + delta[0];
  const nc = mazeState.player.c + delta[1];
  // Náraz do zdi hráče neposune, ale hlídky se pohnou — dá se tím čekat na mezeru.
  if (MAZE[nr] && MAZE[nr][nc] === 0) {
    mazeState.player = { r: nr, c: nc };
  }

  if (mazeState.player.r === MAZE_COMPUTER.r && mazeState.player.c === MAZE_COMPUTER.c) {
    mazeState.pcCollected = true;
  }

  const prevTeachers = mazeState.teachers.map(t => ({ ...t }));
  mazeState.teachers.forEach((t, i) => {
    const cfg = TEACHERS[i];
    let next = t.c + t.dir;
    if (next > cfg.cMax || next < cfg.cMin) {
      t.dir *= -1;
      next = t.c + t.dir;
    }
    t.c = next;
  });

  const msg = $("#task2-msg");

  // Chycení: stejné políčko, nebo prohození (minutí se o půl tahu se nepočítá jako únik).
  const busted = mazeState.teachers.some((t, i) => {
    const before = prevTeachers[i];
    const sameCell = t.r === mazeState.player.r && t.c === mazeState.player.c;
    const swapped = before.r === mazeState.player.r && before.c === mazeState.player.c
      && t.r === prevPlayer.r && t.c === prevPlayer.c;
    return sameCell || swapped;
  });

  if (busted) {
    mazeState.caught++;
    resetMazeRun();
    msg.textContent = mazeState.pcCollected
      ? "Chytili tě! Zpátky do lavice. Počítač ti aspoň nechali."
      : "Chytili tě! Zpátky do lavice.";
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

// ============ TASK 7: ROZVÁZAT SE Z POSTELE ============
const ROPE_GAIN = 5;        // povedené střídnutí
const ROPE_SAME_SIDE = -5;  // dvakrát po sobě stejná strana
const ROPE_CAUGHT = -12;    // pohyb, když se Patrik dívá
const ROPE_SAFE_MS = [2600, 4200];
const ROPE_WATCH_MS = [1300, 2100];

let ropeState = null;

function randMs([lo, hi]) { return lo + Math.random() * (hi - lo); }

function initTask7() {
  const startBtn = $("#rope-start");
  const left = $("#rope-left");
  const right = $("#rope-right");

  startBtn.addEventListener("click", startRope);
  left.addEventListener("click", () => ropeTwist("left"));
  right.addEventListener("click", () => ropeTwist("right"));

  document.addEventListener("keydown", (e) => {
    if (!$("#screen-task-7").classList.contains("active")) return;
    const map = { ArrowLeft: "left", ArrowRight: "right", a: "left", d: "right" };
    const side = map[e.key];
    if (!side) return;
    e.preventDefault();
    if (ropeState && ropeState.won) return;
    if (!ropeState || !ropeState.running) startRope();
    else ropeTwist(side);
  });

  renderRope();
}

function startRope() {
  stopRopeTimers();
  ropeState = { progress: 0, lastSide: null, watching: false, running: true, won: false, timer: null };
  $("#rope-start").hidden = true;
  $("#rope-left").disabled = false;
  $("#rope-right").disabled = false;
  $("#task7-msg").textContent = "";
  scheduleRopeWatch();
  renderRope();
}

function stopRopeTimers() {
  if (ropeState && ropeState.timer) clearTimeout(ropeState.timer);
}

// Patrik střídá "čumí do mobilu" a "dívá se" v náhodných intervalech.
function scheduleRopeWatch() {
  if (!ropeState || !ropeState.running) return;
  const delay = ropeState.watching ? randMs(ROPE_WATCH_MS) : randMs(ROPE_SAFE_MS);
  ropeState.timer = setTimeout(() => {
    if (!ropeState || !ropeState.running) return;
    ropeState.watching = !ropeState.watching;
    renderRope();
    scheduleRopeWatch();
  }, delay);
}

function ropeTwist(side) {
  if (!ropeState || !ropeState.running) return;
  const msg = $("#task7-msg");

  if (ropeState.watching) {
    ropeState.progress += ROPE_CAUGHT;
    ropeState.lastSide = null;
    msg.textContent = "Vidí tě. Utáhl to a tváří se spokojeně.";
  } else if (side === ropeState.lastSide) {
    ropeState.progress += ROPE_SAME_SIDE;
    msg.textContent = "Musíš střídat. Takhle si to jen utahuješ.";
  } else {
    ropeState.progress += ROPE_GAIN;
    ropeState.lastSide = side;
    msg.textContent = "";
  }

  ropeState.progress = Math.max(0, Math.min(100, ropeState.progress));

  if (ropeState.progress >= 100) {
    ropeState.running = false;
    ropeState.won = true;
    stopRopeTimers();
    $("#rope-left").disabled = true;
    $("#rope-right").disabled = true;
    msg.textContent = "Jsi venku. Patrik si toho všimne asi za hodinu.";
    $("#task7-continue").hidden = false;
  }

  renderRope();
}

function renderRope() {
  const st = ropeState || { progress: 0, watching: false };
  $("#rope-fill").style.width = st.progress + "%";
  $("#rope-percent").textContent = `Povoleno: ${st.progress} %`;
  const watch = $("#rope-watch");
  watch.textContent = st.watching ? "👀 PATRIK SE DÍVÁ" : "😴 Patrik čumí do mobilu";
  watch.classList.toggle("watching", !!st.watching);
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

// ============ POKRAČOVACÍ TLAČÍTKA ============
// Levely 2–7 svoje "Pokračovat" po splnění úkolu jen odkryjí (hidden = false),
// posun na další level jim musí navěsit tohle.
function initContinueButtons() {
  for (let n = 2; n <= 7; n++) {
    const btn = $(`#task${n}-continue`);
    if (btn) btn.addEventListener("click", () => advanceTo(n));
  }
}

// ============ NAVIGACE: ZPĚT A VYNULOVÁNÍ ============
// initTask1/2/7 věší listenery přes addEventListener, takže je nejde volat
// podruhé (zdvojily by se). Ty tři se proto resetují ručně, zbytek snese
// zavolat svoje init znovu — ta si obsah překreslí a obsluhu přiřadí, ne přidá.
function resetLevel(n) {
  const cont = $(`#task${n}-continue`);
  // Level 1 svoje tlačítko neskrývá, jen ho zakazuje přes disabled — schovat ho
  // tady by znamenalo, že se už nikdy nevrátí a level by nešel dohrát.
  if (cont) cont.hidden = n !== 1;
  const msg = $(`#task${n}-msg`);
  if (msg) msg.textContent = "";

  switch (n) {
    case 1: {
      const hours = $("#slider-hours");
      const protivnost = $("#slider-protivnost");
      hours.value = hours.min;
      protivnost.value = protivnost.min;
      // vyvolá render() navěšený v initTask1 — srovná popisky i stav tlačítka
      hours.dispatchEvent(new Event("input"));
      break;
    }
    case 2:
      resetMazeState();
      renderMaze();
      break;
    case 3: initTask3(); break;
    case 4:
      initTask4();
      $("#task4-input").value = "";
      break;
    case 5: initTask5(); break;
    case 6:
      initTask6();
      $("#task6-submit").hidden = false;
      break;
    case 7: resetRope(); break;
    case 8: initTask8(); break;
  }
}

function resetRope() {
  stopRopeTimers();
  ropeState = null;
  $("#rope-start").hidden = false;
  $("#rope-left").disabled = true;
  $("#rope-right").disabled = true;
  renderRope();
}

function updateGameNav() {
  const nav = $("#game-nav");
  if (!nav) return;
  const onLogin = $("#screen-login").classList.contains("active");
  nav.hidden = onLogin;
  $("#game-footer").hidden = onLogin;
  $("#nav-back").disabled = getProgress() <= 0;
}

function goBackOneLevel() {
  const progress = getProgress();
  if (progress <= 0) return;
  // Na obrazovce screen-task-(progress+1) je předchozí level číslo `progress`.
  resetLevel(progress);
  advanceTo(progress - 1);
}

function resetGame() {
  if (!confirm("Vynulovat celou hru? Přijdeš o postup i o přihlášení.")) return;
  localStorage.removeItem(LS_AUTHED);
  localStorage.removeItem(LS_PROGRESS);
  localStorage.removeItem(LS_FAILS);
  for (let n = 1; n <= TOTAL_TASKS; n++) resetLevel(n);
  $("#login-input").value = "";
  $("#login-error").hidden = true;
  $("#login-hint").hidden = true;
  $("#gift-wrapped").hidden = false;
  $("#gift-revealed").hidden = true;
  showScreen("screen-login");
}

function initGameNav() {
  $("#nav-back").addEventListener("click", goBackOneLevel);
  $("#nav-reset").addEventListener("click", resetGame);
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
  initContinueButtons();
  initGameNav();
  goToCurrentState();
});
