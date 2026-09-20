// ============ KONFIGURACE ============
const REAL_PASSWORD = "DM1b6UuHjpTpAY8nCzWZDWBLyXQs55A9dyLkEv8r";
const TOTAL_TASKS = 8;

const LS_AUTHED = "lq_authed";
const LS_PROGRESS = "lq_progress";
const LS_FAILS = "lq_fails";
const LS_MAX = "lq_max";
const LS_BADGES = "lq_badges";
const LS_COOKIES = "lq_cookies";
const LS_FLIP = "lq_flip";
const LS_GLITCH = "lq_glitch";
const LS_SOUND = "lq_sound";

// Co se doopravdy zkopíruje při prvním kliknutí na „Zkopírovat“.
const FAKE_CLIPBOARD = "nekecal jsem";

// Správné heslo napoprvé neprojde: tlačítko se třikrát zmenší a uteče dolů.
const LOGIN_TEASE_STEPS = [
  { msg: "Hm. Nestalo se nic. Zkus to znovu.", scale: 0.72, dx: 18, dy: 22 },
  { msg: "Divné. To tlačítko jako by se zmenšovalo.", scale: 0.48, dx: -26, dy: 48 },
  { msg: "Poslední pokus. Trefíš se vůbec?", scale: 0.3, dx: 34, dy: 78 },
  { msg: "Ne. Tak ještě menší. Užíváš si to?", scale: 0.2, dx: -30, dy: 104 },
  // poslední krok se nepozicuje inline — musí se vycentrovat, jinak na úzkém
  // displeji vyleze za levý okraj
  { msg: "Dobře, dobře. Takhle to trefíš i ty.", mega: true },
];
let loginTease = 0;
let copyClicks = 0;

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

// Nejdál, kam se hráč dostal. Drží se zvlášť od aktuálního postupu, aby šlo
// couvnout na starší level a zase se vrátit dopředu bez opakovaného řešení.
// Math.max kvůli rozehraným hrám, které tenhle klíč v localStorage ještě nemají.
function getMaxProgress() {
  return Math.max(parseInt(localStorage.getItem(LS_MAX) || "0", 10), getProgress());
}
function setMaxProgress(n) { localStorage.setItem(LS_MAX, String(n)); }

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
  // Strop se uklada vzdy, ne jen pri posunu vpred: u her rozehranych starsi
  // verzi se dopocitava z postupu, a bez zapisu by pri couvnuti spadl taky.
  const max = Math.max(getMaxProgress(), n);
  setProgress(n);
  setMaxProgress(max);
  showScreen(screenForProgress(n));
  if (n > 0) awardBadge(n);
  maybeGlitchFlip(n);
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
  const submitBtn = form.querySelector("button");

  realPasswordEl.textContent = REAL_PASSWORD;

  let fails = parseInt(localStorage.getItem(LS_FAILS) || "0", 10);
  if (fails >= 3) {
    hintBox.hidden = false;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (value === REAL_PASSWORD) {
      // Heslo sedí, ale hned ho dovnitř nepustíme. Tlačítko se třikrát zmenší
      // a uteče níž; heslo v poli zůstává, ať ho nemusí vkládat znovu.
      if (loginTease < LOGIN_TEASE_STEPS.length) {
        const step = LOGIN_TEASE_STEPS[loginTease++];
        submitBtn.classList.toggle("mega", Boolean(step.mega));
        submitBtn.style.transform = step.mega
          ? ""
          : `translate(${step.dx}px, ${step.dy}px) scale(${step.scale})`;
        errorEl.hidden = false;
        errorEl.textContent = step.msg;
        return;
      }
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
    // První kliknutí nezkopíruje heslo, ale přiznání, že to nefunguje.
    // Druhé už kopíruje doopravdy, ať v tom neuvízne na mobilu.
    const prank = copyClicks === 0;
    copyClicks++;
    const text = prank ? FAKE_CLIPBOARD : REAL_PASSWORD;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const range = document.createRange();
      range.selectNode(realPasswordEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
    copyConfirm.textContent = prank
      ? "Dělám si srandu, tohle nefunguje."
      : "No dobře. Teď doopravdy zkopírováno.";
    copyConfirm.classList.toggle("prank", prank);
    copyConfirm.hidden = false;
    setTimeout(() => { copyConfirm.hidden = true; }, prank ? 3000 : 2000);
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
    if (maxed && btn.disabled) SFX.alarm();
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
      // Hráč není emoji, ale vyříznutý obličej z fotky — kreslí se přes CSS
      // jako pozadí buňky, takže tahle buňka žádný text nemá.
      const isPlayer = mazeState.player.r === r && mazeState.player.c === c;
      cell.classList.toggle("maze-player", isPlayer);
      cell.textContent = isPlayer ? "" : content;
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
    if (!mazeState.pcCollected) SFX.coin();
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
    SFX.trombone();
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
      SFX.fanfare();
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
    SFX.clonk();
    if (turekNextIndex === TUREK_STEPS.length) {
      SFX.fanfare();
      msg.textContent = "Turek hotový. Zákazník spokojen (výjimečně).";
      $("#task3-continue").hidden = false;
    } else {
      msg.textContent = "";
    }
  } else {
    SFX.trombone();
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
      SFX.ding();
      msg.textContent = "Přesně. Stejně ji sníš syrovou, než se dostane do trouby.";
      $("#task4-continue").hidden = false;
    } else {
      SFX.buzzer();
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
      SFX.clonk();
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
      SFX.fanfare();
      msg.textContent = "Diamantový krumpáč hotový. Konečně něco umíš pořádně.";
      $("#task5-continue").hidden = false;
    } else {
      SFX.buzzer();
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
      SFX.sonar();
      msg.textContent = "Přežil jsi Safe Shallows. Gratulace, méně schopní umřeli na reachera.";
      $("#task6-submit").hidden = true;
      $("#task6-continue").hidden = false;
    } else {
      SFX.trombone();
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

  SFX.tick();
  ropeState.progress = Math.max(0, Math.min(100, ropeState.progress));

  if (ropeState.progress >= 100) {
    ropeState.running = false;
    ropeState.won = true;
    stopRopeTimers();
    $("#rope-left").disabled = true;
    $("#rope-right").disabled = true;
    SFX.fanfare();
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

// ============ TASK 8: SVARTA JUMP ============
// Hlášky z originálního videa (Hořice, 2008). Chodí popořadě, ať na sebe
// navazují jako v tom videu, a po vyčerpání se točí dokola od začátku.
const JUMP_QUOTES = [
  "„Dělej!“",
  "„No, tak to jsem neviděl.“",
  "„Svarta, je ti něco?“ — „Není mu nic, je mu hodně!“",
  "„Vejška jako prase.“",
  "„Rozlámanej jak svině.“",
  "„Dělej, dolů!“",
];

// Trefit 12 % z pruhu je akorát na to, aby to chvíli trvalo. Po třech
// nepovedených pokusech se zóna rozšíří — stejná milost jako u hesla.
const JUMP_ZONE = { start: 62, width: 12 };
const JUMP_MERCY_AFTER = 3;
const JUMP_MERCY_WIDTH = 22;

let jumpState = null;
let jumpRaf = null;

function jumpZone() {
  const wide = jumpState.attempts >= JUMP_MERCY_AFTER;
  const width = wide ? JUMP_MERCY_WIDTH : JUMP_ZONE.width;
  const start = JUMP_ZONE.start - (width - JUMP_ZONE.width) / 2;
  return { start, end: start + width };
}

function renderJumpZone() {
  const z = jumpZone();
  const el = $("#jump-zone");
  el.style.left = z.start + "%";
  el.style.width = (z.end - z.start) + "%";
  $("#jump-tree").style.left = ((z.start + z.end) / 2) + "%";
}

function renderJumpMeter() {
  $("#jump-marker").style.left = jumpState.power + "%";
  $("#jump-power").textContent = "Síla odrazu: " + Math.round(jumpState.power) + " %";
}

// Souřadnice scény: x v procentech šířky, y v pixelech ode dna.
const JUMP_START = { x: 7, y: 98 };   // střecha garáže
const JUMP_BRANCH_Y = 88;             // větev, na kterou se má chytit
const JUMP_GROUND_Y = 14;             // tráva pod garáží

function placeGuy(xPercent, y, rotateDeg) {
  const guy = $("#jump-guy");
  guy.style.left = xPercent + "%";
  guy.style.bottom = y + "px";
  guy.style.transform = `translateX(-50%) rotate(deg)`;
}

function resetJump() {
  if (jumpRaf) { cancelAnimationFrame(jumpRaf); jumpRaf = null; }
  const attempts = jumpState ? jumpState.attempts : 0;
  jumpState = { phase: "idle", power: 0, dir: 1, attempts, won: false };
  $("#jump-guy").textContent = "🧍";
  $("#jump-btn").hidden = false;
  $("#jump-btn").textContent = "Rozběhnout se";
  $("#task8-msg").textContent = "";
  $("#jump-quote").textContent = "";
  $("#task8-continue").hidden = true;
  renderJumpZone();
  renderJumpMeter();
  placeGuy(JUMP_START.x, JUMP_START.y, 0);
}

// Pruh běží tam a zpět; druhé kliknutí ho zastaví na aktuální hodnotě.
function chargeLoop() {
  jumpState.power += jumpState.dir * 1.3;
  if (jumpState.power >= 100) { jumpState.power = 100; jumpState.dir = -1; }
  if (jumpState.power <= 0) { jumpState.power = 0; jumpState.dir = 1; }
  renderJumpMeter();
  jumpRaf = requestAnimationFrame(chargeLoop);
}

function startCharging() {
  jumpState.phase = "charging";
  jumpState.power = 0;
  jumpState.dir = 1;
  $("#jump-btn").textContent = "JUMPNI!";
  $("#task8-msg").textContent = "";
  $("#jump-quote").textContent = "";
  jumpRaf = requestAnimationFrame(chargeLoop);
}

function releaseJump() {
  cancelAnimationFrame(jumpRaf);
  jumpRaf = null;
  jumpState.phase = "flying";
  $("#jump-btn").hidden = true;
  SFX.boing();

  const z = jumpZone();
  const power = jumpState.power;
  const hit = power >= z.start && power <= z.end;
  const from = JUMP_START.x;
  const to = Math.max(from + 2, power);
  const endY = hit ? JUMP_BRANCH_Y : JUMP_GROUND_Y;
  // čím tvrdší odraz, tím vyšší oblouk — „vejška jako prase“
  const apex = 30 + power * 0.45;
  const duration = 750;
  const started = performance.now();

  function fly(now) {
    const t = Math.min((now - started) / duration, 1);
    const x = from + (to - from) * t;
    const y = JUMP_START.y + (endY - JUMP_START.y) * t + Math.sin(Math.PI * t) * apex;
    placeGuy(x, y, t * 20);
    if (t < 1) { jumpRaf = requestAnimationFrame(fly); return; }
    jumpRaf = null;
    if (hit) landOnBranch(to);
    else landOnGround(to, power < z.start);
  }
  jumpRaf = requestAnimationFrame(fly);
}

function landOnBranch(x) {
  jumpState.phase = "done";
  jumpState.won = true;
  placeGuy(x, JUMP_BRANCH_Y, 0);
  $("#jump-guy").textContent = "🧗";
  SFX.fanfare();
  $("#task8-msg").textContent = "Chytil ses. Po osmnácti letech to Svarta konečně dal.";
  $("#jump-quote").textContent = "„No, tak to jsem neviděl.“ — a tentokrát v dobrém.";
  saySvarta("No, tak to jsem neviděl");
  $("#task8-continue").hidden = false;
}

function landOnGround(x, short) {
  jumpState.phase = "done";
  jumpState.attempts++;
  placeGuy(x, JUMP_GROUND_Y, 90);
  $("#jump-guy").textContent = "🤕";
  SFX.thud();
  $("#task8-msg").textContent = short
    ? "Málo. Odrazil ses jako člověk, co nevstává před jedenáctou."
    : "Moc. Strom jsi minul o celou zahradu.";
  const quote = JUMP_QUOTES[(jumpState.attempts - 1) % JUMP_QUOTES.length];
  $("#jump-quote").textContent = quote;
  saySvarta(quote);
  $("#jump-btn").hidden = false;
  $("#jump-btn").textContent = "Zkusit to znovu";
  jumpState.phase = "idle";

  if (jumpState.attempts === JUMP_MERCY_AFTER) {
    $("#task8-msg").textContent += " Dobře. Snížíme ti tu větev, jumpere.";
    renderJumpZone();
  }
}

function initTask8() {
  // Přiřazení přes .onclick, ne addEventListener — resetLevel(8) volá resetJump,
  // ale init se může spustit i podruhé a listener by se zdvojil.
  $("#jump-btn").onclick = () => {
    if (jumpState.won) return;
    if (jumpState.phase === "idle") startCharging();
    else if (jumpState.phase === "charging") releaseJump();
  };
  resetJump();
}

// ============ FINÁLE: TRUHLA ============
function revealGift() {
  $("#gift-locked").hidden = true;
  $("#gift-revealed").hidden = false;
  launchConfetti();
}

function initFinale() {
  const chest = $("#chest");
  chest.classList.remove("open");
  $("#chest-msg").textContent = "";
  chest.onclick = () => {
    if (chest.classList.contains("open")) return;
    chest.classList.add("open");
    $("#chest-msg").textContent = "VRRRZZZ—";
    playChestScream();
    // víko se odklápí přes CSS přechod, obsah ukazujeme, až dojekotá
    setTimeout(revealGift, 1400);
  };
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
  for (let n = 2; n <= 8; n++) {
    const btn = $(`#task${n}-continue`);
    if (!btn) continue;
    btn.addEventListener("click", () => {
      // Level 2 se cestou ven jednou „rozbije“ a vyptává se, jestli to myslí vážně.
      if (n === 2 && localStorage.getItem(LS_GLITCH) !== "true") {
        runGlitchGate(() => advanceTo(2));
        return;
      }
      advanceTo(n);
    });
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
    case 8: resetJump(); break;
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
  $("#nav-forward").disabled = getProgress() >= getMaxProgress();
}

function goBackOneLevel() {
  const progress = getProgress();
  if (progress <= 0) return;
  // Na obrazovce screen-task-(progress+1) je předchozí level číslo `progress`.
  resetLevel(progress);
  advanceTo(progress - 1);
}

function goForwardOneLevel() {
  const progress = getProgress();
  if (progress >= getMaxProgress()) return;
  advanceTo(progress + 1);
}

function resetGame() {
  if (!confirm("Vynulovat celou hru? Přijdeš o postup i o přihlášení.")) return;
  if (!confirm("Fakt?")) return;
  if (!confirm("Naposledy: fakt fakt?")) return;
  localStorage.removeItem(LS_AUTHED);
  localStorage.removeItem(LS_PROGRESS);
  localStorage.removeItem(LS_FAILS);
  localStorage.removeItem(LS_MAX);
  localStorage.removeItem(LS_BADGES);
  localStorage.removeItem(LS_FLIP);
  localStorage.removeItem(LS_GLITCH);
  jumpState = null;
  loginTease = 0;
  copyClicks = 0;
  const submitBtn = $("#login-form").querySelector("button");
  submitBtn.style.transform = "";
  submitBtn.classList.remove("mega");
  for (let n = 1; n <= TOTAL_TASKS; n++) resetLevel(n);
  $("#login-input").value = "";
  $("#login-error").hidden = true;
  $("#login-hint").hidden = true;
  $("#gift-locked").hidden = false;
  initFinale();
  $("#gift-revealed").hidden = true;
  showScreen("screen-login");
}

function initGameNav() {
  $("#nav-back").addEventListener("click", goBackOneLevel);
  $("#nav-forward").addEventListener("click", goForwardOneLevel);
  $("#nav-reset").addEventListener("click", resetGame);
}

// ============ COOKIE LIŠTA ============
function initCookieBar() {
  const bar = $("#cookie-bar");
  if (localStorage.getItem(LS_COOKIES) === "true") { bar.hidden = true; return; }
  bar.hidden = false;
  // Obě tlačítka dělají totéž. Odmítnout nejde, o tom ta lišta je.
  $all("#cookie-bar button").forEach(btn => {
    btn.onclick = () => {
      localStorage.setItem(LS_COOKIES, "true");
      bar.hidden = true;
    };
  });
}

// ============ TITULEK KARTY ============
function initTabTaunt() {
  const original = document.title;
  let timer = null;
  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    if (document.hidden) {
      document.title = "Kam jsi zmizel?";
      timer = setTimeout(() => { document.title = "Fajn, tak já počkám."; }, 10000);
    } else {
      document.title = original;
    }
  });
}

// ============ TOASTY A ODZNAKY ============
const BADGES = {
  1: "Vstal před polednem",
  2: "Počítač putuje domů do postele",
  3: "Turek do skla bez reklamace",
  4: "Rozluštil babičku",
  5: "Diamantový krumpáč podle návodu",
  6: "Přežil Safe Shallows",
  7: "Vykroutil se bratrovi",
  8: "Jumper",
};

function showToast(icon, title, text) {
  const toast = document.createElement("div");
  toast.className = "toast";
  const iconEl = document.createElement("span");
  iconEl.className = "toast-icon";
  iconEl.textContent = icon;
  const body = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = title;
  body.appendChild(strong);
  body.appendChild(document.createElement("br"));
  body.appendChild(document.createTextNode(text));
  toast.appendChild(iconEl);
  toast.appendChild(body);
  $("#toast-layer").appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3800);
}

function awardedBadges() {
  try { return JSON.parse(localStorage.getItem(LS_BADGES) || "[]"); }
  catch (err) { return []; }
}

// Každý odznak padne jenom jednou za hru — jinak by vyskakoval znovu pokaždé,
// když se hráč prokliká navigací přes už dohraný level.
function awardBadge(n) {
  const name = BADGES[n];
  if (!name) return;
  const got = awardedBadges();
  if (got.includes(n)) return;
  got.push(n);
  localStorage.setItem(LS_BADGES, JSON.stringify(got));
  showToast("🏆", "Odznak odemčen", name);
}

// ============ VZHŮRU NOHAMA ============
// Jednorázový „výpadek“ v půlce hry, po pátém levelu.
function maybeGlitchFlip(n) {
  if (n !== 5 || localStorage.getItem(LS_FLIP) === "true") return;
  localStorage.setItem(LS_FLIP, "true");
  document.body.classList.add("upside-down");
  setTimeout(() => {
    document.body.classList.remove("upside-down");
    showToast("🔌", "Promiň", "Kopl jsem do kabelu.");
  }, 2200);
}

// ============ HLÁŠKY NAHLAS ============
let speechOn = true;

function saySvarta(text) {
  if (!soundOn || !speechOn || !("speechSynthesis" in window)) return;
  const clean = text.replace(/[„“"—]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return;
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = "cs-CZ";
  utter.rate = 1.05;
  const voices = window.speechSynthesis.getVoices();
  const czech = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("cs"));
  if (czech) utter.voice = czech;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function initSpeechToggle() {
  const btn = $("#jump-sound");
  const render = () => {
    btn.textContent = speechOn ? "🔊 Hlášky nahlas" : "🔇 Hlášky potichu";
    btn.setAttribute("aria-pressed", String(speechOn));
  };
  btn.onclick = () => {
    speechOn = !speechOn;
    if (!speechOn && "speechSynthesis" in window) window.speechSynthesis.cancel();
    render();
  };
  render();
}

// ============ KONAMI KÓD ============
const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
let konamiPos = 0;

function initKonami() {
  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === KONAMI[konamiPos]) konamiPos++;
    else konamiPos = key === KONAMI[0] ? 1 : 0;
    if (konamiPos < KONAMI.length) return;
    konamiPos = 0;
    lukyRain();
    showToast("🎮", "Konami", "Tohle jsi neměl najít.");
    if ($("#screen-task-8").classList.contains("active")) autoJump();
  });
}

function lukyRain() {
  const layer = $("#confetti-layer");
  for (let i = 0; i < 36; i++) {
    const drop = document.createElement("div");
    drop.className = "luky-drop";
    drop.style.left = Math.random() * 100 + "vw";
    const duration = 2.5 + Math.random() * 2;
    drop.style.animationDuration = duration + "s";
    drop.style.animationDelay = (Math.random() * 0.8) + "s";
    layer.appendChild(drop);
    setTimeout(() => drop.remove(), (duration + 1.2) * 1000);
  }
}

// Svarta se odrazí sám a trefí se — jediný způsob, jak ten level vyhrát bez rukou.
function autoJump() {
  if (!jumpState || jumpState.won) return;
  if (jumpRaf) { cancelAnimationFrame(jumpRaf); jumpRaf = null; }
  const z = jumpZone();
  jumpState.power = (z.start + z.end) / 2;
  jumpState.phase = "charging";
  renderJumpMeter();
  releaseJump();
}

// ============ TRAPNÉ ZVUKY ============
// Všechno se skládá v prohlížeči přes Web Audio, aby hra nepotřebovala
// jediný zvukový soubor. Vypínač je v patičce a mlčí pak úplně všechno.
let soundOn = localStorage.getItem(LS_SOUND) !== "false";

function blip(from, to, dur, type, delay, gain) {
  const ctx = getAudioCtx();
  if (!ctx || !soundOn) return;
  const t = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  osc.type = type || "square";
  osc.frequency.setValueAtTime(from, t);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain || 0.12, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur, freq, q, delay, gain) {
  const ctx = getAudioCtx();
  if (!ctx || !soundOn) return;
  const t = ctx.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = q;
  const env = ctx.createGain();
  env.gain.value = gain || 0.15;
  src.connect(band).connect(env).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur);
}

const SFX = {
  alarm() { for (let i = 0; i < 6; i++) blip(880, 880, 0.09, "square", i * 0.13, 0.09); },
  coin() { blip(988, 988, 0.08, "square", 0, 0.1); blip(1319, 1319, 0.22, "square", 0.08, 0.1); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.16, "square", i * 0.1, 0.09)); },
  buzzer() { blip(180, 90, 0.34, "sawtooth", 0, 0.13); },
  ding() { blip(1568, 1568, 0.18, "triangle", 0, 0.1); blip(2093, 2093, 0.3, "triangle", 0.05, 0.05); },
  clonk() { blip(220, 110, 0.09, "square", 0, 0.09); },
  sonar() { blip(1200, 400, 0.5, "sine", 0, 0.11); },
  tick() { noiseBurst(0.06, 900 + Math.random() * 500, 12, 0, 0.1); },
  boing() { blip(160, 900, 0.22, "sine", 0, 0.13); },
  thud() { blip(140, 45, 0.3, "sine", 0, 0.2); noiseBurst(0.12, 200, 2, 0, 0.1); },
  // trapnost v nejčistší podobě
  trombone() { [392, 370, 349, 311].forEach((f, i) => blip(f, f * 0.93, 0.26, "sawtooth", i * 0.2, 0.11)); },
};

function initSoundToggle() {
  const btn = $("#nav-sound");
  const render = () => {
    btn.textContent = soundOn ? "🔊 zvuky" : "🔇 zvuky";
    btn.setAttribute("aria-pressed", String(soundOn));
  };
  btn.onclick = () => {
    soundOn = !soundOn;
    localStorage.setItem(LS_SOUND, String(soundOn));
    if (!soundOn && "speechSynthesis" in window) window.speechSynthesis.cancel();
    render();
    if (soundOn) SFX.ding();
  };
  render();
}

// ============ ROZBITÁ OBRAZOVKA PO LEVELU 2 ============
const GLITCH_STEPS = [
  { q: "Fakt chceš pokračovat?", label: "Ano", cls: "" },
  { q: "Opravdu?", label: "Ano", cls: "gate-small" },
  { q: "Jako fakt fakt?", label: "ano", cls: "gate-corner" },
  { q: "", label: "NO TAK DOBŘE", cls: "gate-huge" },
];

function runGlitchGate(done) {
  document.body.classList.add("glitching");
  setTimeout(() => {
    document.body.classList.remove("glitching");
    openGlitchGate(done);
  }, 1300);
}

function openGlitchGate(done) {
  const gate = $("#glitch-gate");
  const question = $("#glitch-question");
  const yes = $("#glitch-yes");
  let step = 0;

  const render = () => {
    const s = GLITCH_STEPS[step];
    question.textContent = s.q;
    yes.textContent = s.label;
    yes.className = s.cls;
  };

  yes.onclick = () => {
    step++;
    if (step < GLITCH_STEPS.length) { render(); return; }
    gate.hidden = true;
    yes.className = "";
    localStorage.setItem(LS_GLITCH, "true");
    done();
  };

  gate.hidden = false;
  render();
}

// ============ ZVUK TRUHLY ============
let audioCtx = null;

function getAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Stačí do složky hodit krik.mp3 a pustí se ten; dokud tam není, vyrobí si
// prohlížeč jekot sám, ať hra nezávisí na žádném externím souboru.
function playChestScream() {
  if (!soundOn) return;
  let handled = false;
  const fallback = () => { if (!handled) { handled = true; synthScream(); } };
  try {
    const custom = new Audio("krik.mp3");
    custom.volume = 0.9;
    custom.addEventListener("error", fallback);
    custom.play().then(() => { handled = true; }).catch(fallback);
  } catch (err) {
    fallback();
  }
}

function distortionCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function synthScream() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);

  // vrznutí pantu: šum protažený úzkým pásmovým filtrem, co jede nahoru
  const noiseLen = Math.floor(ctx.sampleRate * 0.35);
  const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 14;
  band.frequency.setValueAtTime(320, now);
  band.frequency.exponentialRampToValueAtTime(1500, now + 0.35);
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.45;
  noise.connect(band).connect(noiseGain).connect(master);
  noise.start(now);
  noise.stop(now + 0.35);

  // a pak jekot: pila s vibratem, které se zrychluje — něco mezi kozou a alarmem
  const start = now + 0.22;
  const dur = 1.4;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, start);
  osc.frequency.exponentialRampToValueAtTime(880, start + 0.12);
  osc.frequency.exponentialRampToValueAtTime(620, start + 0.7);
  osc.frequency.exponentialRampToValueAtTime(170, start + dur);

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(11, start);
  lfo.frequency.linearRampToValueAtTime(27, start + dur);
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 115;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  const shaper = ctx.createWaveShaper();
  shaper.curve = distortionCurve(60);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(0.9, start + 0.05);
  env.gain.setValueAtTime(0.9, start + dur - 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(shaper).connect(env).connect(master);

  osc.start(start);
  osc.stop(start + dur);
  lfo.start(start);
  lfo.stop(start + dur);
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
  initCookieBar();
  initTabTaunt();
  initSoundToggle();
  initSpeechToggle();
  initKonami();
  goToCurrentState();
});
