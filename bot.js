const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const Vec3 = require('vec3');
const fs = require('fs');

// Load server configs
const configFile = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Predefined missions pool
const missions = [
  'collect 10 oak logs',
  'find and kill 5 zombies',
  'go to coordinates 0 64 0',
  'mine 5 diamonds',
  'build a shelter near your spawn'
];

function chooseMission() {
  const idx = Math.floor(Math.random() * missions.length);
  return missions[idx];
}

function parseStep(step) {
  if (/collect (\d+) (\w+)/i.test(step)) return { action: 'collect', count: +RegExp.$1, item: RegExp.$2 };
  if (/fight (\d+) (\w+)/i.test(step)) return { action: 'fight', count: +RegExp.$1, mob: RegExp.$2 };
  if (/go to coordinates ([-\d]+) (\d+) ([-\d]+)/i.test(step)) return { action: 'goto', x: +RegExp.$1, y: +RegExp.$2, z: +RegExp.$3 };
  if (/mine (\d+) (\w+)/i.test(step)) return { action: 'collect', count: +RegExp.$1, item: RegExp.$2 };
  return { action: 'chat', message: step };
}

async function executeStep(bot, step) {
  const task = parseStep(step);

  if (task.action === 'goto') {
    const mcGoal = new goals.GoalBlock(task.x, task.y, task.z);
    bot.pathfinder.setMovements(new Movements(bot));
    await bot.pathfinder.goto(mcGoal);
    bot.chat(`Reached ${task.x} ${task.y} ${task.z}`);
  }

  if (task.action === 'collect') {
    let collected = 0;
    while (collected < task.count) {
      const block = bot.findBlock({ matching: b => b.name.includes(task.item), maxDistance: 64 });
      if (!block) {
        bot.chat(`Searching for ${task.item}...`);
        await bot.pathfinder.goto(new goals.GoalNear(bot.entity.position, 10));
        continue;
      }
      await bot.pathfinder.goto(new goals.GoalBlock(block.position.x, block.position.y, block.position.z));
      await bot.dig(block);
      collected++;
      bot.chat(`Collected ${collected}/${task.count} ${task.item}`);
    }
  }

  if (task.action === 'fight') {
    let defeated = 0;
    while (defeated < task.count) {
      const mob = bot.nearestEntity(e => e.name === task.mob);
      if (!mob) {
        bot.chat(`Looking for ${task.mob}...`);
        await bot.pathfinder.goto(new goals.GoalNear(bot.entity.position, 10));
        continue;
      }
      await bot.pvp.attack(mob);
      defeated++;
      bot.chat(`Defeated ${defeated}/${task.count} ${task.mob}`);
    }
  }

  if (task.action === 'chat') {
    bot.chat(task.message);
  }
}

function createBotInstance(cfg) {
  const bot = mineflayer.createBot({
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    version: cfg.version,
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once('spawn', async () => {
    if (cfg.register?.enabled) {
      bot.chat(cfg.register.registerCommand);
      setTimeout(() => bot.chat(cfg.register.loginCommand), 2000);
    }
    const mission = chooseMission();
    bot.chat(`Mission: ${mission}`);
    await executeStep(bot, mission);
    bot.chat('Mission complete!');
    bot.quit();
  });

  bot.on('error', console.error);
  bot.on('end', () => console.log('Bot disconnected'));
}
