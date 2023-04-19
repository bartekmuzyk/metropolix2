const {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    channelMention,
    TextChannel,
    EmbedBuilder,
    Client,
    ModalSubmitInteraction,
    Message
} = require("discord.js");
const ModalSubmitRegistrar = require("../registrars/ModalSubmitRegistrar");
const config = require("../config.json");

const voteEmojis = {
    1: "1️⃣",
    2: "2️⃣",
    3: "3️⃣",
    4: "4️⃣",
    5: "5️⃣",
    6: "6️⃣",
    7: "7️⃣",
    8: "8️⃣",
    9: "9️⃣",
};

/**
 * @param client {Client}
 * @param interaction {ChatInputCommandInteraction}
 */
async function execute(client, interaction) {
    const modal = new ModalBuilder()
        .setCustomId((interaction.options.getBoolean("mention_everyone") ?? false) ? "voting_modal_everyone" : "voting_modal")
        .setTitle("Tworzenie głosowania");


    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("question")
                .setLabel("Pytanie")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("options")
                .setLabel("Odpowiedzi oddzielone po średnikach (;)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        )
    );

    await interaction.showModal(modal);
}

/**
 * @param client {Client}
 * @param interaction {ModalSubmitInteraction}
 * @param mentionEveryone {boolean}
 * @returns {Promise<void>}
 */
async function onModalSubmit(client, interaction, mentionEveryone) {
    /** @type {string[]} */
    const options = interaction.fields.getTextInputValue("options")
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (options.length < 2 || options.length > 9) {
        interaction.reply({ content: "Podaj ilość opcji między 2 a 9", ephemeral: true });
        return;
    }

    /** @type {TextChannel} */
    const pollsChannel = client.channels.cache.get(config.channels.referendum);
    const pollEmbed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setTitle(interaction.fields.getTextInputValue("question"));

    for (let i = 0; i < options.length; i++) {
        pollEmbed.addFields({
            name: `Opcja ${voteEmojis[i + 1]}`,
            value: options[i],
            inline: true
        });
    }

    pollEmbed.setAuthor({
        iconURL: interaction.user.avatarURL(),
        name: interaction.member.displayName
    });

    if (mentionEveryone) pollsChannel.send({ content: "@everyone" });
    /** @type {Message} */
    const pollMessage = await pollsChannel.send({ embeds: [pollEmbed] });

    await interaction.reply({
        content: `**Głosowanie utworzone!** Sprawdź kanał ${channelMention(config.channels.referendum)}`,
        ephemeral: true
    });

    for (let i = 1; i <= options.length; i++) {
        await pollMessage.react(voteEmojis[i]);
    }
}

ModalSubmitRegistrar.register(
    "voting_modal",
    async (client, interaction) => onModalSubmit(client, interaction, false)
);

ModalSubmitRegistrar.register(
    "voting_modal_everyone",
    async (client, interaction) => onModalSubmit(client, interaction, true)
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("glosowanie")
        .setDescription("Tworzy głosowanie z ilością opcji od dwóch do dziewięciu.")
        .addBooleanOption(option => option
            .setName("mention_everyone")
            .setDescription("Oznacz wszystkich (@everyone) na serwerze po utworzeniu głosowania.")
        ),
    execute
};
