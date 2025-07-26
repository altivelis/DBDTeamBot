const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js'); //discord.js からClientとIntentsを読み込む
const {token,guildId} = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ]
});  //clientインスタンスを作成する

const commands = {};

const commandsPath = path.join(__dirname,'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if('data' in command && 'execute' in command){
        commands[command.data.name] = command;
    }else{
        console.log(`[WARNING] The command at ${filePath} is missing a required \"data\" or \"execute\" property.`);
    }
}

client.once(Events.ClientReady, async () => {
    const data = []
    for (const commandName in commands) {
        data.push(commands[commandName].data)
    }
    if(guildId) {
        await client.application.commands.set(data, guildId);
    }
    else {
        await client.application.commands.set(data);
    }
    console.log("Ready!");
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand()) {
        return;
    }
    const command = commands[interaction.commandName];
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true,
        })
    }
});
client.login(token);
