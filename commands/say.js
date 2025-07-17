module.exports = {
  name: 'say',
  execute(bot, user, args) {
    const message = args.join(' ');
    if (!message) return bot.chat('Use: /say <message>');
    bot.chat(`📣 ${message}`);
  }
};
