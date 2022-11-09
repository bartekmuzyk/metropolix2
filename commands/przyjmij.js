const {Client, ChatInputCommandInteraction, SlashCommandBuilder, GuildMember} = require("discord.js");
const config = require("../config.json");
const WelcomeService = require("../services/welcome");

/**
 * @param client {Client}
 * @param interaction {ChatInputCommandInteraction}
 */
async function execute(client, interaction) {
    /** @type {GuildMember} */
    const member = interaction.options.getMember("member", true);

    if (member.roles.cache.has(config.roles.normalMember)) {
        await interaction.reply({ content: "Ten użytkownik jest już członkiem serwera!", ephemeral: true });
        return;
    }

    await interaction.deferReply();
    await member.roles.add(config.roles.normalMember);

    try {
        const welcomeEmbed = WelcomeService.generateEmbed();
        await member.user.send({ embeds: [welcomeEmbed] });
        await interaction.editReply({ content: `${member} zostałeś przyjęty na serwer!\n**Sprawdź prywatne wiadomości, aby zobaczyć krótkie oprowadzenie po najważniejszych kanałach.**` });
    } catch {
        await interaction.editReply({ content: `${member} zostałeś przyjęty na serwer!\n**Wykonaj komendę \`/oprowadzenie\`, aby zobaczyć krótkie oprowadzenie po najważniejszych kanałach.**` });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("przyjmij")
        .setDescription("Przyjmuje wybranego członka na serwer przygotowując odpowiednie role automatycznie.")
        .addUserOption(option => option
            .setRequired(true)
            .setName("member")
            .setDescription("Użytkownik do przyjęcia na serwer.")
        )
        .setDefaultMemberPermissions(8),
    execute
}
