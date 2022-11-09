const {ChatInputCommandInteraction, SlashCommandBuilder, Client, EmbedBuilder} = require("discord.js");
const config = require("../config.json");

/**
 * @param client {Client}
 * @param interaction {ChatInputCommandInteraction}
 */
async function execute(client, interaction) {
    const thing = interaction.options.getString("thing", true);

    await interaction.reply({ content: `ok, testuje **${thing}**...` });

    switch (thing) {
        case "przywitanie":
            client.emit("guildMemberAdd", interaction.member);
            break;
        case "counter":
            await client.channels.cache.get(config.memberCounter.categoryId)
                .setName(config.memberCounter.format.replace("{}", interaction.guild.memberCount.toString()));
            break;
    }
}

module.exports = {
    dev: true,
    data: new SlashCommandBuilder()
        .setName("testuj")
        .setDescription("do testowania rzeczy")
        .addStringOption(option => option
            .setRequired(true)
            .setName("thing")
            .setDescription("rzecz do przetestowania")
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(8),
    execute
};
