module.exports = {
  name: 'help',
  desc: 'Show this help message',
  execute(bot) {
    bot.chat('🛠️ Available commands:');
    for (const cmd of bot.commands.values()) {
      bot.chat(`/${cmd.name}`);
    }
  }
};
