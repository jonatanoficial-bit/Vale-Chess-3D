/*
  Vale Chess 3D Career - MVP offline
  Build: v0.1.1
  Foco: site estatico leve, mobile-first, GitHub Pages, pronto para Firebase no futuro.
*/

const BUILD = {
  version: "v0.1.1",
  datetime: "2026-05-02 09:42 BRT",
  label: "Build v0.1.1 - 2026-05-02 09:42 BRT"
};

const STORAGE_KEY = "vale_chess_3d_career_profile_v011";
const AVATARS = ["♟", "♞", "♜", "♛", "♚", "🧠", "🔥", "🌎", "🏆", "⭐"];
const COUNTRIES = [
  { name: "Brasil", flag: "🇧🇷", continent: "America", rating: 800 },
  { name: "Argentina", flag: "🇦🇷", continent: "America", rating: 820 },
  { name: "Estados Unidos", flag: "🇺🇸", continent: "America", rating: 950 },
  { name: "Mexico", flag: "🇲🇽", continent: "America", rating: 790 },
  { name: "Franca", flag: "🇫🇷", continent: "Europa", rating: 960 },
  { name: "Espanha", flag: "🇪🇸", continent: "Europa", rating: 930 },
  { name: "Alemanha", flag: "🇩🇪", continent: "Europa", rating: 970 },
  { name: "India", flag: "🇮🇳", continent: "Asia", rating: 1000 },
  { name: "China", flag: "🇨🇳", continent: "Asia", rating: 990 },
  { name: "Japao", flag: "🇯🇵", continent: "Asia", rating: 900 }
];

const OPPONENTS = [
  { name: "Rafael Torres", country: "Brasil", flag: "🇧🇷", rating: 780, avatar: "♙" },
  { name: "Ana Costa", country: "Brasil", flag: "🇧🇷", rating: 850, avatar: "♕" },
  { name: "Miguel Santos", country: "Argentina", flag: "🇦🇷", rating: 910, avatar: "♘" },
  { name: "Sofia Miller", country: "Estados Unidos", flag: "🇺🇸", rating: 1040, avatar: "♖" },
  { name: "Hugo Bernard", country: "Franca", flag: "🇫🇷", rating: 1180, avatar: "♔" },
  { name: "Arjun Mehta", country: "India", flag: "🇮🇳", rating: 1320, avatar: "♛" },
  { name: "Chen Wei", country: "China", flag: "🇨🇳", rating: 1450, avatar: "♜" },
  { name: "Lukas Weber", country: "Alemanha", flag: "🇩🇪", rating: 1580, avatar: "♚" }
];

const TOURNAMENTS = [
  { id: "local_amateur", name: "Liga Local Amador", level: "Amador", minRating: 0, prize: 45, title: 0, scope: "local" },
  { id: "national_pro", name: "Circuito Nacional Profissional", level: "Profissional", minRating: 900, prize: 70, title: 1, scope: "nacional" },
  { id: "continental", name: "Copa Continental", level: "Continental", minRating: 1050, prize: 95, title: 1, scope: "continental" },
  { id: "world", name: "Campeonato Mundial", level: "Mundial", minRating: 1250, prize: 130, title: 2, scope: "mundial" }
];

let profile = null;
let selectedAvatar = AVATARS[0];
let currentTournament = TOURNAMENTS[0];
let currentOpponent = OPPONENTS[0];
let chess = null;
let playerColor = "w";
let selectedSquare = null;
let legalTargets = [];
let pieces = new Map();
let squareMeshes = new Map();
let highlightMeshes = [];
let animations = [];
let boardReady = false;
let aiThinking = false;
let cameraAngle = Math.PI / 4;
let autoRotateCamera = false;

let renderer, scene, camera, raycaster, pointer, boardGroup, pieceGroup, lightRig;
const canvas = document.getElementById("gameCanvas");

const $ = (id) => document.getElementById(id);

function safeChessMethods(game) {
  return {
    isGameOver: () => typeof game.game_over === "function" ? game.game_over() : game.isGameOver(),
    isCheck: () => typeof game.in_check === "function" ? game.in_check() : game.isCheck(),
    isCheckmate: () => typeof game.in_checkmate === "function" ? game.in_checkmate() : game.isCheckmate(),
    isDraw: () => typeof game.in_draw === "function" ? game.in_draw() : game.isDraw(),
    fen: () => game.fen(),
    turn: () => game.turn()
  };
}

const GameState = {
  gameId: null,
  localMode: true,
  createGame() {
    this.gameId = "local-" + Date.now();
    console.log("[Firebase futuro] createGame criaria uma sala remota com FEN inicial.");
    return this.gameId;
  },
  joinGame(gameId) {
    this.gameId = gameId;
    console.log("[Firebase futuro] joinGame entraria na sala:", gameId);
  },
  sendMove(move) {
    console.log("[Firebase futuro] sendMove sincronizaria a jogada:", move);
  },
  onGameUpdate(callback) {
    console.log("[Firebase futuro] onGameUpdate escutaria mudancas do banco.");
    this._callback = callback;
  }
};

function init() {
  $("buildInfo").textContent = BUILD.label;
  hydrateProfileScreen();
  loadProfile();
  bindUI();
  showScreen(profile ? "lobbyScreen" : "profileScreen");
  if (profile) renderLobby();
}

function hydrateProfileScreen() {
  const countrySelect = $("playerCountry");
  countrySelect.innerHTML = COUNTRIES.map(c => `<option value="${c.name}">${c.flag} ${c.name}</option>`).join("");
  const grid = $("avatarGrid");
  grid.innerHTML = "";
  AVATARS.forEach((avatar, idx) => {
    const btn = document.createElement("button");
    btn.className = "avatar-option" + (idx === 0 ? " active" : "");
    btn.textContent = avatar;
    btn.addEventListener("click", () => {
      selectedAvatar = avatar;
      document.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
    grid.appendChild(btn);
  });
}

function bindUI() {
  $("startCareerBtn").addEventListener("click", createProfile);
  $("resetProfileBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    profile = null;
    showScreen("profileScreen");
  });
  $("resetGameBtn").addEventListener("click", () => startMatch(currentTournament));
  $("backLobbyBtn").addEventListener("click", () => { showScreen("lobbyScreen"); renderLobby(); });
  $("cameraBtn").addEventListener("click", () => autoRotateCamera = !autoRotateCamera);
  window.addEventListener("resize", resizeRenderer);
}

function createProfile() {
  const name = ($("playerName").value || "Novo Mestre").trim().slice(0, 18);
  const countryName = $("playerCountry").value;
  const country = COUNTRIES.find(c => c.name === countryName) || COUNTRIES[0];
  profile = { name, country: country.name, flag: country.flag, continent: country.continent, avatar: selectedAvatar, rating: 800, titles: 0, wins: 0, losses: 0 };
  saveProfile();
  renderLobby();
  showScreen("lobbyScreen");
}

function loadProfile() {
  try { profile = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { profile = null; }
}

function saveProfile() { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }

function renderLobby() {
  if (!profile) return;
  $("lobbyAvatar").textContent = profile.avatar;
  $("lobbyName").textContent = profile.name;
  $("lobbyCountry").textContent = `${profile.flag} ${profile.country}`;
  $("ratingValue").textContent = profile.rating;
  $("titlesValue").textContent = profile.titles;
  $("divisionValue").textContent = profile.rating >= 1250 ? "Mundial" : profile.rating >= 1050 ? "Continental" : profile.rating >= 900 ? "Profissional" : "Amador";
  const list = $("tournamentList");
  list.innerHTML = "";
  TOURNAMENTS.forEach(t => {
    const locked = profile.rating < t.minRating;
    const card = document.createElement("div");
    card.className = "tournament-card" + (locked ? " locked" : "");
    card.innerHTML = `<h3>${t.name}</h3><p>Nivel: ${t.level} | Rating minimo: ${t.minRating}</p><p>Premio: +${t.prize} rating | Titulos: +${t.title}</p>`;
    const btn = document.createElement("button");
    btn.className = locked ? "ghost-btn" : "primary-btn";
    btn.textContent = locked ? "Bloqueado" : "Jogar campeonato";
    btn.disabled = locked;
    btn.addEventListener("click", () => startMatch(t));
    card.appendChild(btn);
    list.appendChild(card);
  });
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  if (id === "gameScreen") setTimeout(resizeRenderer, 40);
}

function pickOpponent(tournament) {
  const base = profile.rating + (tournament.minRating / 4);
  const sorted = [...OPPONENTS].sort((a, b) => Math.abs(a.rating - base) - Math.abs(b.rating - base));
  return sorted[Math.min(sorted.length - 1, Math.floor(Math.random() * 3))];
}

function startMatch(tournament) {
  currentTournament = tournament;
  currentOpponent = pickOpponent(tournament);
  showScreen("gameScreen");
  $("matchTitle").textContent = tournament.name;
  $("userAvatarMini").textContent = profile.avatar;
  $("userNameMini").textContent = profile.name;
  $("userCountryMini").textContent = `${profile.flag} ${profile.country}`;
  $("botAvatarMini").textContent = currentOpponent.avatar;
  $("botNameMini").textContent = currentOpponent.name;
  $("botCountryMini").textContent = `${currentOpponent.flag} ${currentOpponent.country}`;
  $("moveHistory").innerHTML = "";
  GameState.createGame();
  setupChess();
  setupThreeIfNeeded();
  buildBoard();
  syncPiecesFromGame(true);
  updateStatus();
}

function setupChess() {
  if (typeof Chess === "undefined") {
    $("statusBox").textContent = "Erro: motor de xadrez nao carregou. Reenvie os arquivos da build completa.";
    return;
  }
  chess = new Chess();
  finishMatch._done = false;
  selectedSquare = null;
  legalTargets = [];
  aiThinking = false;
}

function setupThreeIfNeeded() {
  if (renderer || typeof THREE === "undefined") return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07111f);
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  boardGroup = new THREE.Group();
  pieceGroup = new THREE.Group();
  lightRig = new THREE.Group();
  scene.add(boardGroup, pieceGroup, lightRig);

  const ambient = new THREE.AmbientLight(0xffffff, 0.64);
  const directional = new THREE.DirectionalLight(0xffffff, 1.4);
  directional.position.set(5, 8, 4);
  lightRig.add(ambient, directional);

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerDrag, { passive: false });
  canvas.addEventListener("pointerup", () => dragging = false);
  resizeRenderer();
  animate();
  $("loadingOverlay").style.display = "none";
}

let dragging = false;
let lastX = 0;
function onPointerDrag(event) {
  if (!dragging) return;
  const dx = event.clientX - lastX;
  lastX = event.clientX;
  cameraAngle += dx * 0.006;
  updateCamera();
}

function updateCamera() {
  const r = 8.5;
  camera.position.set(Math.cos(cameraAngle) * r, 7.1, Math.sin(cameraAngle) * r);
  camera.lookAt(0, 0, 0);
}

function resizeRenderer() {
  if (!renderer) return;
  const wrap = $("canvasWrap");
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  updateCamera();
}

function buildBoard() {
  if (!scene) return;
  boardGroup.clear();
  squareMeshes.clear();
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x435071, roughness: 0.72 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xd8c292, roughness: 0.65 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1b273d, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.28, 8.6), edgeMat);
  base.position.y = -0.18;
  boardGroup.add(base);
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const square = fileRankToSquare(f, r);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.98), (f + r) % 2 === 0 ? lightMat : darkMat);
      const pos = squareToPosition(square);
      mesh.position.set(pos.x, 0, pos.z);
      mesh.userData = { type: "square", square };
      boardGroup.add(mesh);
      squareMeshes.set(square, mesh);
    }
  }
  boardReady = true;
}

function createPieceMesh(piece) {
  const group = new THREE.Group();
  const white = piece.color === "w";
  const mat = new THREE.MeshStandardMaterial({ color: white ? 0xf4eee2 : 0x1b2030, roughness: 0.58, metalness: 0.08 });
  const accent = new THREE.MeshStandardMaterial({ color: white ? 0xd6b160 : 0x6da8ff, roughness: 0.45, metalness: 0.18 });
  const add = (geo, m, y, scaleX = 1, scaleZ = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y;
    mesh.scale.x = scaleX;
    mesh.scale.z = scaleZ;
    mesh.castShadow = false;
    group.add(mesh);
  };
  add(new THREE.CylinderGeometry(0.33, 0.42, 0.15, 18), mat, 0.08);
  const t = piece.type;
  if (t === "p") {
    add(new THREE.CylinderGeometry(0.18, 0.28, 0.35, 16), mat, 0.32);
    add(new THREE.SphereGeometry(0.25, 16, 12), mat, 0.62);
  } else if (t === "r") {
    add(new THREE.CylinderGeometry(0.28, 0.33, 0.68, 6), mat, 0.43);
    add(new THREE.BoxGeometry(0.52, 0.16, 0.52), accent, 0.86);
  } else if (t === "n") {
    add(new THREE.CylinderGeometry(0.22, 0.32, 0.48, 14), mat, 0.34);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.45, 0.24), accent);
    head.position.set(0.08, 0.73, -0.04);
    head.rotation.z = -0.35;
    group.add(head);
  } else if (t === "b") {
    add(new THREE.CylinderGeometry(0.18, 0.32, 0.58, 18), mat, 0.38);
    add(new THREE.ConeGeometry(0.28, 0.48, 18), accent, 0.86);
  } else if (t === "q") {
    add(new THREE.CylinderGeometry(0.22, 0.35, 0.65, 18), mat, 0.42);
    add(new THREE.SphereGeometry(0.32, 16, 12), accent, 0.86);
    add(new THREE.ConeGeometry(0.18, 0.3, 16), accent, 1.16);
  } else if (t === "k") {
    add(new THREE.CylinderGeometry(0.24, 0.36, 0.72, 18), mat, 0.46);
    add(new THREE.BoxGeometry(0.16, 0.48, 0.16), accent, 1.02);
    add(new THREE.BoxGeometry(0.46, 0.14, 0.14), accent, 1.13);
  }
  group.userData = { type: "piece" };
  return group;
}

function syncPiecesFromGame(clearFirst = false) {
  if (!chess || !boardReady) return;
  if (clearFirst) {
    pieceGroup.clear();
    pieces.clear();
  }
  const board = chess.board();
  const existing = new Set();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      const square = fileRankToSquare(file, 7 - rank);
      existing.add(square);
      let mesh = pieces.get(square);
      if (!mesh) {
        mesh = createPieceMesh(piece);
        mesh.userData.square = square;
        mesh.userData.piece = piece;
        const pos = squareToPosition(square);
        mesh.position.set(pos.x, 0.08, pos.z);
        pieceGroup.add(mesh);
        pieces.set(square, mesh);
      }
    }
  }
  [...pieces.keys()].forEach(square => {
    if (!existing.has(square)) {
      const mesh = pieces.get(square);
      pieceGroup.remove(mesh);
      pieces.delete(square);
    }
  });
}

function onPointerDown(event) {
  event.preventDefault();
  dragging = true;
  lastX = event.clientX;
  if (!chess || aiThinking || animations.length) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const targets = [...pieces.values(), ...squareMeshes.values()];
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return;
  let obj = hit.object;
  while (obj.parent && !obj.userData.square && obj.parent !== scene) obj = obj.parent;
  const square = obj.userData.square;
  if (!square) return;
  handleSquare(square);
}

function handleSquare(square) {
  const methods = safeChessMethods(chess);
  if (methods.isGameOver() || methods.turn() !== playerColor) return;
  const piece = chess.get(square);
  if (selectedSquare && legalTargets.includes(square)) {
    makeMove(selectedSquare, square, true);
    return;
  }
  if (piece && piece.color === playerColor) {
    selectedSquare = square;
    legalTargets = chess.moves({ square, verbose: true }).map(m => m.to);
    drawHighlights(square, legalTargets);
  } else {
    selectedSquare = null;
    legalTargets = [];
    clearHighlights();
  }
}

function drawHighlights(from, targets) {
  clearHighlights();
  const selPos = squareToPosition(from);
  const sel = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.035, 32), new THREE.MeshBasicMaterial({ color: 0xf2c66d, transparent: true, opacity: 0.62 }));
  sel.position.set(selPos.x, 0.095, selPos.z);
  boardGroup.add(sel);
  highlightMeshes.push(sel);
  targets.forEach(sq => {
    const pos = squareToPosition(sq);
    const hasCapture = !!chess.get(sq);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(hasCapture ? 0.42 : 0.25, hasCapture ? 0.42 : 0.25, 0.04, 32), new THREE.MeshBasicMaterial({ color: hasCapture ? 0xff6b6b : 0x64e6a8, transparent: true, opacity: 0.72 }));
    mesh.position.set(pos.x, 0.12, pos.z);
    boardGroup.add(mesh);
    highlightMeshes.push(mesh);
  });
}

function clearHighlights() {
  highlightMeshes.forEach(m => boardGroup.remove(m));
  highlightMeshes = [];
}

function makeMove(from, to, byHuman) {
  const movingMesh = pieces.get(from);
  const capturedMesh = pieces.get(to);
  const move = chess.move({ from, to, promotion: "q" });
  if (!move) return false;
  GameState.sendMove(move);
  selectedSquare = null;
  legalTargets = [];
  clearHighlights();
  if (capturedMesh) {
    pieceGroup.remove(capturedMesh);
    pieces.delete(to);
  }
  if (movingMesh) {
    pieces.delete(from);
    pieces.set(to, movingMesh);
    movingMesh.userData.square = to;
    movingMesh.userData.piece = chess.get(to);
    animatePiece(movingMesh, squareToPosition(to));
  } else {
    syncPiecesFromGame(true);
  }
  addMoveToHistory(move);
  setTimeout(() => {
    syncPiecesFromGame(false);
    updateStatus();
    const methods = safeChessMethods(chess);
    if (!methods.isGameOver() && byHuman) scheduleAiMove();
  }, 340);
  return true;
}

function animatePiece(mesh, target) {
  animations.push({ mesh, from: mesh.position.clone(), to: new THREE.Vector3(target.x, 0.08, target.z), start: performance.now(), duration: 320 });
}

function scheduleAiMove() {
  aiThinking = true;
  updateStatus("CPU pensando...");
  setTimeout(() => {
    const moves = chess.moves({ verbose: true });
    if (!moves.length) { aiThinking = false; updateStatus(); return; }
    const move = chooseAiMove(moves);
    aiThinking = false;
    makeMove(move.from, move.to, false);
  }, 650);
}

function chooseAiMove(moves) {
  const captures = moves.filter(m => m.captured);
  const checks = moves.filter(m => m.san.includes("+"));
  const pool = checks.length ? checks : captures.length ? captures : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

function addMoveToHistory(move) {
  const li = document.createElement("li");
  li.textContent = `${move.color === "w" ? "Brancas" : "Pretas"}: ${move.san}`;
  $("moveHistory").appendChild(li);
  const panel = $("moveHistory").parentElement;
  panel.scrollTop = panel.scrollHeight;
}

function updateStatus(prefix) {
  if (!chess) return;
  const methods = safeChessMethods(chess);
  let text = prefix || `Turno: ${methods.turn() === "w" ? "Brancas" : "Pretas"}`;
  if (methods.isCheckmate()) {
    const whiteWon = methods.turn() === "b";
    text = whiteWon ? "Xeque-mate! Voce venceu." : "Xeque-mate! CPU venceu.";
    finishMatch(whiteWon);
  } else if (methods.isDraw()) {
    text = "Empate detectado.";
    finishMatch(false, true);
  } else if (methods.isCheck()) {
    text += " | Xeque!";
  }
  $("statusBox").textContent = text;
}

function finishMatch(userWon, draw = false) {
  if (!profile || finishMatch._done) return;
  finishMatch._done = true;
  setTimeout(() => { finishMatch._done = false; }, 1500);
  if (draw) {
    profile.rating += 10;
  } else if (userWon) {
    profile.rating += currentTournament.prize;
    profile.titles += currentTournament.title;
    profile.wins += 1;
  } else {
    profile.rating = Math.max(600, profile.rating - 25);
    profile.losses += 1;
  }
  saveProfile();
}

function fileRankToSquare(file, rankIndexFromWhite) {
  return "abcdefgh"[file] + (rankIndexFromWhite + 1);
}

function squareToPosition(square) {
  const file = "abcdefgh".indexOf(square[0]);
  const rank = parseInt(square[1], 10) - 1;
  return { x: file - 3.5, z: 3.5 - rank };
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  if (!renderer) return;
  if (autoRotateCamera) {
    cameraAngle += 0.004;
    updateCamera();
  }
  animations = animations.filter(anim => {
    const t = Math.min(1, (now - anim.start) / anim.duration);
    const lift = Math.sin(t * Math.PI) * 0.3;
    anim.mesh.position.lerpVectors(anim.from, anim.to, t);
    anim.mesh.position.y = 0.08 + lift;
    return t < 1;
  });
  pieceGroup.children.forEach((g) => { g.rotation.y += 0.0008; });
  renderer.render(scene, camera);
}

init();
