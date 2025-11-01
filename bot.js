// bot.js
// Silent "premium-like" Mineflayer bot — no console output, just join & wander.
// Use only on servers you own or have explicit permission to test.

const fs = require('fs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const mcDataLib = require('minecraft-data');
const Vec3 = require('vec3');

// silence all console output
console.log = () => {};
console.info = () => {};
console.warn = () => {};
console.error = () => {};
console.debug = () => {};

// guard against uncaught errors (silent)
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const cfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

let reconnectAttempts = 0;
let activeBot = null;

function pickUsername() {
  const list = Array.isArray(cfg.usernameList) && cfg.usernameList.length ? cfg.usernameList : ['SilentBot'];
  return list[Math.floor(Math.random() * list.length)];
}

function createBot() {
  const username = pickUsername();
  const options = {
    host: cfg.host,
    port: cfg.port || 25565,
    username,
    auth: cfg.auth || 'offline'
  };

  try {
    const bot = mineflayer.createBot(options);
    activeBot = bot;
    bot.loadPlugin(pathfinder);

    let wanderInterval = null;

    bot.once('spawn', () => {
      try {
        const mcData = mcDataLib(bot.version);
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);

        if (cfg.move && cfg.move.enabled) {
          const radius = cfg.move.radius || 6;
          const intervalMs = cfg.move.intervalMs || 3000;

          wanderInterval = setInterval(() => {
            try {
              if (!bot.entity || !bot.entity.position) return;
              const pos = bot.entity.position;
              const dx = (Math.random() * 2 - 1) * radius;
              const dz = (Math.random() * 2 - 1) * radius;
              const tx = Math.floor(pos.x + dx);
              const tz = Math.floor(pos.z + dz);
              const ty = Math.floor(pos.y); // approximate y; pathfinder will adapt
              const goal = new GoalNear(tx, ty, tz, 1);
              bot.pathfinder.setGoal(goal, true);
            } catch (er) {}
          }, intervalMs);
        }
      } catch (er) {}
    });

    // clean up intervals & optionally reconnect silently
    const cleanAndMaybeReconnect = () => {
      try {
        if (wanderInterval) {
          clearInterval(wanderInterval);
          wanderInterval = null;
        }
      } catch (er) {}
    };

    bot.on('end', () => {
      activeBot = null;
      cleanAndMaybeReconnect();
      silentReconnect();
    });

    bot.on('kicked', () => {
      activeBot = null;
      cleanAndMaybeReconnect();
      // Do not attempt aggressive rejoin after a kick — treat same as end.
      silentReconnect();
    });

    bot.on('error', () => {
      // swallow errors silently
    });

    return bot;
  } catch (e) {
    // swallow creation errors silently and attempt reconnect if configured
    silentReconnect();
  }
}

function silentReconnect() {
  if (!cfg.reconnect || !cfg.reconnect.enabled) return;
  if (cfg.reconnect.maxAttempts && reconnectAttempts >= cfg.reconnect.maxAttempts) return;
  reconnectAttempts++;
  const delay = cfg.reconnect.delayMs || 5000;
  setTimeout(() => {
    createBot();
  }, delay);
}

// start
createBot();
