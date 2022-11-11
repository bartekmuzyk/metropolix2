const {Client, Events, GatewayIntentBits, Collection, TextChannel, userMention, roleMention, channelMention, Guild, ActivityType} = require("discord.js");
const config = require("./config.json");
const path = require("path");
const fs = require("fs");
const ModalSubmitRegistrar = require("./registrars/ModalSubmitRegistrar");
const Auth = require("./auth");

const isDevMode = process.env.BOT_ENV === "dev";

if (isDevMode) console.log("🚧 TRYB DEWELOPERSKI 🚧");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
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
                type: ActivityType.Playing,
                name: "typu winogronoooo!!"
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

    if (!Auth.authorize(interaction)) {
        interaction.reply({ content: "Nie jesteś pełnoprawnym członkiem Metropolii, więc nie możesz wykonać tej komendy.\nᵉᶻ", ephemeral: true });
        return;
    }

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

/**
 * @param guild {Guild}
 */
async function updateMembersDisplay(guild) {
    await client.channels.cache.get(config.memberCounter.categoryId)
        .setName(config.memberCounter.format.replace("{}", guild.memberCount.toString()));
}

client.on("guildMemberAdd", async member => {
    if (member.user.bot) return;

    /** @type {TextChannel} */
    const welcomeChannel = client.channels.cache.get(config.channels.welcome);
    await welcomeChannel.send({
        content:
            `**Witaj ${userMention(member.user.id)}!**\n` +
            `Napisz tutaj kim jesteś lub kto wysłał Ci zaproszenie, następnie poczekaj na administratora (${roleMention(config.roles.admin)}), moderatora (${roleMention(config.roles.moderator)}) lub technika (${roleMention(config.roles.tech)}), który przyzna Ci odpowiednie uprawnienia.\n\n` +
            `*W tym czasie polecamy zapoznać się z ${channelMention(config.channels.rules)}.*`
    });

    await updateMembersDisplay(member.guild);
});

client.on("guildMemberRemove", async member => {
    await updateMembersDisplay(member.guild);
});

client.login(config.token);
