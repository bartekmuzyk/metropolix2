const {Client, ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, EmbedBuilder} = require("discord.js");
const WelcomeService = require("../services/welcome");

/**
 * @param client {Client}
 * @param interaction {ChatInputCommandInteraction}
 */
async function execute(client, interaction) {
    await interaction.reply({
        embeds: [WelcomeService.generateEmbed()],
        ephemeral: true
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("oprowadzenie")
        .setDescription("Wyświetla (tylko dla ciebie) krótkie oprowadzenie"),
    execute
};
