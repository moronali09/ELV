const fs = require('fs');
const path = require('path');
const { goals } = require('mineflayer-pathfinder');

module.exports = {
  name: 'comehome',
  execute(bot) {
    const filePath = path.join(__dirname, '..', 'save', 'home.json');
    if (!fs.existsSync(filePath)) {
      return bot.chat('❌ Home not set. Use /sethome first.');
    }
    const { x, y, z } = JSON.parse(fs.readFileSync(filePath));
    bot.chat('🏠 Coming home...');
    bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
  }
};

