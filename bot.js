// bot.js
// Silent Mineflayer bot that registers once (persists to data/registered.json), then logs in on future joins and runs periodic wandering.
// Use only on servers you own or have explicit permission to test.

const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const mcDataLib = require('minecraft-data');

const cfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// silent if requested
if (cfg.silent) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
}
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const dataDir = cfg.dataDir || './data';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const regPath = path.join(dataDir, cfg.registeredFile || 'registered.json');

// load registered map
let registered = {};
try {
  if (fs.existsSync(regPath)) registered = JSON.parse(fs.readFileSync(regPath, 'utf8')) || {};
} catch (e) { registered = {}; }

let botInstance = null;
let reconnectAttempts = 0;
let cycleTimer = null;
let activeMoveTimer = null;
let stepTimer = null;

function saveRegistered() {
  try { fs.writeFileSync(regPath, JSON.stringify(registered, null, 2)); } catch (e) {}
}

function createOptions() {
  return {
    host: cfg.host,
    port: cfg.port || 25565,
    username: cfg.username || 'Cleaner_bot',
    auth: cfg.auth || 'offline'
  };
}

function sendRegisterThenLogin(bot, username) {
  if (!cfg.authPlugin || !cfg.authPlugin.enabled) return Promise.resolve('no-auth');
  return new Promise((resolve) => {
    const pass = cfg.authPlugin.registerPassword || cfg.authPlugin.loginPassword || '';
    const cmdStyle = (cfg.authPlugin.commandStyle || 'authme').toLowerCase();
    const delayAfter = cfg.authPlugin.delayAfterSpawnMs || 2000;
    const postAuthDelay = cfg.authPlugin.postAuthDelayMs || 1200;

    setTimeout(() => {
      try {
        if (!registered[username] && cfg.authPlugin.autoRegister) {
          if (cmdStyle === 'authme') {
            bot.chat(`/register ${pass} ${pass}`);
          } else {
            bot.chat(`/register ${pass}`);
          }
          // mark as registered locally (we assume register succeeded on servers you control)
          registered[username] = true;
          saveRegistered();
          // optional immediate login after register if requested
          if (cfg.authPlugin.autoLogin) {
            setTimeout(() => {
              try { bot.chat(`/login ${cfg.authPlugin.loginPassword || pass}`); } catch (e) {}
            }, postAuthDelay);
          }
          return resolve('registered');
        }

        if (registered[username] && cfg.authPlugin.autoLogin) {
          try { bot.chat(`/login ${cfg.authPlugin.loginPassword || pass}`); } catch (e) {}
          return resolve('logged-in');
        }

        // fallback: if not registered but autoRegister disabled, try login (some servers accept)
        if (!registered[username] && cfg.authPlugin.autoLogin) {
          try { bot.chat(`/login ${cfg.authPlugin.loginPassword || pass}`); } catch (e) {}
          return resolve('login-attempted');
        }

        return resolve('no-action');
      } catch (e) { return resolve('error'); }
    }, delayAfter);
  });
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
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
    if (bot && bot.pathfinder) {
      try { bot.pathfinder.setGoal(null); } catch (e) {}
    }
  } catch (e) {}
}

function startWanderCycle(bot) {
  if (!cfg.wander || !cfg.wander.enabled) return;
  stopWanderCycle(); // ensure no duplicates
  const cycleInterval = cfg.wander.cycleIntervalMs || 600000;
  const activeDuration = cfg.wander.activeDurationMs || 30000;

  cycleTimer = setInterval(() => {
    try {
      startStepMovement(bot);
      if (activeMoveTimer) clearTimeout(activeMoveTimer);
      activeMoveTimer = setTimeout(() => {
        stopStepMovement(bot);
      }, activeDuration);
    } catch (e) {}
  }, cycleInterval);

  // start first brief movement immediately
  try {
    startStepMovement(bot);
    if (activeMoveTimer) clearTimeout(activeMoveTimer);
    activeMoveTimer = setTimeout(() => {
      stopStepMovement(bot);
    }, cfg.wander.activeDurationMs || 30000);
  } catch (e) {}
}

function stopWanderCycle() {
  try {
    if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
    if (activeMoveTimer) { clearTimeout(activeMoveTimer); activeMoveTimer = null; }
    stopStepMovement(botInstance);
  } catch (e) {}
}

function cleanup(bot) {
  stopWanderCycle();
  try { if (bot && bot._client) bot._client.end(); } catch (e) {}
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

function createBot() {
  if (botInstance) return;
  const options = createOptions();
  try {
    const bot = mineflayer.createBot(options);
    botInstance = bot;
    reconnectAttempts = 0;
    bot.loadPlugin(pathfinder);

    let mcData = null;
    bot.once('spawn', async () => {
      try {
        mcData = mcDataLib(bot.version);
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);

        // auth flow: register once then login on future joins
        await sendRegisterThenLogin(bot, bot.username);

        // wait a bit for auth to settle, then start wander cycles
        const postDelay = (cfg.authPlugin && cfg.authPlugin.postAuthDelayMs) || 1200;
        setTimeout(() => {
          startWanderCycle(bot);
        }, postDelay + 800);
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

    bot.on('error', () => {});

    return bot;
  } catch (e) {
    botInstance = null;
    tryReconnect();
  }
}

// kick things off
createBot();
