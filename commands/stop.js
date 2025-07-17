module.exports = {
  name: 'stop',
  execute(bot) {
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();
    bot.chat('🛑 Stopped');
  }
};
