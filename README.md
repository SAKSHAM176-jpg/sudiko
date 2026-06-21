# Sudoku Solver

An interactive Sudoku solver built from scratch with vanilla JavaScript, visualizing a **recursive backtracking algorithm** in real time on a fully playable 9×9 board.

This project was built to apply core data structures & algorithms concepts — recursion, backtracking, and hash-set based constraint validation — to a familiar, visual problem.

**[Live Demo →](#)** *(replace with your GitHub Pages link once deployed)*

---

## Features

- **Recursive backtracking solver** — finds a valid solution by trying digits, recursing, and undoing (backtracking) the moment a constraint is violated.
- **Real-time hash-set validation** — row, column, and 3×3 box constraints are checked in O(1) using JavaScript `Set` objects instead of repeatedly scanning the grid.
- **Interactive 9×9 board** — type digits directly into any cell; arrow-key navigation between cells; instant feedback on invalid entries.
- **Animated solve** — watch the algorithm place and backtrack digits step by step, with adjustable speed.
- **Conflict validation** — checks the current board for rule violations and highlights conflicting cells.
- **Live stats panel** — tracks cells filled, backtracking steps taken, and total solve time.
- **Sample puzzles** — three preloaded puzzles (easy / medium / hard) to try the solver immediately.

## Tech Stack

| Layer       | Technology              |
|-------------|--------------------------|
| Structure   | HTML5                   |
| Styling     | CSS3, Bootstrap 5       |
| Logic       | JavaScript (ES6+)       |
| Fonts       | Space Grotesk, JetBrains Mono |

No build tools, frameworks, or dependencies beyond Bootstrap — everything runs directly in the browser.

## How It Works

### 1. Recursive Backtracking

The solver scans for the next empty cell, tries each candidate digit `1–9`, and recurses into the next empty cell. If a branch leads to a dead end, it backtracks — undoing the last placement and trying the next candidate.

```js
function solve(grid) {
  const cell = findNextEmpty(grid);
  if (!cell) return true; // solved — no empty cells left

  const [row, col] = cell;
  for (let val = 1; val <= 9; val++) {
    if (isSafe(grid, row, col, val)) {
      place(grid, row, col, val);
      if (solve(grid)) return true;
      remove(grid, row, col, val); // backtrack
    }
  }
  return false; // triggers backtracking in the parent call
}
```

### 2. Hash-Set Constraint Validation

Every row, column, and 3×3 box maintains its own `Set` of digits already placed. Checking whether a digit is safe becomes an O(1) lookup against three sets, instead of re-scanning up to 27 cells on every attempt.

```js
const rowSets = Array.from({ length: 9 }, () => new Set());
const colSets = Array.from({ length: 9 }, () => new Set());
const boxSets = Array.from({ length: 9 }, () => new Set());

function isSafe(row, col, val) {
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  return !rowSets[row].has(val)
      && !colSets[col].has(val)
      && !boxSets[box].has(val);
}
```

## Complexity

| Approach                              | Time Complexity     | Notes                                              |
|----------------------------------------|----------------------|-----------------------------------------------------|
| Brute force                            | `O(9^81)`            | No pruning — explores every dead branch fully       |
| Recursive backtracking (this project)  | `O(9^m)` worst case* | `m` = empty cells; pruned aggressively in practice  |
| Constraint check per placement         | `O(1)`                | Hash-set lookup vs. O(n) row/column/box scan         |

\* Worst case remains exponential in theory, but constraint propagation from already-filled cells prunes the practical search tree dramatically for valid puzzles.

## Project Structure

```
sudoku-solver/
├── index.html          # Markup: hero, solver UI, algorithm explainer
├── css/
│   └── styles.css      # Design system + component styles
├── js/
│   ├── sudoku.js        # SudokuEngine: board model, validation, backtracking solver
│   └── ui.js            # DOM rendering, controls, animated solve loop
└── README.md
```

## Running Locally

No build step required.

```bash
git clone https://github.com/<your-username>/sudoku-solver.git
cd sudoku-solver
# then just open index.html in a browser, or serve it:
python3 -m http.server 8000
```

Visit `http://localhost:8000`.

## Roadmap / Possible Extensions

- [ ] Constraint propagation (naked singles / hidden singles) to reduce backtracking before falling back to brute search
- [ ] Puzzle generator with difficulty rating
- [ ] Step-by-step "explain this move" mode
- [ ] Local storage to save/resume a puzzle in progress

## License

This project is licensed under the [MIT License](LICENSE).

---

Built as a Data Structures & Algorithms project, Aug – Dec 2025.
