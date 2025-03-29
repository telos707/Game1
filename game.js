const availableUnits = Object.values(unitPool).concat(null); // `null` = empty slot
 
const unitPool = {
  Knight: { cls: "Knight", hp: 50, atk: 15, def: 10, cost: 3 },
  Archer: { cls: "Archer", hp: 35, atk: 12, def: 5, cost: 2 },
  Mage:   { cls: "Mage",   hp: 30, atk: 18, def: 3, cost: 4 },
  Healer: { cls: "Healer", hp: 28, atk: 6,  def: 4, cost: 3 }
};
 
const UNIT_BUDGET = 9; // total unit value allowed per team

let playerFormation = Array(9).fill(null); // 9 empty slots

function createEnemyTeam() {
    enemyTeam = [];
    let budget = UNIT_BUDGET;
  
    const positions = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
  
    while (budget > 0 && enemyTeam.length < 9) {
      const unitDefs = Object.values(unitPool).filter(u => u.cost <= budget);
      if (unitDefs.length === 0) break;
  
      const unitDef = unitDefs[Math.floor(Math.random() * unitDefs.length)];
      const pos = positions.pop();
  
      enemyTeam.push(new Unit(
        unitDef.cls,
        unitDef.cls,
        unitDef.hp,
        unitDef.atk,
        unitDef.def,
        pos
      ));
  
      budget -= unitDef.cost;
    }
  }  

// Emoji by class
const emojiMap = {
    Knight: "🛡️",
    Archer: "🏹",
    Mage: "🔮",
    Goblin: "👺",
    Ogre: "👹"
  };
  
  class Unit {
    constructor(name, cls, hp, atk, def, position) {
      this.name = name;
      this.cls = cls;
      this.hp = hp;
      this.atk = atk;
      this.def = def;
      this.position = position;
      this.alive = true;
    }
  
    getEmoji() {
      return emojiMap[this.cls] || "❓";
    }
  }
  
  // Make teams global so we can re-render
  let playerTeam, enemyTeam;
  
  // Indexes 0–8 → positions:
  // [0][1][2]
  // [3][4][5]
  // [6][7][8]
  
  function renderGrid(team, containerId, isPlayer = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
  
    for (let i = 0; i < 9; i++) {
      const unit = team.find(u => u.position === i);
      const div = document.createElement("div");
      div.className = "unit";
  
      if (unit) {
        if (!unit.alive) div.classList.add("dead");
        div.innerHTML = `
          ${unit.getEmoji()}<br>
          ${unit.name}<br>
          HP: ${Math.max(0, unit.hp)}
        `;
      } else {
        div.classList.add("empty");
        div.textContent = "—";
      }
  
      if (isPlayer) {
        div.style.cursor = "pointer";
        div.addEventListener("click", () => handlePlacementClick(i));
        div.addEventListener("touchstart", () => handlePlacementClick(i));
      }
  
      container.appendChild(div);
    }
  }
 
  function handlePlacementClick(index) {
    let current = playerFormation[index];
  
    // Get next unit in cycle
    let nextIndex = 0;
    if (current) {
      let currentIdx = availableUnits.findIndex(
        u => u && u.cls === current.cls
      );
      nextIndex = (currentIdx + 1) % availableUnits.length;
    }
  
    const nextUnitDef = availableUnits[nextIndex];
    if (nextUnitDef) {
      playerFormation[index] = new Unit(
        nextUnitDef.cls,
        nextUnitDef.cls,
        nextUnitDef.hp,
        nextUnitDef.atk,
        nextUnitDef.def,
        index
      );
    } else {
      playerFormation[index] = null;
    }
  
    renderGrid(playerFormation.filter(Boolean), "player-grid", true);
  }
  
  function simulateBattle(playerTeam, enemyTeam) {
    while (playerTeam.some(u => u.alive) && enemyTeam.some(u => u.alive)) {
      for (let unit of playerTeam) {
        if (!unit.alive) continue;
        let target = enemyTeam.find(e => e.alive);
        if (target) {
          let damage = Math.max(0, unit.atk - target.def);
          target.hp -= damage;
          if (target.hp <= 0) target.alive = false;
        }
      }
      for (let unit of enemyTeam) {
        if (!unit.alive) continue;
        let target = playerTeam.find(p => p.alive);
        if (target) {
          let damage = Math.max(0, unit.atk - target.def);
          target.hp -= damage;
          if (target.hp <= 0) target.alive = false;
        }
      }
    }
  
    let playerAlive = playerTeam.some(u => u.alive);
    let enemyAlive = enemyTeam.some(u => u.alive);
    if (playerAlive && !enemyAlive) return "Player Wins!";
    if (!playerAlive && enemyAlive) return "Enemy Wins!";
    return "Draw";
  }
  
  function startBattle() {
    const team = playerFormation.filter(Boolean);
    if (team.length === 0) {
      alert("Place at least one unit!");
      return;
    }
  
    playerTeam = team;
    createEnemyTeam(); // now this happens at page load instead
    const result = simulateBattle(playerTeam, enemyTeam);
    renderGrid(playerTeam, "player-grid");
    renderGrid(enemyTeam, "enemy-grid");
    document.getElementById("result-text").textContent = result;
  }
    
  // Event listener is below this line
  document.addEventListener("DOMContentLoaded", () => {
    createEnemyTeam(); // 👈 create enemies right away
    renderGrid([], "player-grid", true); // interactive
    renderGrid(enemyTeam, "enemy-grid"); // render enemies
    document.getElementById("start-btn").addEventListener("click", startBattle);
  });
  
  
  