const fs = require('fs');
const path = require('path');

function loadCommands(bot) {
  const commands = new Map();
  const folder = path.join(__dirname, '..', 'commands');
  fs.readdirSync(folder)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      const cmd = require(path.join(folder, file));
      commands.set(cmd.name, cmd);
    });
  return commands;
}

function handleCommand(bot, commands, username, message) {
  const args = message.split(/ +/);
  const name = args.shift();
  if (!commands.has(name)) return;
  try {
    commands.get(name).execute(bot, username, args);
  } catch (err) {
    bot.chat('⚠️ Command error.');
    console.error(err);
  }
}

module.exports = { loadCommands, handleCommand };
