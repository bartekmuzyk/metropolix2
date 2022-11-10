const {Client, ChatInputCommandInteraction, SlashCommandBuilder, Message, channelMention} = require("discord.js");
const config = require("../config.json");
const Watch2GetherService = require("../services/w2g");

/**
 * @param client {Client}
 * @param interaction {ChatInputCommandInteraction}
 */
async function execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });
    let url;

    try {
        url = await Watch2GetherService.createRoom();
    } catch (e) {
        console.log("W2G Service error!");
        console.log(e);

        /** @type {Message} */
        await interaction.editReply({ content: "Nie udało się utworzyć linku. Spróbuj ponownie później." });

        return;
    }

    const channel = client.channels.cache.get(config.channels.watch2gether);

    await channel.send({
        embeds: [Watch2GetherService.generateEmbed(interaction.member, url)]
    });

    await interaction.editReply({ content: `**Pokój utworzony pomyślnie!** Sprawdź kanał ${channelMention(config.channels.watch2gether)}.` });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("w2g")
        .setDescription("Automatycznie tworzy nowy pokój Watch2Gether i wysyła link na odpowiednim kanale."),
    execute
};