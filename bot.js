// bot.js
// Silent Mineflayer bot: optional register/login and occasional randomized movement cycles.
// Use only on servers you own or have explicit permission to test.

const fs = require('fs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const mcDataLib = require('minecraft-data');

const cfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Silence console output if requested
if (cfg.silent) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
}
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

let botInstance = null;
let reconnectAttempts = 0;
let cycleTimer = null;
let activeMoveTimer = null;
let stepTimer = null;

function createOptions() {
  return {
    host: cfg.host,
    port: cfg.port || 25565,
    username: cfg.username || 'Cleaner_bot',
    auth: cfg.auth || 'offline'
  };
}

function sendAuthCommands(bot) {
  if (!cfg.authPlugin || !cfg.authPlugin.enabled) return;
  const delay = cfg.authPlugin.delayAfterSpawnMs || 2000;
  setTimeout(() => {
    try {
      if (cfg.authPlugin.autoRegister && cfg.authPlugin.registerPassword) {
        if (cfg.authPlugin.commandStyle === 'authme') {
          bot.chat(`/register ${cfg.authPlugin.registerPassword} ${cfg.authPlugin.registerPassword}`);
        } else {
          bot.chat(`/register ${cfg.authPlugin.registerPassword}`);
        }
      }
      if (cfg.authPlugin.autoLogin && cfg.authPlugin.loginPassword) {
        // some servers need login after register or instead of register
        bot.chat(`/login ${cfg.authPlugin.loginPassword}`);
      }
    } catch (e) {}
  }, delay);
}

function startStepMovement(bot) {
  const radius = (cfg.wander && cfg.wander.radius) || 6;
  const stepInterval = (cfg.wander && cfg.wander.stepIntervalMs) || 3000;

  stepTimer = setInterval(() => {
    try {
      if (!bot.entity || !bot.entity.position) return;
      const pos = bot.entity.position;
      const dx = (Math.random() * 2 - 1) * radius;
      const dz = (Math.random() * 2 - 1) * radius;
      const tx = Math.floor(pos.x + dx);
      const tz = Math.floor(pos.z + dz);
      const ty = Math.floor(pos.y);
      const goal = new GoalNear(tx, ty, tz, 1);
      bot.pathfinder.setGoal(goal, true);
    } catch (e) {}
  }, stepInterval);
}

function stopStepMovement(bot) {
  try {
    if (stepTimer) {
      clearInterval(stepTimer);
      stepTimer = null;
    }
    if (bot && bot.pathfinder) {
      try { bot.pathfinder.setGoal(null); } catch (e) {}
    }
  } catch (e) {}
}

function startWanderCycle(bot) {
  if (!cfg.wander || !cfg.wander.enabled) return;
  const cycleInterval = cfg.wander.cycleIntervalMs || 600000; // default 10 minutes
  const activeDuration = cfg.wander.activeDurationMs || 30000; // default 30s

  // immediate possible first activation (optional: delay first cycle by cycleInterval)
  cycleTimer = setInterval(() => {
    try {
      // start active movement period
      startStepMovement(bot);
      if (activeMoveTimer) clearTimeout(activeMoveTimer);
      activeMoveTimer = setTimeout(() => {
        stopStepMovement(bot);
      }, activeDuration);
    } catch (e) {}
  }, cycleInterval);

  // kick off first cycle immediately (so bot doesn't wait cycleInterval before first movement)
  try {
    startStepMovement(bot);
    if (activeMoveTimer) clearTimeout(activeMoveTimer);
    activeMoveTimer = setTimeout(() => {
      stopStepMovement(bot);
    }, cfg.wander.activeDurationMs || 30000);
  } catch (e) {}
}

function stopWanderCycle(bot) {
  try {
    if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
    if (activeMoveTimer) { clearTimeout(activeMoveTimer); activeMoveTimer = null; }
    stopStepMovement(bot);
  } catch (e) {}
}

function cleanup(bot) {
  stopWanderCycle(bot);
  try { if (bot && bot._client) bot._client.end(); } catch (e) {}
}

function createBot() {
  if (botInstance) return;
  const options = createOptions();
  try {
    const bot = mineflayer.createBot(options);
    botInstance = bot;
    reconnectAttempts = 0;

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
      try {
        const mcData = mcDataLib(bot.version);
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);
        sendAuthCommands(bot);
        // start wander cycles after a small delay to allow auth to complete
        setTimeout(() => {
          startWanderCycle(bot);
        }, (cfg.authPlugin && cfg.authPlugin.delayAfterSpawnMs) ? cfg.authPlugin.delayAfterSpawnMs + 800 : 2000);
      } catch (e) {}
    });

    bot.on('kicked', () => {
      cleanup(bot);
      botInstance = null;
      tryReconnect();
    });

    bot.on('end', () => {
      cleanup(bot);
      botInstance = null;
      tryReconnect();
    });

    bot.on('error', () => {
      // silent
    });

    return bot;
  } catch (e) {
    botInstance = null;
    tryReconnect();
  }
}

function tryReconnect() {
  if (!cfg.reconnect || !cfg.reconnect.enabled) return;
  if (typeof cfg.reconnect.maxAttempts === 'number' && reconnectAttempts >= cfg.reconnect.maxAttempts) return;
  reconnectAttempts++;
  const delay = cfg.reconnect.delayMs || 8000;
  setTimeout(() => {
    if (!botInstance) createBot();
  }, delay);
}

// start
createBot();
