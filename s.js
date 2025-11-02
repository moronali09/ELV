const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const collectBlock = require('mineflayer-collectblock').plugin;
const autoeat = require('mineflayer-auto-eat');

let bot;

function createBot() {
    bot = mineflayer.createBot({
        host: 'sparrowcraft.aternos.me',
        port: 25519,
        username: '5cleanerBot',
        auth: 'offline'
    });

    // সঠিকভাবে plugin load করুন
    bot.loadPlugin(pathfinder);
    
    // collectBlock plugin সঠিকভাবে load করুন
    const collectBlockPlugin = require('mineflayer-collectblock');
    bot.loadPlugin(collectBlockPlugin.plugin);
    
    // auto-eat plugin সঠিকভাবে load করুন
    bot.loadPlugin(autoeat);

    bot.once('login', () => {
        setTimeout(() => {
            bot.chat('/register cleanerbot cleanerbot');
        }, 1000);

        setTimeout(() => {
            bot.chat('/login cleanerbot');
        }, 3000);
    });

    bot.once('spawn', () => {
        // Auto-eat configuration
        if (bot.autoEat) {
            bot.autoEat.options = {
                priority: 'foodPoints',
                startAt: 14,
                bannedFood: []
            };
        }

        startItemCollection();
    });

    bot.on('playerCollect', (collector, itemDrop) => {
        if (collector !== bot.entity) return;
    });

    bot.on('entitySpawn', (entity) => {
        if (entity.type === 'player' && entity.username !== bot.username) {
            handlePlayerDetection(entity);
        }
    });

    bot.on('health', () => {
        if (bot.food < 18) {
        }
    });

    bot.on('end', (reason) => {
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => {
    });

    bot.on('message', (message) => {
        // কোনো chat দেখাবে না
    });
}

function startItemCollection() {
    setInterval(() => {
        if (bot.pathfinder && bot.pathfinder.isMoving()) return;

        const item = bot.nearestEntity(entity => 
            entity.type === 'item' && 
            bot.entity.position.distanceTo(entity.position) < 10
        );

        if (item) {
            collectItem(item);
        }
    }, 2000);
}

function collectItem(item) {
    if (!bot.pathfinder) return;
    
    const mcData = require('minecraft-data')(bot.version);
    const movements = new (require('mineflayer-pathfinder').Movements)(bot, mcData);
    
    bot.pathfinder.setMovements(movements);
    const Goal = require('mineflayer-pathfinder').goals.GoalNear;
    bot.pathfinder.setGoal(new Goal(item.position.x, item.position.y, item.position.z, 1));
}

function handlePlayerDetection(player) {
    if (bot.pathfinder && bot.pathfinder.isMoving()) return;

    const mcData = require('minecraft-data')(bot.version);
    const movements = new (require('mineflayer-pathfinder').Movements)(bot, mcData);
    
    bot.pathfinder.setMovements(movements);
    const Goal = require('mineflayer-pathfinder').goals.GoalNear;
    bot.pathfinder.setGoal(new Goal(player.position.x, player.position.y, player.position.z, 2));

    const checkDistance = setInterval(() => {
        const distance = bot.entity.position.distanceTo(player.position);
        
        if (distance <= 3) {
            clearInterval(checkDistance);
            dropAllItems();
        }
        
        if (distance > 15) {
            clearInterval(checkDistance);
        }
    }, 1000);
}

function dropAllItems() {
    const inventory = bot.inventory;
    let itemsDropped = 0;

    for (let slot = 0; slot < inventory.slots.length; slot++) {
        const item = inventory.slots[slot];
        
        if (item && item.name !== 'air') {
            if (shouldKeepItem(item)) continue;
            
            try {
                bot.toss(item.type, null, item.count, (err) => {
                    if (!err) {
                        itemsDropped++;
                    }
                });
            } catch (err) {
            }
        }
    }
}

function shouldKeepItem(item) {
    const keepItems = [
        'bread', 'apple', 'cooked_beef', 'cooked_chicken', 
        'cooked_porkchop', 'golden_apple', 'cake'
    ];
    
    return keepItems.includes(item.name);
}

createBot();
