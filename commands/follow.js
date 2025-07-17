const { goals } = require('mineflayer-pathfinder');

module.exports = {
  name: 'follow',
  execute(bot, user, args) {
    const target = bot.players[user]?.entity;
    if (!target) return bot.chat("Can't see you.");
    bot.chat(`➡️ Following ${user}`);
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);
  }
};
