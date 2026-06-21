/**
 * sudoku.js
 * ---------------------------------------------------------------------------
 * Core Sudoku engine: board model, constraint validation, and the recursive
 * backtracking solver. Deliberately framework-free so the algorithm itself
 * stays the focus.
 *
 * Data structures used:
 *  - 9x9 array of numbers (0 = empty) as the board representation
 *  - Three arrays of Sets (rows, cols, boxes) for O(1) constraint lookups
 *  - Call stack (via recursion) as the implicit backtracking history
 * ---------------------------------------------------------------------------
 */

const SIZE = 9;
const BOX_SIZE = 3;
const EMPTY = 0;

/**
 * SudokuEngine wraps a 9x9 board plus the hash sets needed to validate
 * row / column / box constraints in O(1) instead of re-scanning cells.
 */
class SudokuEngine {
  constructor(initialBoard = null) {
    this.board = initialBoard
      ? initialBoard.map((row) => [...row])
      : Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));

    this.fixedMask = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

    // One hash set per row, column, and 3x3 box for O(1) "is this digit
    // already used here?" checks.
    this.rowSets = Array.from({ length: SIZE }, () => new Set());
    this.colSets = Array.from({ length: SIZE }, () => new Set());
    this.boxSets = Array.from({ length: SIZE }, () => new Set());

    this.steps = 0; // backtrack/attempt counter, surfaced in the UI

    this._rebuildSetsFromBoard();
  }

  static boxIndex(row, col) {
    return Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(col / BOX_SIZE);
  }

  /** Rebuilds the three hash-set layers from the current board state. */
  _rebuildSetsFromBoard() {
    this.rowSets = Array.from({ length: SIZE }, () => new Set());
    this.colSets = Array.from({ length: SIZE }, () => new Set());
    this.boxSets = Array.from({ length: SIZE }, () => new Set());

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = this.board[r][c];
        if (val !== EMPTY) {
          this.rowSets[r].add(val);
          this.colSets[c].add(val);
          this.boxSets[SudokuEngine.boxIndex(r, c)].add(val);
        }
      }
    }
  }

  /** Marks every currently-filled cell as a fixed clue (not solver-generated). */
  lockCurrentAsFixed() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        this.fixedMask[r][c] = this.board[r][c] !== EMPTY;
      }
    }
  }

  /**
   * O(1) constraint check: is `val` legal at (row, col) given what's
   * already placed in its row, column, and box?
   */
  isSafe(row, col, val) {
    return (
      !this.rowSets[row].has(val) &&
      !this.colSets[col].has(val) &&
      !this.boxSets[SudokuEngine.boxIndex(row, col)].has(val)
    );
  }

  /** Places a digit and updates all three hash sets in lockstep. */
  place(row, col, val) {
    this.board[row][col] = val;
    this.rowSets[row].add(val);
    this.colSets[col].add(val);
    this.boxSets[SudokuEngine.boxIndex(row, col)].add(val);
  }

  /** Removes a digit and updates all three hash sets — the "backtrack" step. */
  remove(row, col, val) {
    this.board[row][col] = EMPTY;
    this.rowSets[row].delete(val);
    this.colSets[col].delete(val);
    this.boxSets[SudokuEngine.boxIndex(row, col)].delete(val);
  }

  /** Finds the next empty cell in row-major order, or null if the board is full. */
  findNextEmpty() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (this.board[r][c] === EMPTY) return [r, c];
      }
    }
    return null;
  }

  /**
   * Checks the board as currently filled (including user input) for rule
   * violations — duplicate digits in any row, column, or box. Returns a
   * list of [row, col] conflicts (empty list = valid so far).
   */
  findConflicts() {
    const conflicts = [];
    const seenIn = (cells) => {
      const seen = new Map(); // value -> first [r,c] seen
      cells.forEach(([r, c]) => {
        const val = this.board[r][c];
        if (val === EMPTY) return;
        if (seen.has(val)) {
          conflicts.push([r, c]);
          conflicts.push(seen.get(val));
        } else {
          seen.set(val, [r, c]);
        }
      });
    };

    for (let i = 0; i < SIZE; i++) {
      seenIn(Array.from({ length: SIZE }, (_, j) => [i, j])); // row i
      seenIn(Array.from({ length: SIZE }, (_, j) => [j, i])); // col i
    }
    for (let br = 0; br < BOX_SIZE; br++) {
      for (let bc = 0; bc < BOX_SIZE; bc++) {
        const cells = [];
        for (let r = 0; r < BOX_SIZE; r++) {
          for (let c = 0; c < BOX_SIZE; c++) {
            cells.push([br * BOX_SIZE + r, bc * BOX_SIZE + c]);
          }
        }
        seenIn(cells);
      }
    }

    // de-duplicate
    const key = (rc) => `${rc[0]}-${rc[1]}`;
    const unique = new Map();
    conflicts.forEach((rc) => unique.set(key(rc), rc));
    return Array.from(unique.values());
  }

  /**
   * Synchronous recursive backtracking solve. Mutates this.board in place.
   * Returns true if a solution was found, false if the puzzle is unsolvable.
   *
   *   solve():
   *     find next empty cell; if none, the board is complete -> success
   *     for digit in 1..9:
   *       if digit is safe here:
   *         place digit
   *         if solve() succeeds, propagate success up the call stack
   *         otherwise remove digit (backtrack) and try the next candidate
   *     if no digit works, signal failure so the caller backtracks further
   */
  solve() {
    const next = this.findNextEmpty();
    if (!next) return true; // base case: no empty cells left

    const [row, col] = next;
    for (let val = 1; val <= SIZE; val++) {
      this.steps++;
      if (this.isSafe(row, col, val)) {
        this.place(row, col, val);
        if (this.solve()) return true;
        this.remove(row, col, val); // backtrack
      }
    }
    return false; // triggers backtracking in the parent call
  }

  /**
   * Async generator version of solve(), used by the UI to animate the
   * search. Yields after every placement and every backtrack so the
   * caller can paint the board and pause between steps.
   */
  * solveSteps() {
    const next = this.findNextEmpty();
    if (!next) {
      yield { type: 'solved' };
      return true;
    }

    const [row, col] = next;
    for (let val = 1; val <= SIZE; val++) {
      this.steps++;
      if (this.isSafe(row, col, val)) {
        this.place(row, col, val);
        yield { type: 'place', row, col, val, steps: this.steps };

        const result = yield* this.solveSteps();
        if (result) return true;

        this.remove(row, col, val);
        yield { type: 'backtrack', row, col, steps: this.steps };
      }
    }
    return false;
  }

  clone() {
    const copy = new SudokuEngine(this.board);
    copy.fixedMask = this.fixedMask.map((row) => [...row]);
    return copy;
  }
}

/** Sample puzzles (0 = empty), keyed by difficulty. */
const SAMPLE_PUZZLES = {
  easy: [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
  ],
  medium: [
    [0, 0, 0, 2, 6, 0, 7, 0, 1],
    [6, 8, 0, 0, 7, 0, 0, 9, 0],
    [1, 9, 0, 0, 0, 4, 5, 0, 0],
    [8, 2, 0, 1, 0, 0, 0, 4, 0],
    [0, 0, 4, 6, 0, 2, 9, 0, 0],
    [0, 5, 0, 0, 0, 3, 0, 2, 8],
    [0, 0, 9, 3, 0, 0, 0, 7, 4],
    [0, 4, 0, 0, 5, 0, 0, 3, 6],
    [7, 0, 3, 0, 1, 8, 0, 0, 0],
  ],
  hard: [
    [0, 0, 0, 6, 0, 0, 4, 0, 0],
    [7, 0, 0, 0, 0, 3, 6, 0, 0],
    [0, 0, 0, 0, 9, 1, 0, 8, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 5, 0, 1, 8, 0, 0, 0, 3],
    [0, 0, 0, 3, 0, 6, 0, 4, 5],
    [0, 4, 0, 2, 0, 0, 0, 6, 0],
    [9, 0, 3, 0, 0, 0, 0, 0, 0],
    [0, 2, 0, 0, 0, 0, 1, 0, 0],
  ],
};

// Exposed as globals for the UI layer (ui.js) since this is a
// dependency-free vanilla JS project (no bundler / module system).
window.SudokuEngine = SudokuEngine;
window.SAMPLE_PUZZLES = SAMPLE_PUZZLES;
window.SUDOKU_SIZE = SIZE;
