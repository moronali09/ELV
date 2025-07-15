const fs = require('fs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const Vec3 = require('vec3');
const { Llama } = require('llama-cpp-node');

const llm = new Llama({
  model: 'models/ggml-model-q4_0.bin',
  n_ctx: 512,
});

async function askAI(prompt) {
  const response = await llm.createCompletion({ prompt, max_tokens: 128, temperature: 0.7 });
  return response.choices[0].text.trim();
}

function createGodBot(config) {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once('spawn', async () => {
    if (config.register?.enabled) {
      setTimeout(() => bot.chat(config.register.registerCommand), 2000);
      setTimeout(() => bot.chat(config.register.loginCommand), 5000);
    }
    bot.chat('Local AI initialized.');
    const mission = await askAI('You are a Minecraft AI. Give a challenging mission in one sentence.');
    bot.chat(`Mission: ${mission}`);
    planAndExecute(mission);
  });

  async function planAndExecute(mission) {
    const plan = await askAI(`Break down this mission into 5 sequential Minecraft tasks: ${mission}`);
    const steps = plan.split(/\r?\n/).filter(s => s.trim());
    for (const step of steps) {
      bot.chat(`Executing: ${step}`);
      await executeStep(step);
    }
    bot.chat('Mission accomplished!');
  }

  async function executeStep(step) {
    if (/collect (\d+) (\w+)/i.test(step)) {
      const [, count, item] = step.match(/collect (\d+) (\w+)/i);
      return collectItems(item, +count);
    }
    if (/go to (.+)/i.test(step)) {
      const target = step.match(/go to (.+)/i)[1];
      return navigateTo(target);
    }
    if (/fight (\d+) (\w+)/i.test(step)) {
      const [, num, mob] = step.match(/fight (\d+) (\w+)/i);
      return fightMob(mob, +num);
    }
    return bot.chat(`Step unclear: ${step}`);
  }

  async function navigateTo(destination) {
    const coordsText = await askAI(`Coordinates of ${destination} in format x y z:`);
    const [x, y, z] = coordsText.split(/\s+/).map(Number);
    const mcGoal = new goals.GoalBlock(x, y, z);
    bot.pathfinder.setMovements(new Movements(bot));
    return bot.pathfinder.goto(mcGoal);
  }

  async function collectItems(itemName, qty) {
    let collected = 0;
    while (collected < qty) {
      const block = bot.findBlock({ matching: b => b.name.includes(itemName), maxDistance: 64 });
      if (!block) {
        await bot.chat(`Searching for ${itemName}...`);
        await bot.pathfinder.goto(new goals.GoalNear(bot.entity.position.x + 10, bot.entity.position.y, bot.entity.position.z + 10, 1));
        continue;
      }
      await bot.pathfinder.goto(new goals.GoalBlock(block.position.x, block.position.y, block.position.z));
      await bot.dig(block);
      collected++;
      bot.chat(`Collected ${collected}/${qty} ${itemName}`);
    }
  }

  async function fightMob(mobName, count) {
    let defeated = 0;
    while (defeated < count) {
      const mob = bot.nearestEntity(e => e.name === mobName);
      if (!mob) {
        await bot.chat(`Looking for ${mobName}...`);
        await bot.pathfinder.goto(new goals.GoalNear(bot.entity.position.x + 5, bot.entity.position.y, bot.entity.position.z + 5, 2));
        continue;
      }
      await bot.pvp.attack(mob);
      defeated++;
      bot.chat(`Defeated ${defeated}/${count} ${mobName}`);
    }
  }

  bot.on('error', err => console.error(err));
  bot.on('end', () => console.log('Disconnected'));
}

// Load from config.json
const configFile = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
configFile.servers.forEach(cfg => createGodBot(cfg));
