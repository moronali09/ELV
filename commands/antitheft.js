const { goals } = require('mineflayer-pathfinder');
module.exports = {
  name: 'antitheft',
  execute(bot) {
    bot.chat('🛡️ Anti-theft mode ON');
    bot.on('playerCollect', (collector, itemDrop) => {
      if (collector.username !== bot.username) {
        bot.chat(`🔑 ${collector.username}, give back my item!`);
        const target = bot.players[collector.username]?.entity;
        if (target) {
          bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);
        }
      }
    });
  }
};
