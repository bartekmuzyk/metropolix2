const {Client, Events, GatewayIntentBits, Collection, TextChannel, userMention, roleMention, channelMention, Guild, ActivityType,
    AttachmentBuilder
} = require("discord.js");
const config = require("./config.json");
const path = require("path");
const fs = require("fs");
const ModalSubmitRegistrar = require("./registrars/ModalSubmitRegistrar");
const ButtonRegistrar = require("./registrars/ButtonRegistrar");
const datefns = require("date-fns");

datefns.setDefaultOptions({
    locale: require("date-fns/locale/pl")
});

const isDevMode = process.env.BOT_ENV === "dev";

if (isDevMode) console.log("🚧 TRYB DEWELOPERSKI 🚧");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        if ("dev" in command && command.dev && !isDevMode) continue;

        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.once(Events.ClientReady, c => {
    client.user.setPresence({
        status: isDevMode ? "dnd" : "online",
        activities: [
            {
                type: ActivityType.Watching,
                name: "wielkiego brata"
            }
        ]
    });
    console.log(`Zalogowany jako ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (isDevMode && !interaction.member.roles.cache.has(config.roles.tester) && !interaction.member.roles.cache.has(config.roles.tech)) {
        await interaction.reply({ content: "Bot jest w trybie konserwacji. Musisz być **testerem** lub **technikiem**, aby móc wejść w interakcję.", ephemeral: true });
        return;
    }

    console.log(`====> ${interaction.user.tag} wykonuje /${interaction.commandName} <====`);

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`żodyn komend ni pasuje do ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(client, interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: `***WYKRYTO SYTUACJĘ TYPU WINOGRONOOOOOO!*** (aka wystąpił nieznany błąd, zgłoś to do ${roleMention(config.roles.tech)})`,
            ephemeral: true
        });
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isModalSubmit()) return;

    if (ModalSubmitRegistrar.callbacks.hasOwnProperty(interaction.customId)) {
        ModalSubmitRegistrar.callbacks[interaction.customId](client, interaction);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    if (ButtonRegistrar.callbacks.hasOwnProperty(interaction.customId)) {
        ButtonRegistrar.callbacks[interaction.customId](client, interaction);
    }
});

client.on(Events.MessageCreate, async message => {
    if (message.content.toLowerCase().includes("janusz angrybirds")) {
        await message.reply({ files: [new AttachmentBuilder("assets/realistic_angry_bird.jpg")] });
    }
});

/**
 * @param guild {Guild}
 */
async function updateMembersDisplay(guild) {
    await client.channels.cache.get(config.memberCounter.categoryId)
        .setName(config.memberCounter.format.replace("{}", guild.memberCount.toString()));
}

client.on(Events.GuildMemberAdd, async member => {
    if (member.user.bot) return;

    /** @type {TextChannel} */
    const welcomeChannel = client.channels.cache.get(config.channels.welcome);
    await welcomeChannel.send({
        content:
            `**Witaj ${userMention(member.user.id)}!**\n` +
            `Napisz tutaj kim jesteś lub kto wysłał Ci zaproszenie, następnie zapoznaj się z zasadami na ${channelMention(config.channels.rules)} i zobacz krótkie oprowadzenie za pomocą komendy \`/oprowadzenie\`.\n**Życzymy miłego pobytu!**`
    });

    await updateMembersDisplay(member.guild);
});

client.on(Events.GuildMemberRemove, async member => {
    await updateMembersDisplay(member.guild);
});

client.login(config.token);
