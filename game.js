const availableUnits = [
    { cls: "Knight", hp: 50, atk: 15, def: 10 },
    { cls: "Archer", hp: 35, atk: 12, def: 5 },
    { cls: "Mage", hp: 30, atk: 18, def: 3 },
    null // Represents empty space
  ];
  
 let playerFormation = Array(9).fill(null); // 9 empty slots


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
  
  function createTeams() {
    playerTeam = [
      new Unit("Alice", "Knight", 50, 15, 10, 6), // front row
      new Unit("Bob", "Archer", 35, 12, 5, 4),   // middle
      new Unit("Celine", "Mage", 30, 18, 3, 1)   // back row
    ];
    enemyTeam = [
      new Unit("GoblinA", "Goblin", 40, 10, 4, 0),
      new Unit("GoblinB", "Goblin", 40, 10, 4, 3),
      new Unit("Ogre", "Ogre", 60, 20, 8, 8)
    ];
  }  
  
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
    createEnemyTeam();
    const result = simulateBattle(playerTeam, enemyTeam);
    renderGrid(playerTeam, "player-grid");
    renderGrid(enemyTeam, "enemy-grid");
    document.getElementById("result-text").textContent = result;
  }
 
  function createEnemyTeam() {
    enemyTeam = [
      new Unit("GoblinA", "Goblin", 40, 10, 4, 0),
      new Unit("GoblinB", "Goblin", 40, 10, 4, 3),
      new Unit("Ogre", "Ogre", 60, 20, 8, 8)
    ];
  }
  
  
  // Event listener is below this line
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("start-btn").addEventListener("click", startBattle);
    renderGrid([], "enemy-grid");
    renderGrid([], "player-grid", true); // Interactive player grid
  });
  
  