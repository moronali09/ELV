module.exports = {
  name: 'help',
  desc: 'Show this help message',
  execute(bot) {
    // Dynamic help from loaded commands
    bot.chat('🛠️ Available commands:');
    for (const cmd of bot.commands.values()) {
      bot.chat(`/${cmd.name}`);
    }
  }
};
