/**
 * ui.js
 * ---------------------------------------------------------------------------
 * DOM glue layer: renders the 9x9 board, wires up the control panel
 * (sample puzzles, solve, validate, clear, speed), and drives the animated
 * backtracking visualization using SudokuEngine.solveSteps().
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const SIZE = window.SUDOKU_SIZE || 9;
  const SPEED_MS = { 1: 120, 2: 45, 3: 8 }; // ms delay per animation frame

  let engine = new SudokuEngine();
  let isSolving = false;
  let cellRefs = []; // [row][col] -> <input> element

  // ---------------------------------------------------------------------
  // Board rendering
  // ---------------------------------------------------------------------

  function buildBoardDOM() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    cellRefs = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.maxLength = 1;
        input.className = 'sudoku-cell';
        input.dataset.row = r;
        input.dataset.col = c;
        input.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);

        input.addEventListener('input', (e) => onCellInput(e, r, c));
        input.addEventListener('keydown', (e) => onCellKeydown(e, r, c));

        boardEl.appendChild(input);
        cellRefs[r][c] = input;
      }
    }
  }

  function onCellInput(e, row, col) {
    if (isSolving) return;
    const raw = e.target.value.replace(/[^1-9]/g, '').slice(0, 1);
    e.target.value = raw;
    engine.board[row][col] = raw ? parseInt(raw, 10) : 0;
    engine._rebuildSetsFromBoard();
    clearCellStates();
    updateStats();
    setMessage('');
  }

  function onCellKeydown(e, row, col) {
    const moves = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const nr = Math.min(SIZE - 1, Math.max(0, row + dr));
      const nc = Math.min(SIZE - 1, Math.max(0, col + dc));
      cellRefs[nr][nc].focus();
    }
  }

  function renderBoard() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = engine.board[r][c];
        const el = cellRefs[r][c];
        el.value = val === 0 ? '' : String(val);
        el.classList.toggle('fixed', !!engine.fixedMask[r][c]);
      }
    }
  }

  function clearCellStates() {
    cellRefs.flat().forEach((el) =>
      el.classList.remove('solved', 'invalid', 'active-trial')
    );
  }

  // ---------------------------------------------------------------------
  // Stats + messaging
  // ---------------------------------------------------------------------

  function countFilled() {
    return engine.board.flat().filter((v) => v !== 0).length;
  }

  function updateStats() {
    document.getElementById('statFilled').textContent = `${countFilled()} / ${SIZE * SIZE}`;
    document.getElementById('statSteps').textContent = engine.steps;
  }

  function setStatus(text) {
    document.getElementById('statStatus').textContent = text;
  }

  function setMessage(text, type = '') {
    const el = document.getElementById('boardMessage');
    el.textContent = text;
    el.classList.remove('is-success', 'is-error');
    if (type) el.classList.add(type);
  }

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  function loadSample(difficulty) {
    if (!difficulty || !window.SAMPLE_PUZZLES[difficulty]) return;
    engine = new SudokuEngine(window.SAMPLE_PUZZLES[difficulty]);
    engine.lockCurrentAsFixed();
    renderBoard();
    clearCellStates();
    setStatus('Loaded');
    updateStats();
    setMessage(`Loaded a ${difficulty} puzzle. Press Solve to run the backtracking algorithm.`);
    document.getElementById('statTime').textContent = '—';
  }

  function clearBoard() {
    engine = new SudokuEngine();
    renderBoard();
    clearCellStates();
    setStatus('Idle');
    updateStats();
    setMessage('Board cleared.');
    document.getElementById('statTime').textContent = '—';
  }

  function validateBoard() {
    const conflicts = engine.findConflicts();
    clearCellStates();
    if (conflicts.length === 0) {
      setMessage('No conflicts found — current entries respect Sudoku rules.', 'is-success');
      setStatus('Valid');
    } else {
      conflicts.forEach(([r, c]) => cellRefs[r][c].classList.add('invalid'));
      setMessage(`Found ${conflicts.length} conflicting cell(s), highlighted in red.`, 'is-error');
      setStatus('Invalid');
    }
  }

  async function solveBoard() {
    if (isSolving) return;

    const conflicts = engine.findConflicts();
    if (conflicts.length > 0) {
      clearCellStates();
      conflicts.forEach(([r, c]) => cellRefs[r][c].classList.add('invalid'));
      setMessage('Cannot solve: the board has conflicting entries. Fix the highlighted cells first.', 'is-error');
      setStatus('Invalid');
      return;
    }

    if (countFilled() === SIZE * SIZE) {
      setMessage('Board is already full.', '');
      return;
    }

    isSolving = true;
    engine.lockCurrentAsFixed();
    engine.steps = 0;
    setStatus('Solving…');
    setMessage('Running recursive backtracking…');
    toggleControls(false);

    const speed = parseInt(document.getElementById('speedRange').value, 10);
    const delay = SPEED_MS[speed] ?? SPEED_MS[2];
    const start = performance.now();

    const iterator = engine.solveSteps();
    let result = iterator.next();

    while (!result.done) {
      const step = result.value;
      paintStep(step);
      updateStats();
      if (delay > 0) await sleep(delay);
      result = iterator.next();
    }

    const elapsedMs = (performance.now() - start).toFixed(1);
    document.getElementById('statTime').textContent = `${elapsedMs} ms`;

    clearCellStates();
    if (result.value === true || engine.findNextEmpty() === null) {
      renderBoard();
      markSolvedCells();
      setStatus('Solved');
      setMessage(`Solved in ${elapsedMs} ms after ${engine.steps} attempted placements.`, 'is-success');
    } else {
      setStatus('No solution');
      setMessage('This puzzle has no valid solution.', 'is-error');
    }

    updateStats();
    toggleControls(true);
    isSolving = false;
  }

  function paintStep(step) {
    if (step.type === 'place') {
      const el = cellRefs[step.row][step.col];
      el.value = step.val;
      el.classList.add('active-trial');
      el.classList.remove('invalid');
    } else if (step.type === 'backtrack') {
      const el = cellRefs[step.row][step.col];
      el.value = '';
      el.classList.remove('active-trial');
    }
  }

  function markSolvedCells() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!engine.fixedMask[r][c]) {
          cellRefs[r][c].classList.add('solved');
        }
      }
    }
  }

  function toggleControls(enabled) {
    ['solveBtn', 'validateBtn', 'clearBtn', 'sampleSelect'].forEach((id) => {
      document.getElementById(id).disabled = !enabled;
    });
    cellRefs.flat().forEach((el) => (el.disabled = !enabled));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------
  // Hero decorative mini-grid
  // ---------------------------------------------------------------------

  function buildHeroGrid() {
    const grid = document.getElementById('heroMiniGrid');
    if (!grid) return;
    const sample = window.SAMPLE_PUZZLES.easy;
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const div = document.createElement('div');
        div.className = 'cell';
        div.textContent = sample[r][c] === 0 ? '' : sample[r][c];
        div.style.animationDelay = `${(r * SIZE + c) * 12}ms`;
        grid.appendChild(div);
        cells.push(div);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------

  function init() {
    buildBoardDOM();
    renderBoard();
    updateStats();
    buildHeroGrid();

    document.getElementById('sampleSelect').addEventListener('change', (e) => {
      loadSample(e.target.value);
    });
    document.getElementById('solveBtn').addEventListener('click', solveBoard);
    document.getElementById('validateBtn').addEventListener('click', validateBoard);
    document.getElementById('clearBtn').addEventListener('click', clearBoard);

    const speedLabels = { 1: 'Slow', 2: 'Medium', 3: 'Fast' };
    const speedRange = document.getElementById('speedRange');
    speedRange.addEventListener('input', (e) => {
      document.getElementById('speedValue').textContent = speedLabels[e.target.value];
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
