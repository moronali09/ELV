// bot.js
// Fixed: robust register/login detection and makes the bot occasionally jump while moving.
// Use only on servers you own or have explicit permission to test.

const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const mcDataLib = require('minecraft-data');

const cfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// silent console if requested
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

let registered = {};
try {
  if (fs.existsSync(regPath)) registered = JSON.parse(fs.readFileSync(regPath, 'utf8')) || {};
} catch (e) { registered = {}; }

function saveRegistered() {
  try { fs.writeFileSync(regPath, JSON.stringify(registered, null, 2)); } catch (e) {}
}

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

function listenForAuthResponse(bot, timeoutMs) {
  return new Promise((resolve) => {
    const onMessage = (jsonMsg) => {
      try {
        const txt = jsonMsg.toString().toLowerCase();
        // register success keywords
        if (/(registered|registration|successfully registered|you are registered)/i.test(txt)) {
          bot.removeListener('message', onMessage);
          return resolve({ type: 'registered', text: txt });
        }
        // login success keywords
        if (/(logged in|login successful|successfully logged in|you are now logged in|welcome back)/i.test(txt)) {
          bot.removeListener('message', onMessage);
          return resolve({ type: 'logged-in', text: txt });
        }
        // already registered keyword
        if (/(already registered|already have an account|user already registered)/i.test(txt)) {
          bot.removeListener('message', onMessage);
          return resolve({ type: 'already-registered', text: txt });
        }
        // wrong password / failed login
        if (/(incorrect|wrong password|invalid password|login failed)/i.test(txt)) {
          bot.removeListener('message', onMessage);
          return resolve({ type: 'auth-failed', text: txt });
        }
      } catch (e) {}
    };

    bot.on('message', onMessage);

    const to = setTimeout(() => {
      bot.removeListener('message', onMessage);
      resolve({ type: 'timeout' });
    }, timeoutMs || 8000);
  });
}

async function performAuthFlow(bot) {
  if (!cfg.authPlugin || !cfg.authPlugin.enabled) return 'no-auth';
  const username = bot.username;
  const pass = cfg.authPlugin.registerPassword || cfg.authPlugin.loginPassword || '';
  const cmdStyle = (cfg.authPlugin.commandStyle || 'authme').toLowerCase();
  const delayAfter = cfg.authPlugin.delayAfterSpawnMs || 5000;
  const timeoutMs = cfg.authPlugin.authResponseTimeoutMs || 10000;

  // wait after spawn for server messages to arrive
  await new Promise(r => setTimeout(r, delayAfter));

  // If not marked registered locally, try to register if allowed
  if (!registered[username] && cfg.authPlugin.autoRegister) {
    try {
      if (cmdStyle === 'authme') bot.chat(`/register ${pass} ${pass}`);
      else bot.chat(`/register ${pass}`);
    } catch (e) {}
    const res = await listenForAuthResponse(bot, timeoutMs);
    if (res.type === 'registered' || res.type === 'already-registered') {
      registered[username] = true;
      saveRegistered();
      // after register, attempt login if requested
      if (cfg.authPlugin.autoLogin) {
        try { bot.chat(`/login ${cfg.authPlugin.loginPassword || pass}`); } catch (e) {}
        const res2 = await listenForAuthResponse(bot, timeoutMs);
        if (res2.type === 'logged-in') return 'logged-in';
        if (res2.type === 'timeout') return 'registered-timeout';
        return res2.type;
      }
      return 'registered';
    }
    // if registration timed out or failed, try login if allowed
    if (cfg.authPlugin.autoLogin) {
      try { bot.chat(`/login ${cfg.authPlugin.loginPassword || pass}`); } catch (e) {}
      const resLogin = await listenForAuthResponse(bot, timeoutMs);
      if (resLogin.type === 'logged-in') return 'logged-in';
      if (resLogin.type === 'timeout') return 'login-timeout';
      return resLogin.type;
    }
    return res.type;
  }

  // Already registered locally -> try login if enabled
  if (registered[username] && cfg.authPlugin.autoLogin) {
    try { bot.chat(`/login ${cfg.authPlugin.loginPassword || pass}`); } catch (e) {}
    const res = await listenForAuthResponse(bot, timeoutMs);
    if (res.type === 'logged-in') return 'logged-in';
    return res.type;
  }

  // If not registered locally and autoRegister is false but autoLogin true, try login once
  if (!registered[username] && !cfg.authPlugin.autoRegister && cfg.authPlugin.autoLogin) {
    try { bot.chat(`/login ${cfg.authPlugin.loginPassword || pass}`); } catch (e) {}
    const res = await listenForAuthResponse(bot, timeoutMs);
    if (res.type === 'logged-in') return 'logged-in';
    return res.type;
  }

  return 'no-action';
}

function startStepMovement(bot) {
  const radius = (cfg.wander && cfg.wander.radius) || 6;
  const stepInterval = (cfg.wander && cfg.wander.stepIntervalMs) || 3000;
  const jumpChance = (cfg.wander && cfg.wander.jumpChancePerStep) || 0.2;
  const jumpHold = (cfg.wander && cfg.wander.jumpHoldMs) || 400;

  stopStepMovement(); // ensure cleared
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

      // maybe jump to mimic natural movement / overcome small blocks
      if (Math.random() < jumpChance) {
        try {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), jumpHold);
        } catch (e) {}
      }
    } catch (e) {}
  }, stepInterval);
}

function stopStepMovement() {
  try {
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
    if (botInstance && botInstance.pathfinder) {
      try { botInstance.pathfinder.setGoal(null); } catch (e) {}
    }
  } catch (e) {}
}

function startWanderCycle(bot) {
  if (!cfg.wander || !cfg.wander.enabled) return;
  stopWanderCycle();
  const cycleInterval = cfg.wander.cycleIntervalMs || 600000;
  const activeDuration = cfg.wander.activeDurationMs || 30000;

  cycleTimer = setInterval(() => {
    try {
      startStepMovement(bot);
      if (activeMoveTimer) clearTimeout(activeMoveTimer);
      activeMoveTimer = setTimeout(() => { stopStepMovement(); }, activeDuration);
    } catch (e) {}
  }, cycleInterval);

  // start first active period immediately
  startStepMovement(bot);
  if (activeMoveTimer) clearTimeout(activeMoveTimer);
  activeMoveTimer = setTimeout(() => { stopStepMovement(); }, activeDuration);
}

function stopWanderCycle() {
  try {
    if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
    if (activeMoveTimer) { clearTimeout(activeMoveTimer); activeMoveTimer = null; }
    stopStepMovement();
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

    bot.once('spawn', async () => {
      try {
        const mcData = mcDataLib(bot.version);
        const movements = new Movements(bot, mcData);
        // allow sprint/jump handling properly
        movements.shouldTryHarvest = false;
        bot.pathfinder.setMovements(movements);

        // perform auth flow and only after attempt start wandering
        try {
          const authResult = await performAuthFlow(bot);
          // small delay after auth to let server finalize state
          setTimeout(() => {
            startWanderCycle(bot);
          }, 1000);
        } catch (e) {
          // even if auth flow errors, still start wander
          setTimeout(() => startWanderCycle(bot), 1000);
        }
      } catch (e) {
        // fallback: start wander anyway
        setTimeout(() => startWanderCycle(bot), 1000);
      }
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

// start
createBot();
