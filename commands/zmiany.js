const {SlashCommandBuilder, Client, ChatInputCommandInteraction} = require("discord.js");
const ChangesService = require("../services/changes");

/**
 * @param client {Client}
 * @param interaction {ChatInputCommandInteraction}
 */
async function execute(client, interaction) {
    await interaction.reply({
        embeds: [ChangesService.generateChangesEmbed()]
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("zmiany")
        .setDescription("Pokazuje zmiany na tym samym kanale, gdzie została wykonana ta komenda."),
    execute
};