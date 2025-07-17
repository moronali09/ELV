const { goals } = require('mineflayer-pathfinder');

module.exports = {
  name: 'comehome',
  execute(bot) {
    if (!bot.homePosition) {
      return bot.chat('Home not set yet. Use /sethome first.');
    }
    const { x, y, z } = bot.homePosition;
    bot.chat(`↩️ Coming home to X:${x.toFixed(1)}, Y:${y.toFixed(1)}, Z:${z.toFixed(1)}`);
    bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z), true);
  }
};
