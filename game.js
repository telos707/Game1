// =============================
// game.js - Tactical RPG Engine
// =============================
// Table of Contents:
// 1. Constants & Game State
// 2. Emoji Map & Unit Definitions
// 3. Unit Class
// 4. Team Generation (Player & Enemy)
// 5. Grid Rendering & UI
// 6. Unit Pool Rendering (Draggable)
// 7. Drag & Drop Placement
// 8. Budget Tracking
// 9. Movement & Targeting Logic
// 10. Battle Simulation Logic
// 11. DOM Initialization

// =============================
// 1. Constants & Game State
// =============================

const GameState = {
  SETUP: "setup",
  BATTLE: "battle",
  ENDED: "ended",
  current: "setup",
  
  transitionTo(state) {
    this.current = state;
    document.body.dataset.gameState = state;
    
    // Hide/show elements based on state
    if (state === this.BATTLE) {
      document.getElementById("unit-pool-container").classList.add("hidden");
      document.getElementById("battle-controls").classList.remove("hidden");
      document.getElementById("battle-log-container").classList.remove("hidden");
    } else if (state === this.SETUP) {
      document.getElementById("unit-pool-container").classList.remove("hidden");
      document.getElementById("battle-controls").classList.add("hidden");
      document.getElementById("battle-log-container").classList.add("hidden");
    }
  }
};

// Grid dimensions and zones (columns 0,1,2 for player, 5,6,7 for enemy)
const UNIT_BUDGET = 12;
const GRID_WIDTH = 8;
const GRID_HEIGHT = 3;
const PLAYER_ZONE = [0, 1, 2];
const ENEMY_ZONE = [5, 6, 7];

// Game state tracking variables
let playerFormation = Array(GRID_WIDTH * GRID_HEIGHT).fill(null);
let enemyFormation = Array(GRID_WIDTH * GRID_HEIGHT).fill(null);
let playerTeam = [];
let enemyTeam = [];
let turnQueue = [];
let battleInProgress = false;

// =============================
// 2. Emoji Map & Unit Definitions
// =============================

const emojiMap = {
  Knight: "🛡️",
  Archer: "🏹",
  Mage: "🔮",
  Healer: "💖",
  Goblin: "👺",
  Ogre: "👹"
};

// Unit type definitions with stats and traits
const unitPool = {
  Knight: { 
    cls: "Knight", 
    hp: 50, 
    atk: 15, 
    def: 10, 
    rng: 1, 
    spd: 4, 
    cost: 3,
    trait: "Defender",
    traitDesc: "Takes reduced damage from ranged attacks"
  },
  Archer: { 
    cls: "Archer", 
    hp: 35, 
    atk: 12, 
    def: 5, 
    rng: 5, 
    spd: 1, 
    cost: 2,
    trait: "Sharpshooter",
    traitDesc: "Increased damage against low DEF targets"
  },
  Mage: { 
    cls: "Mage", 
    hp: 30, 
    atk: 6, 
    def: 3, 
    rng: 5, 
    spd: 2, 
    cost: 4,
    trait: "Arcane",
    traitDesc: "AOE damage to up to 2 targets"
  },
  Healer: { 
    cls: "Healer", 
    hp: 28, 
    atk: 4, 
    def: 4, 
    rng: 3, 
    spd: 2, 
    cost: 3,
    trait: "Support",
    traitDesc: "Heals allies for 10 HP"
  },
  Goblin: { 
    cls: "Goblin", 
    hp: 30, 
    atk: 10, 
    def: 3, 
    rng: 1, 
    spd: 3, 
    cost: 2,
    trait: "Swift",
    traitDesc: "High speed for early attacks"
  },
  Ogre: { 
    cls: "Ogre", 
    hp: 60, 
    atk: 20, 
    def: 8, 
    rng: 1, 
    spd: 2, 
    cost: 4,
    trait: "Brute",
    traitDesc: "High HP and ATK, but slower"
  }
};

// =============================
// 3. Unit Class
// =============================

class Unit {
  constructor(name, cls, hp, atk, def, rng, spd, position) {
    this.name = name;
    this.cls = cls;
    this.maxHp = hp;
    this.hp = hp;
    this.atk = atk;
    this.def = def;
    this.rng = rng;
    this.spd = spd;
    this.position = position;
    this.alive = true;
    this.trait = unitPool[cls].trait;
    this.traitDesc = unitPool[cls].traitDesc;
  }
  
  getEmoji() {
    return emojiMap[this.cls] || "❓";
  }
  
  getHealthPercentage() {
    return Math.floor((this.hp / this.maxHp) * 100);
  }
  
  takeDamage(amount, isRanged = false) {
    // Knights take less damage from ranged attacks
    if (this.cls === "Knight" && isRanged) {
      amount = Math.floor(amount * 0.7);
    }
    
    this.hp -= amount;
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }
  
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
}

// =============================
// 4. Team Generation
// =============================

function createEnemyTeam() {
  enemyTeam = [];
  enemyFormation = Array(GRID_WIDTH * GRID_HEIGHT).fill(null);
  let budget = UNIT_BUDGET;
  
  // Create array of all possible positions in enemy zone
  let positions = [0, 1, 2].flatMap(row => ENEMY_ZONE.map(col => row * GRID_WIDTH + col));
  positions = positions.sort(() => Math.random() - 0.5); // Shuffle positions

  // Add some variety to enemy composition
  const enemyOptions = ["Goblin", "Ogre"];
  if (Math.random() > 0.5) enemyOptions.push("Archer");
  
  // Place units until we run out of budget or positions
  while (budget > 0 && positions.length) {
    const validTypes = enemyOptions
      .map(type => unitPool[type])
      .filter(u => u && u.cost <= budget);
      
    if (!validTypes.length) break;
    
    const def = validTypes[Math.floor(Math.random() * validTypes.length)];
    const pos = positions.pop();
    const name = `${def.cls}_${pos}`;
    const unit = new Unit(name, def.cls, def.hp, def.atk, def.def, def.rng, def.spd, pos);
    
    enemyTeam.push(unit);
    enemyFormation[pos] = unit;
    budget -= def.cost;
  }
}

// =============================
// 5. Grid Rendering & UI
// =============================

function initializeGrid() {
  const container = document.getElementById("battle-grid");
  container.innerHTML = "";

  // Create grid cells
  for (let row = 0; row < GRID_HEIGHT; row++) {
    for (let col = 0; col < GRID_WIDTH; col++) {
      const index = row * GRID_WIDTH + col;
      const div = document.createElement("div");
      div.className = "unit";
      div.id = `grid-cell-${index}`;
      
      if (PLAYER_ZONE.includes(col)) div.classList.add("player-zone");
      if (ENEMY_ZONE.includes(col)) div.classList.add("enemy-zone");

      div.innerHTML = "—";
      div.classList.add("empty");

      // Setup drag & drop for player zone cells during setup phase
      if (PLAYER_ZONE.includes(col) && GameState.current === GameState.SETUP) {
        div.dataset.index = index;
        div.addEventListener("dragover", e => e.preventDefault());
        div.addEventListener("drop", handleDrop);
      }

      container.appendChild(div);
    }
  }
  
  updateGrid(playerFormation, enemyFormation);
}

/**
 * Updates the grid display with current formations. Renders dead units first,
 * then living units on top to ensure proper visual layering.
 */
function updateGrid(playerFormation, enemyFormation) {
  // Clear all cells first
  for (let index = 0; index < GRID_WIDTH * GRID_HEIGHT; index++) {
    const cell = document.getElementById(`grid-cell-${index}`);
    if (!cell) continue;
    
    cell.innerHTML = "—";
    cell.classList.add("empty");
    cell.classList.remove("dead");
    cell.title = "";
  }
  
  // First render dead units so they appear "behind" living units
  for (let index = 0; index < GRID_WIDTH * GRID_HEIGHT; index++) {
    const unit = playerFormation[index] || enemyFormation[index];
    if (!unit || unit.alive) continue;
    
    const cell = document.getElementById(`grid-cell-${index}`);
    if (!cell) continue;
    
    cell.innerHTML = `
      <div class="unit-icon">${unit.getEmoji()}</div>
      <div class="unit-name">${unit.name}</div>
      <div class="unit-hp">HP: 0/${unit.maxHp}</div>
    `;
    cell.classList.remove("empty");
    cell.classList.add("dead");
    cell.title = `${unit.cls} - ${unit.trait}: ${unit.traitDesc} (defeated)`;
  }
  
  // Then render living units on top
  for (let index = 0; index < GRID_WIDTH * GRID_HEIGHT; index++) {
    const unit = playerFormation[index] || enemyFormation[index];
    if (!unit || !unit.alive) continue;
    
    const cell = document.getElementById(`grid-cell-${index}`);
    if (!cell) continue;
    
    const healthPct = unit.getHealthPercentage();
    const barColor = healthPct > 60 ? "green" : healthPct > 30 ? "yellow" : "red";
    const healthBar = `<div class="health-bar"><div class="health-fill ${barColor}" style="width:${healthPct}%"></div></div>`;
    
    cell.innerHTML = `
      <div class="unit-icon">${unit.getEmoji()}</div>
      <div class="unit-name">${unit.name}</div>
      ${healthBar}
      <div class="unit-hp">HP: ${Math.max(0, unit.hp)}/${unit.maxHp}</div>
    `;
    cell.classList.remove("empty");
    cell.classList.remove("dead");
    cell.title = `${unit.cls} - ${unit.trait}: ${unit.traitDesc}`;
  }
}

/**
 * Temporarily adds a CSS class to a grid cell for visual effects
 */
function highlightCell(index, className, duration = 500) {
  const cell = document.getElementById(`grid-cell-${index}`);
  if (!cell) return;
  
  cell.classList.add(className);
  setTimeout(() => cell.classList.remove(className), duration);
}

/**
 * Displays a temporary floating message to the user
 */
function showMessage(message, duration = 2000) {
  const msgEl = document.getElementById("message");
  msgEl.textContent = message;
  msgEl.classList.add("visible");
  setTimeout(() => msgEl.classList.remove("visible"), duration);
}

// =============================
// 6. Unit Pool Rendering (Draggable)
// =============================

function renderUnitPool() {
  const container = document.getElementById("unit-pool");
  container.innerHTML = "";
  
  // Create draggable unit cards for each player unit type
  Object.entries(unitPool)
    .filter(([key]) => !["Goblin", "Ogre"].includes(key)) // Only player units
    .forEach(([key, def]) => {
      const div = document.createElement("div");
      div.className = "unit draggable";
      div.draggable = true;
      div.innerHTML = `
        <div class="unit-icon">${emojiMap[def.cls]}</div>
        <div class="unit-name">${def.cls}</div>
        <div class="unit-trait">${def.trait}</div>
        <div class="unit-cost">💰 ${def.cost}</div>
        <div class="unit-stats">
          HP: ${def.hp} | ATK: ${def.atk} | DEF: ${def.def}
          <br>RNG: ${def.rng} | SPD: ${def.spd}
        </div>
      `;
      div.title = def.traitDesc;
      div.dataset.unitType = def.cls;
      div.addEventListener("dragstart", e => e.dataTransfer.setData("unitType", def.cls));
      container.appendChild(div);
    });
}

// =============================
// 7. Drag & Drop Placement
// =============================

function handleDrop(e) {
  e.preventDefault();
  const index = parseInt(e.currentTarget.dataset.index);
  const unitType = e.dataTransfer.getData("unitType");
  const def = unitPool[unitType];
  if (!def) return;

  // Remove unit if already exists at this position
  if (playerFormation[index]) {
    playerFormation[index] = null;
  }

  // Create new unit
  const name = `${unitType}_${index}`;
  const newUnit = new Unit(name, unitType, def.hp, def.atk, def.def, def.rng, def.spd, index);
  
  // Check if placement would exceed budget
  const testFormation = [...playerFormation];
  testFormation[index] = newUnit;
  const cost = calculateTeamCost(testFormation);
  
  if (cost > UNIT_BUDGET) {
    showMessage("🚫 Over budget!");
    return;
  }

  // Apply changes
  playerFormation[index] = newUnit;
  updateGrid(playerFormation, enemyFormation);
  updateBudgetUI();
}

// =============================
// 8. Budget Tracking
// =============================

/**
 * Calculates the total cost of units in a formation based on their unit type
 */
function calculateTeamCost(formation) {
  return formation.reduce((total, unit) => {
    if (!unit) return total;
    return total + unitPool[unit.cls].cost;
  }, 0);
}

/**
 * Updates the UI to display current team cost vs. budget
 */
function updateBudgetUI() {
  const current = calculateTeamCost(playerFormation);
  document.getElementById("budget-count").textContent = `${current} / ${UNIT_BUDGET}`;
}

// =============================
// 9. Movement & Targeting Logic
// =============================

/**
 * Calculates Manhattan distance between two grid positions
 * Position format: (row * GRID_WIDTH + column)
 */
function getDistance(p1, p2) {
  if (p1 == null || p2 == null) return Infinity;
  const r1 = Math.floor(p1 / GRID_WIDTH), c1 = p1 % GRID_WIDTH;
  const r2 = Math.floor(p2 / GRID_WIDTH), c2 = p2 % GRID_WIDTH;
  return Math.abs(r1 - r2) + Math.abs(c1 - c2); // Manhattan distance
}

/**
 * Determines the best move and target for a unit based on its abilities and position
 * Returns an object containing:
 * - target: The best target to attack (if any)
 * - newPosition: The position to move to
 * - oldPosition: The original position before movement
 */
/**
 * Enhanced findMoveAndTarget function with improved flanking logic for melee units
 */
function findMoveAndTarget(unit, enemies) {
  // Early check - if enemies are already in range, no need to move
  const inRangeEnemies = enemies
    .filter(e => e && e.alive && getDistance(unit.position, e.position) <= unit.rng);
  
  if (inRangeEnemies.length > 0) {
    return {
      target: findBestTarget(unit, enemies),
      newPosition: unit.position,
      oldPosition: unit.position
    };
  }
  
  // If no enemies in range, find valid targets
  const liveEnemies = enemies.filter(e => e && e.alive);
  if (liveEnemies.length === 0) {
    return { target: null, newPosition: unit.position, oldPosition: unit.position };
  }
  
  // Sort enemies by distance to prioritize closest ones
  const sortedEnemies = [...liveEnemies].sort((a, b) => 
    getDistance(unit.position, a.position) - getDistance(unit.position, b.position)
  );
  
  const closestEnemy = sortedEnemies[0];
  const oldPosition = unit.position;
  
  // Get current positions
  const unitRow = Math.floor(unit.position / GRID_WIDTH);
  const unitCol = unit.position % GRID_WIDTH;
  const enemyRow = Math.floor(closestEnemy.position / GRID_WIDTH);
  const enemyCol = closestEnemy.position % GRID_WIDTH;
  
  // For melee units, explore all adjacent positions around the target
  if (unit.rng === 1) {
    // Calculate all potential adjacent positions to the enemy
    const adjacentPositions = [];
    
    // Check all 4 adjacent cells around the enemy
    [
      { row: enemyRow - 1, col: enemyCol }, // above
      { row: enemyRow + 1, col: enemyCol }, // below
      { row: enemyRow, col: enemyCol - 1 }, // left
      { row: enemyRow, col: enemyCol + 1 }  // right
    ].forEach(pos => {
      // Ensure position is valid
      if (pos.row >= 0 && pos.row < GRID_HEIGHT && 
          pos.col >= 0 && pos.col < GRID_WIDTH) {
        
        const positionIndex = pos.row * GRID_WIDTH + pos.col;
        adjacentPositions.push({
          row: pos.row,
          col: pos.col,
          index: positionIndex,
          // Calculate the distance from current unit to this position
          distance: getDistance(unit.position, positionIndex),
          // Check if the position is already occupied
          occupied: [...playerFormation, ...enemyFormation]
            .some(u => u && u.alive && u.position === positionIndex)
        });
      }
    });

    // Filter out occupied positions
    const validAdjacentPositions = adjacentPositions.filter(pos => !pos.occupied);
    
    if (validAdjacentPositions.length > 0) {
      // For flanking behavior:
      // 1. If there are other allied units adjacent to the enemy, try to take an open position 
      // 2. Otherwise, pick the closest available position
      
      // Check if there are any allied units adjacent to the enemy
      const alliedAdjacentUnits = (unit.cls === "Knight" || unit.cls === "Ogre") 
        ? playerFormation.filter(u => u && u.alive && getDistance(u.position, closestEnemy.position) === 1)
        : enemyFormation.filter(u => u && u.alive && getDistance(u.position, closestEnemy.position) === 1);
      
      let targetPosition;
      
      if (alliedAdjacentUnits.length > 0) {
        // If allies already adjacent, try to pick a flanking position
        // Find positions that form a "surround" pattern
        const existingPositions = alliedAdjacentUnits.map(u => {
          const row = Math.floor(u.position / GRID_WIDTH);
          const col = u.position % GRID_WIDTH;
          // Map position relative to enemy (above, below, left, right)
          if (row < enemyRow) return "above";
          if (row > enemyRow) return "below";
          if (col < enemyCol) return "left";
          if (col > enemyCol) return "right";
          return null;
        });
        
        // Prioritize positions that would complete a flanking maneuver
        const positionPriority = ["above", "below", "left", "right"]
          .filter(pos => !existingPositions.includes(pos));
        
        // Map position names to adjacent positions
        const positionMap = {
          "above": validAdjacentPositions.find(p => p.row < enemyRow && p.col === enemyCol),
          "below": validAdjacentPositions.find(p => p.row > enemyRow && p.col === enemyCol),
          "left": validAdjacentPositions.find(p => p.row === enemyRow && p.col < enemyCol),
          "right": validAdjacentPositions.find(p => p.row === enemyRow && p.col > enemyCol)
        };
        
        // Try to find a flanking position based on priority
        for (const pos of positionPriority) {
          if (positionMap[pos]) {
            targetPosition = positionMap[pos];
            break;
          }
        }
        
        // If no flanking position, just take closest available
        if (!targetPosition) {
          targetPosition = validAdjacentPositions
            .sort((a, b) => a.distance - b.distance)[0];
        }
      } else {
        // No allies adjacent yet, pick closest position
        targetPosition = validAdjacentPositions
          .sort((a, b) => a.distance - b.distance)[0];
      }
      
      // If we found a position, move towards it
      if (targetPosition) {
        // Calculate best step towards that position
        const stepOptions = [];
        
        // Check if we can move horizontally or vertically toward target position
        if (targetPosition.row !== unitRow) {
          stepOptions.push({
            row: unitRow + (targetPosition.row > unitRow ? 1 : -1),
            col: unitCol
          });
        }
        
        if (targetPosition.col !== unitCol) {
          stepOptions.push({
            row: unitRow,
            col: unitCol + (targetPosition.col > unitCol ? 1 : -1)
          });
        }
        
        // Filter to only valid steps (not occupied, in bounds)
        const validSteps = stepOptions.filter(step => {
          if (step.row < 0 || step.row >= GRID_HEIGHT || 
              step.col < 0 || step.col >= GRID_WIDTH) {
            return false;
          }
          
          const stepIndex = step.row * GRID_WIDTH + step.col;
          return ![...playerFormation, ...enemyFormation]
            .some(u => u && u.alive && u.position === stepIndex);
        });
        
        if (validSteps.length > 0) {
          // Sort by which step gets us closer to the target position
          const bestStep = validSteps.sort((a, b) => {
            const aDistance = Math.abs(a.row - targetPosition.row) + 
                              Math.abs(a.col - targetPosition.col);
            const bDistance = Math.abs(b.row - targetPosition.row) + 
                              Math.abs(b.col - targetPosition.col);
            return aDistance - bDistance;
          })[0];
          
          const newPosition = bestStep.row * GRID_WIDTH + bestStep.col;
          
          // Check if this position lets us attack
          unit.position = newPosition;
          const targetAfterMove = findBestTarget(unit, enemies);
          
          return {
            target: targetAfterMove,
            newPosition,
            oldPosition
          };
        }
      }
    }
  }
  
  // If we're not a melee unit or couldn't find a flanking position, 
  // fall back to simpler movement logic
  
  // Get all possible moves
  const possibleMoves = [];
  
  // Add straight moves
  if (unitRow < enemyRow) possibleMoves.push({ row: unitRow + 1, col: unitCol });
  else if (unitRow > enemyRow) possibleMoves.push({ row: unitRow - 1, col: unitCol });
  
  if (unitCol < enemyCol) possibleMoves.push({ row: unitRow, col: unitCol + 1 });
  else if (unitCol > enemyCol) possibleMoves.push({ row: unitRow, col: unitCol - 1 });
  
  // Filter out invalid moves
  const validMoves = possibleMoves.filter(move => {
    // Check bounds
    if (move.row < 0 || move.row >= GRID_HEIGHT || move.col < 0 || move.col >= GRID_WIDTH) {
      return false;
    }
    
    // Check if occupied
    const newPosition = move.row * GRID_WIDTH + move.col;
    const allUnits = [...playerFormation, ...enemyFormation].filter(u => u && u.alive);
    return !allUnits.some(u => u.position === newPosition);
  });
  
  if (validMoves.length === 0) {
    return { target: null, newPosition: unit.position, oldPosition };
  }
  
  // Choose the best move
  const bestMove = validMoves[0];
  const newPosition = bestMove.row * GRID_WIDTH + bestMove.col;
  
  // Move and see if we can now attack
  unit.position = newPosition;
  
  // Check if any enemies are now in range after moving
  const targetAfterMove = findBestTarget(unit, enemies);
  
  return { target: targetAfterMove, newPosition, oldPosition };
}

/**
 * Selects the best target for a unit to attack based on range, health and class-specific priorities
 */
function findBestTarget(unit, enemies) {
  // Filter units in range
  const inRangeEnemies = enemies
    .filter(e => e && e.alive && getDistance(unit.position, e.position) <= unit.rng);
  
  if (inRangeEnemies.length === 0) {
    return null;
  }
  
  // First sort by health to prioritize weaker targets
  const sortedByHealth = [...inRangeEnemies].sort((a, b) => a.hp - b.hp);
  
  // Then consider class-specific targeting priorities
  switch (unit.cls) {
    case "Archer":
      // Archers prioritize low defense targets
      const lowDefTargets = inRangeEnemies.filter(e => e.def < 5);
      if (lowDefTargets.length > 0) {
        return lowDefTargets.sort((a, b) => a.def - b.def)[0];
      }
      break;
    
    case "Mage":
      // Mages prioritize clustered targets for AOE potential
      // For now, just use health priority
      break;
      
    default:
      // For units like Knight and others, consider distance as secondary priority
      const closestLowHealth = [...sortedByHealth].sort((a, b) => {
        // If health difference is significant, prioritize by health
        if (Math.abs(a.hp - b.hp) > 10) {
          return a.hp - b.hp;
        }
        // Otherwise prioritize by distance
        return getDistance(unit.position, a.position) - getDistance(unit.position, b.position);
      });
      if (closestLowHealth.length > 0) {
        return closestLowHealth[0];
      }
  }
  
  // Default to lowest health target
  return sortedByHealth[0];
}

// =============================
// 10. Battle Simulation Logic
// =============================

// Ability handlers for different unit classes
const abilityHandlers = {
  Mage: (unit, allies, enemies) => {
    // First attempt to move closer to enemies to get them in range
    const { target, newPosition, oldPosition } = findMoveAndTarget(unit, enemies);
    
    // If we moved, update the formation arrays and log it
    if (newPosition !== oldPosition) {
      // Remove from old position
      if (playerFormation.includes(unit)) {
        playerFormation[oldPosition] = null;
        playerFormation[newPosition] = unit;
      } else {
        enemyFormation[oldPosition] = null;
        enemyFormation[newPosition] = unit;
      }
      
      log(`${unit.name} repositions from ${oldPosition} to ${newPosition}.`);
      highlightCell(oldPosition, "empty", 400);
      highlightCell(newPosition, "active", 400);
    }
    
    // Find targets in range for AOE attack - ensure we're checking range properly
    const inRangeEnemies = enemies
      .filter(e => e && e.alive && getDistance(unit.position, e.position) <= unit.rng);
    
    // Sort by proximity to prioritize closest targets first for AOE
    const targets = [...inRangeEnemies]
      .sort((a, b) => getDistance(unit.position, a.position) - getDistance(unit.position, b.position))
      .slice(0, 2); // AOE up to 2 targets
    
    if (targets.length) {
      targets.forEach(target => {
        const damage = Math.max(1, unit.atk - Math.floor(target.def / 2)); // Mages ignore half of DEF
        
        log(`${unit.name} casts spell on ${target.name} for ${damage} damage.`);
        target.takeDamage(damage, true);
        highlightCell(target.position, "damaged");
        
        if (!target.alive) {
          log(`💀 ${target.name} is defeated!`);
        }
      });
    } else {
      if (newPosition === oldPosition) {
        log(`${unit.name} has no targets in range.`);
      }
    }
  },
  
  Healer: (unit, allies, enemies) => {
    // Find the most injured ally
    const injuredAllies = allies
      .filter(a => a && a.alive && a.hp < a.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    
    let target = null;
    let newPosition = unit.position;
    let oldPosition = unit.position;
    
    // First check if any injured allies are already in range
    const inRangeInjured = injuredAllies
      .filter(a => getDistance(unit.position, a.position) <= unit.rng);
    
    if (inRangeInjured.length > 0) {
      // If allies are in range, no need to move
      target = inRangeInjured[0];
    } else if (injuredAllies.length > 0) {
      // If no injured allies in range, move toward the most injured ally
      const mostInjuredAlly = injuredAllies[0];
      
      // Calculate direction to move
      const unitRow = Math.floor(unit.position / GRID_WIDTH);
      const unitCol = unit.position % GRID_WIDTH;
      const allyRow = Math.floor(mostInjuredAlly.position / GRID_WIDTH);
      const allyCol = mostInjuredAlly.position % GRID_WIDTH;
      
      // Move one step toward the ally
      let newRow = unitRow;
      let newCol = unitCol;
      
      if (unitRow < allyRow) newRow++;
      else if (unitRow > allyRow) newRow--;
      
      if (unitCol < allyCol) newCol++;
      else if (unitCol > allyCol) newCol--;
      
      newPosition = newRow * GRID_WIDTH + newCol;
      
      // Check if the new position is occupied or out of bounds
      const allUnits = [...playerFormation, ...enemyFormation].filter(u => u && u.alive);
      const isOccupied = allUnits.some(u => u.position === newPosition);
      const isOutOfBounds = newRow < 0 || newRow >= GRID_HEIGHT || newCol < 0 || newCol >= GRID_WIDTH;
      
      if (isOccupied || isOutOfBounds) {
        // If occupied or out of bounds, don't move
        newPosition = unit.position;
      } else {
        // Move and see if we can now heal
        oldPosition = unit.position;
        unit.position = newPosition;
        
        // Check if any injured allies are now in range after moving
        const inRangeAfterMove = injuredAllies
          .filter(a => getDistance(unit.position, a.position) <= unit.rng);
        
        if (inRangeAfterMove.length > 0) {
          target = inRangeAfterMove[0];
        }
      }
    }
    
    // If we moved, update the formation arrays and log it
    if (newPosition !== oldPosition) {
      // Remove from old position
      if (playerFormation.includes(unit)) {
        playerFormation[oldPosition] = null;
        playerFormation[newPosition] = unit;
      } else {
        enemyFormation[oldPosition] = null;
        enemyFormation[newPosition] = unit;
      }
      
      log(`${unit.name} moves toward injured ally from position ${oldPosition} to ${newPosition}.`);
      highlightCell(oldPosition, "empty", 400);
      highlightCell(newPosition, "active", 400);
    }
    
    // Healing logic
    if (target) {
      const healAmount = 10;
      const oldHp = target.hp;
      
      target.heal(healAmount);
      
      log(`${unit.name} heals ${target.name} for ${target.hp - oldHp} HP.`);
      highlightCell(target.position, "healed");
    } else {
      if (newPosition === oldPosition) {
        log(`${unit.name} has no one to heal.`);
      }
    }
  },
  
  Archer: (unit, allies, enemies) => {
    // First attempt to move closer to enemies
    const { target, newPosition, oldPosition } = findMoveAndTarget(unit, enemies);
    
    // If we moved, update the formation arrays and log it
    if (newPosition !== oldPosition) {
      // Remove from old position
      if (playerFormation.includes(unit)) {
        playerFormation[oldPosition] = null;
        playerFormation[newPosition] = unit;
      } else {
        enemyFormation[oldPosition] = null;
        enemyFormation[newPosition] = unit;
      }
      
      log(`${unit.name} repositions from ${oldPosition} to ${newPosition}.`);
      highlightCell(oldPosition, "empty", 400);
      highlightCell(newPosition, "active", 400);
    }
    
    if (target) {
      // Archers deal more damage to low DEF targets
      let damage = Math.max(1, unit.atk - target.def);
      if (target.def < 5) {
        damage = Math.floor(damage * 1.5);
        log(`${unit.name} finds a weak spot on ${target.name}!`);
      }
      
      log(`${unit.name} shoots ${target.name} for ${damage} damage.`);
      target.takeDamage(damage, true);
      highlightCell(target.position, "damaged");
      
      if (!target.alive) {
        log(`💀 ${target.name} is defeated!`);
      }
    } else {
      if (newPosition === oldPosition) {
        log(`${unit.name} has no targets in range.`);
      }
    }
  },
  
  default: (unit, allies, enemies) => {
    // First attempt to move closer to enemies
    const { target, newPosition, oldPosition } = findMoveAndTarget(unit, enemies);
    
    // If we moved, update the formation arrays and log it
    if (newPosition !== oldPosition) {
      // Remove from old position
      if (playerFormation.includes(unit)) {
        playerFormation[oldPosition] = null;
        playerFormation[newPosition] = unit;
      } else {
        enemyFormation[oldPosition] = null;
        enemyFormation[newPosition] = unit;
      }
      
      log(`${unit.name} moves from position ${oldPosition} to ${newPosition}.`);
      highlightCell(oldPosition, "empty", 400);
      highlightCell(newPosition, "active", 400);
    }
    
    // Then attack if we have a target
    if (target) {
      const damage = Math.max(1, unit.atk - target.def);
      
      log(`${unit.name} attacks ${target.name} for ${damage} damage.`);
      target.takeDamage(damage);
      highlightCell(target.position, "damaged");
      
      if (!target.alive) {
        log(`💀 ${target.name} is defeated!`);
      }
    } else {
      if (newPosition === oldPosition) {
        log(`${unit.name} has no targets in range.`);
      }
    }
  }
};

/**
 * Adds a message to the battle log and auto-scrolls to the bottom
 */
function log(message) {
  const logDiv = document.getElementById("battle-log");
  const p = document.createElement("p");
  p.textContent = message;
  logDiv.appendChild(p);
  logDiv.scrollTop = logDiv.scrollHeight; // Auto-scroll
}

/**
 * Initiates the battle simulation if prerequisites are met
 */
function simulateBattle() {
  if (battleInProgress) return;
  
  // Clear previous state
  const logDiv = document.getElementById("battle-log");
  logDiv.innerHTML = "";
  document.getElementById("result-text").textContent = "";
  
  // Prepare units
  playerTeam = playerFormation.filter(u => u && u.alive);
  enemyTeam = enemyFormation.filter(u => u && u.alive);
  
  if (playerTeam.length === 0) {
    showMessage("⚠️ Please place at least one unit.");
    return;
  }
  
  // Transition to battle state
  GameState.transitionTo(GameState.BATTLE);
  
  // Build initial turn order based on speed
  let allUnits = [...playerTeam, ...enemyTeam];
  turnQueue = [...allUnits].sort((a, b) => b.spd - a.spd);
  
  log("🏆 Battle begins! Turn order:");
  turnQueue.forEach(unit => log(`${unit.name} (SPD: ${unit.spd})`));
  log("---");
  
  // Start the battle
  battleInProgress = true;
  battleStep();
}

/**
 * Processes a single turn in the battle simulation
 * This function is called recursively until battle ends
 */
function battleStep() {
  // Check victory conditions
  const playerAlive = playerFormation.some(u => u && u.alive);
  const enemyAlive = enemyFormation.some(u => u && u.alive);

  if (!playerAlive || !enemyAlive) {
    const result = playerAlive && !enemyAlive ? "Player Wins! 🎉" :
                    !playerAlive && enemyAlive ? "Enemy Wins! 😢" : "Draw! 🤝";
    document.getElementById("result-text").textContent = result;
    updateGrid(playerFormation, enemyFormation);
    log(`🏁 ${result}`);
    battleInProgress = false;
    document.getElementById("reset-btn").classList.remove("hidden");
    return;
  }

  // Get the current unit
  const attacker = turnQueue.shift();
  
  // Skip if unit is dead
  if (!attacker || !attacker.alive) {
    setTimeout(battleStep, 100);
    return;
  }

  // Highlight current unit
  highlightCell(attacker.position, "active", 800);

  // Determine allies and enemies
  const isPlayer = playerFormation.includes(attacker);
  const allies = isPlayer ? playerFormation : enemyFormation;
  const enemies = isPlayer ? enemyFormation : playerFormation;

  // Log whose turn it is
  log(`⚔️ ${attacker.name}'s turn (${attacker.cls})`);

  // Execute unit's ability
  const ability = abilityHandlers[attacker.cls] || abilityHandlers.default;
  ability(attacker, allies, enemies);

  // Put the unit at the end of the queue for next round
  turnQueue.push(attacker);

  // Update the UI
  updateGrid(playerFormation, enemyFormation);

  // Continue to next unit after a delay
  setTimeout(battleStep, 800);
}

/**
 * Resets the game state for a new game
 */
function resetGame() {
  playerFormation = Array(GRID_WIDTH * GRID_HEIGHT).fill(null);
  createEnemyTeam();
  GameState.transitionTo(GameState.SETUP);
  updateGrid(playerFormation, enemyFormation);
  updateBudgetUI();
  document.getElementById("reset-btn").classList.add("hidden");
  document.getElementById("result-text").textContent = "";
}

// =============================
// 11. DOM Initialization
// =============================

window.addEventListener("DOMContentLoaded", () => {
  // Initialize game components
  createEnemyTeam();
  initializeGrid();
  renderUnitPool();
  updateBudgetUI();
  
  // Event listeners
  document.getElementById("battle-btn").addEventListener("click", simulateBattle);
  document.getElementById("reset-btn").addEventListener("click", resetGame);
});