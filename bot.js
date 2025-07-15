const { createBot } = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const Vec3 = require('vec3');

const config = {
  host: 'tensionlage.aternos.me',
  port: 63085,
  username: 'ELV',
  version: '1.21.1',
  password: 'elvmoronby',
};

const missions = [
  { type: 'goto', position: Vec3(10, 65, -5) },
  { type: 'collect', item: 'oak_log', count: 5 },
  { type: 'fight', mob: 'zombie', count: 3 },
];

function getRandomMission() {
  return missions[Math.floor(Math.random() * missions.length)];
}

function startBot() {
  const bot = createBot(config);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  let currentMission;
  let stopFollow = false;

  bot.on('login', () => console.log('Logged in'));  
  bot.on('spawn', () => {
    if (config.password) {
      bot.chat(`/login ${config.password}`);
      console.log('Logged in with password');
    }
    scheduleStealthTasks(bot);
    assignMission();
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    if (message === 'follow me') {
      stopFollow = false;
      bot.chat('Following you...');
      bot.on('move', followPlayer);
    }
    if (message === 'stop') {
      stopFollow = true;
      bot.removeListener('move', followPlayer);
      bot.chat('Stopped following.');
    }
  });

  bot.on('error', err => console.log('Error:', err.message));
  bot.on('end', () => {
    console.log('Disconnected, reconnecting...');
    setTimeout(startBot, 5000);
  });

  async function assignMission() {
    currentMission = getRandomMission();
    console.log('Mission:', currentMission.type);
    executeMission(currentMission).then(() => {
      console.log('Mission complete');
      assignMission();
    });
  }

  async function executeMission(mission) {
    try {
      switch (mission.type) {
        case 'goto':
          await moveTo(bot, mission.position);
          break;
        case 'collect':
          await collectItems(bot, mission.item, mission.count);
          break;
        case 'fight':
          await fightMob(bot, mission.mob, mission.count);
          break;
      }
    } catch (err) {
      console.log('Mission failed, retrying next:', err.message);
    }
  }

  async function moveTo(bot, position) {
    bot.pathfinder.setMovements(new Movements(bot));
    return new Promise((resolve) => {
      const goal = new goals.GoalBlock(position.x, position.y, position.z);
      bot.pathfinder.goto(goal, (err) => {
        if (err) console.log('Path error:', err.message);
        else console.log('Arrived at', position);
        resolve();
      });
    });
  }

  async function collectItems(bot, item, count) {
    for (let i = 0; i < count; i++) {
      const block = bot.findBlock({ matching: b => b.name.includes(item), maxDistance: 64 });
      if (!block) return;
      await moveTo(bot, block.position);
      await bot.dig(block);
      console.log(`Collected ${i + 1}/${count}`);
    }
  }

  async function fightMob(bot, mobName, count) {
    for (let i = 0; i < count; i++) {
      const mob = bot.nearestEntity(e => e.name === mobName);
      if (!mob) return;
      await bot.pvp.attack(mob);
      console.log(`Defeated ${i + 1}/${count}`);
    }
  }

  function followPlayer() {
    if (stopFollow) return;
    const player = bot.players[bot.username]?.entity;
    if (!player) return;
    const { x, y, z } = player.position;
    bot.pathfinder.setMovements(new Movements(bot));
    bot.pathfinder.goto(new goals.GoalNear(x, y, z, 1));
  }

  function scheduleStealthTasks(bot) {
    setInterval(() => bot.setControlState('jump', true), 30000);
    setInterval(() => bot.chat('hello friends 😊'), 60000);
    setInterval(() => bot.chat('/eat'), 45000);
  }
}

startBot();
