const {Client, ChatInputCommandInteraction, SlashCommandBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle, channelMention,
    ButtonBuilder, EmbedBuilder, Guild,
    userMention
} = require("discord.js");
const ModalSubmitRegistrar = require("../registrars/ModalSubmitRegistrar");
const ButtonRegistrar = require("../registrars/ButtonRegistrar");
const AssetManager = require("../assets");
const DataStorage = require("../data");
const MeetService = require("../services/meet");
const config = require("../config.json");
const datefns = require("date-fns");
const {ButtonStyle} = require("discord-api-types/v10");

const months = {
    "Styczeń": 0,
    "Luty": 1,
    "Marzec": 2,
    "Kwiecień": 3,
    "Maj": 4,
    "Czerwiec": 5,
    "Lipiec": 6,
    "Sierpień": 7,
    "Wrzesień": 8,
    "Październik": 9,
    "Listopad": 10,
    "Grudzień": 11,
}

/**
 * @param client {Client}
 * @param interaction {ChatInputCommandInteraction}
 */
async function execute(client, interaction) {
    if (DataStorage.exists("meet")) {
        const currentMeetData = DataStorage.load("meet")

        if (!("topic" in currentMeetData) || MeetService.isoToDate(currentMeetData.date) < new Date()) {
            DataStorage.delete("meet");
        } else {
            await interaction.reply({ content: "Nie można zaplanować drugiego spotkania przed zakończeniem pierwszego.", ephemeral: true });
            return;
        }
    }

    DataStorage.create("meet");

    const today = new Date();
    const day = interaction.options.getInteger("day", true);
    const month = interaction.options.getInteger("month", true);
    const year = today.getFullYear();
    let date = new Date(year, month, day);

    if (date < datefns.subDays(today, 1)) {
        date = new Date(year + 1, month, day);
    }

    DataStorage.save("meet", {date: date.toISOString(), creator: interaction.user.id, interested: []});

    const modal = new ModalBuilder()
        .setCustomId("create_meet_event_modal")
        .setTitle(`Spotkanie ${datefns.format(date, "d MMMM y")}`);


    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("topic")
                .setLabel("Temat spotkania")
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("description")
                .setLabel("Dodatkowe informacje (lub pozostaw puste)")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("location")
                .setLabel("Gdzie? (pozostaw puste jeśli nieznane)")
                .setStyle(TextInputStyle.Short)
                .setMaxLength(50)
                .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("time")
                .setLabel("O której? (w formacie XX:XX lub zostaw puste)")
                .setStyle(TextInputStyle.Short)
                .setMaxLength(5)
                .setRequired(false)
        )
    );

    await interaction.showModal(modal);
}

/**
 * @param guild {Guild}
 * @param interested {string[]}
 * @param client
 * @param message {string}
 * @returns {Promise<void>}
 */
async function notifyUsersAboutChanges(guild, interested, client, message) {
    const usersFailedToGetNotified = [];

    for (const userId of interested) {
        if (!guild.members.cache.has(userId)) {
            continue;
        }

        const user = await client.users.fetch(userId);

        try {
            await user.send(`❗ **Nastąpiły zmiany w planach spotkania!**\n${message}`);
        } catch (e) {
            console.warn(`Failed to notify ${user.username} about meet details change: ${e}`);
            usersFailedToGetNotified.push(user.id);
        }
    }

    if (usersFailedToGetNotified.length > 0) {
        const chatChannel = guild.channels.cache.get(config.channels.meetup.chatChannel);

        await chatChannel.send({
            content: `${usersFailedToGetNotified.map(userMention).join(" ")}\n\n❗ **Nastąpiły zmiany w planach spotkania!**\n${message}\n\n*Ta wiadomość została wysłana, ponieważ oznaczonym powyżej osobom nie udało się wysłać powiadomienia w wiadomościach prywatnych.*`
        });
    }
}

function getInfoMessage(client) {
    return client.channels.cache.get(config.channels.meetup.infoChannel).messages.fetch(DataStorage.load("meet").infoMessageId);
}

async function updateInfoEmbed(client) {
    const currentMeetData = DataStorage.load("meet");
    const infoMessage = await getInfoMessage(client);
    const newEmbed = MeetService.generateEmbedFromPrevious(currentMeetData, infoMessage.embeds[0]);

    await infoMessage.edit({
        embeds: [newEmbed],
        components: MeetService.generateComponentsForInfoMessage(
            currentMeetData,
            client.channels.cache.get(config.channels.meetup.chatChannel).url
        )
    });
}

/**
 * @param client {Client}
 * @param interaction
 * @param state {boolean}
 * @returns {Promise<void>}
 */
async function toggleMeetupActiveBanner(client, interaction, state) {
    const bannerChannel = client.channels.cache.get(config.channels.meetup.activeBanner);

    await bannerChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {ViewChannel: state});
}

ModalSubmitRegistrar.register(
    "create_meet_event_modal",
    async (client, interaction) => {
        const topic = interaction.fields.getTextInputValue("topic");
        const description = interaction.fields.getTextInputValue("description");
        const location = interaction.fields.getTextInputValue("location");
        const time = interaction.fields.getTextInputValue("time");

        await interaction.deferReply({ ephemeral: true });

        const currentMeetData = DataStorage.load("meet");
        const parsedTime = MeetService.parseTime(time);

        if (time.length > 0 && !parsedTime) {
            await interaction.editReply({ content: `Podany czas \`${time}\` nie spełnia formatu **XX:XX**.\n\nPrzykłady poprawnych czasów: 9:05, 10:00, 21:37.` });
            return;
        }

        const currentMeetDate = MeetService.isoToDate(currentMeetData.date);
        const now = new Date();

        if (parsedTime) {
            currentMeetDate.setHours(parsedTime.hour, parsedTime.minute);

            if (currentMeetDate <= now) {
                await interaction.editReply({ content: "Nie możesz zaplanować spotkania na czas przed aktualnym/taki sam jak jest teraz." });
                return;
            }
        } else if (currentMeetDate <= now) {
            if (now.getHours() === 23 && now.getMinutes() === 59) {
                await interaction.editReply({ content: "Nie możesz zaplanować spotkania na czas przed aktualnym/taki sam jak jest teraz." });
                return;
            }

            currentMeetDate.setHours(23, 59);
        }

        DataStorage.modify("meet", {date: currentMeetDate.toISOString(), topic, description, location});

        const meetupData = DataStorage.load("meet")
        const meetupInformationChannel = client.channels.cache.get(config.channels.meetup.infoChannel);
        const embed = MeetService.generateEmbed(meetupData, interaction.member);
        const infoMessage = await meetupInformationChannel.send({
            embeds: [embed],
            files: [AssetManager.getAsAttachment("location.gif")],
            components: MeetService.generateComponentsForInfoMessage(
                meetupData,
                client.channels.cache.get(config.channels.meetup.chatChannel).url
            )
        });

        DataStorage.modify("meet", {infoMessageId: infoMessage.id});
        await toggleMeetupActiveBanner(client, interaction, true);

        MeetService.scheduleMeetHappenedJob(
            meetupData,
            async onHourPassAfterHappenExecutionDate => {
                const chatChannel = client.channels.cache.get(config.channels.meetup.chatChannel);

                const infoMessage = await getInfoMessage(client);
                await infoMessage.edit({
                    components: MeetService.generateComponentsForInfoMessage(
                        DataStorage.load("meet"),
                        chatChannel.url,
                        true
                    )
                });

                await chatChannel.send({ content: `**Wydarzenie właśnie trwa!** Panel z informacjami na ${channelMention(config.channels.meetup.infoChannel)} będzie istnieć jeszcze do godziny **${datefns.format(onHourPassAfterHappenExecutionDate, "H:mm")}**.` })
            },
            async () => {
                MeetService.cancelMeetHappenedJob();

                const infoMessage = await getInfoMessage(client);
                await infoMessage.delete();

                await toggleMeetupActiveBanner(client, interaction,false);

                DataStorage.delete("meet");
            }
    );

        await interaction.editReply({
            content: `**Spotkanie zostało zorganizowane!**\nInformacje dotyczące wydarzenia pojawiły się na kanale ${channelMention(config.channels.meetup.infoChannel)}, gdzie możesz je również edytować. Tam też możesz usunąć spotkanie, jeżeli zajdzie taka potrzeba.`,
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel("Przejdź do panelu z informacjami i edycją")
                            .setURL(infoMessage.url)
                    )
            ]
        });
    }
);

ButtonRegistrar.register(
    "interested_in_meet",
    async (client, interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const currentMeetData = DataStorage.load("meet");
        const executorUserId = interaction.user.id;

        if (executorUserId === currentMeetData.creator) {
            await interaction.reply({
                content: "Jesteś organizatorem spotkania. Nie możesz wyrazić zainteresowania własnym wydarzeniem... lol xd....",
                ephemeral: true
            });
            return;
        }

        if (currentMeetData.interested.includes(executorUserId)) {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x4CAF50)
                        .setTitle("✔ Jesteś już zapisany/a na to wydarzenie.")
                        .setDescription("Otrzymasz powiadomienia w formie wiadomości prywatnych, jeżeli zajdą jakiekolwiek zmiany.")
                        .setImage("attachment://allow_messages.png")
                        .setFooter({
                            iconURL: "attachment://warning.png",
                            text: "Upewnij się, że zezwalasz na wiadomości prywatne od innych osób w ustawieniach profilu!"
                        })
                ],
                files: [
                    AssetManager.getAsAttachment("allow_messages.png"),
                    AssetManager.getAsAttachment("warning.png")
                ]
            });
            return;
        }

        currentMeetData.interested.push(executorUserId);
        DataStorage.save("meet", currentMeetData);

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x4CAF50)
                    .setTitle("✔ Zostałeś/aś zapisany/a na to wydarzenie.")
                    .setDescription("Otrzymasz powiadomienia w formie wiadomości prywatnych, jeżeli zajdą jakiekolwiek zmiany.")
                    .setImage("attachment://allow_messages.png")
                    .setFooter({
                        iconURL: "attachment://warning.png",
                        text: "Upewnij się, że zezwalasz na wiadomości prywatne od innych osób w ustawieniach profilu!"
                    })
            ],
            files: [
                AssetManager.getAsAttachment("allow_messages.png"),
                AssetManager.getAsAttachment("warning.png")
            ]
        });
    }
);

ButtonRegistrar.register(
    "not_interested_in_meet",
    async (client, interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const currentMeetData = DataStorage.load("meet");
        const executorUserId = interaction.user.id;

        if (currentMeetData.interested.includes(executorUserId)) {
            currentMeetData.interested.splice(currentMeetData.interested.indexOf(executorUserId), 1);
            DataStorage.save("meet", currentMeetData);
        }

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xF44336)
                    .setTitle("❌ Zostałeś/aś wypisany/a z wydarzenia")
                    .setDescription("Nie otrzymasz już powiadomień dotyczących zmian.")
            ]
        });
    }
);

ButtonRegistrar.register(
    "edit_meet_time",
    async (client, interaction) => {
        const currentMeetData = DataStorage.load("meet");

        if (interaction.user.id !== currentMeetData.creator) {
            await interaction.reply({ content: `Tylko organizator spotkania może modyfikować te ustawienia.`, ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId("edit_meet_time_modal")
            .setTitle("Edytuj czas spotkania")
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("new_time")
                        .setLabel("Nowy czas (w formacie XX:XX)")
                        .setStyle(TextInputStyle.Short)
                        .setValue(datefns.format(MeetService.isoToDate(currentMeetData.date), "H:mm"))
                        .setMinLength(1)
                        .setMaxLength(5)
                )
            )

        await interaction.showModal(modal);
    }
);

ModalSubmitRegistrar.register(
    "edit_meet_time_modal",
    async (client, interaction) => {
        const newTimeRaw = interaction.fields.getTextInputValue("new_time");

        await interaction.deferReply({ ephemeral: true });

        const newTimeParsed = newTimeRaw.length > 0 ? MeetService.parseTime(newTimeRaw) : {hour: 0, minute: 0};

        if (!newTimeParsed) {
            await interaction.editReply({ content: `Podany czas \`${newTimeRaw}\` nie spełnia formatu **XX:XX**.\n\nPrzykłady poprawnych czasów: 9:05, 10:00, 21:37.` });
            return;
        }

        const currentMeetData = DataStorage.load("meet");
        const currentMeetDate = MeetService.isoToDate(currentMeetData.date);
        const previousTime = datefns.format(currentMeetDate, "H:mm");
        currentMeetDate.setHours(newTimeParsed.hour, newTimeParsed.minute);
        const newTime = datefns.format(currentMeetDate, "H:mm");

        if (previousTime === newTime) {
            await interaction.editReply({ content: "Pozostawiono bez zmian." });
            return;
        } else if (currentMeetDate <= new Date()) {
            await interaction.editReply({ content: "Nie możesz zmienić czasu na taki przed aktualnym/taki sam jak jest teraz." });
            return;
        }

        DataStorage.modify("meet", {date: currentMeetDate.toISOString()});
        MeetService.rescheduleMeetHappenedJob(currentMeetDate);

        await notifyUsersAboutChanges(
            interaction.guild, currentMeetData.interested, client,
            `**Godzina** zmieniona z **${previousTime}** na **${newTime}**.`
        );
        await updateInfoEmbed(client);

        await interaction.editReply({ content: "✔ **Zapisano nowy czas i powiadomiono zainteresowanych.**" });
    }
);

ButtonRegistrar.register(
    "edit_meet_location",
    async (client, interaction) => {
        const currentMeetData = DataStorage.load("meet");

        if (interaction.user.id !== currentMeetData.creator) {
            await interaction.reply({ content: `Tylko organizator spotkania może modyfikować te ustawienia.`, ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId("edit_meet_location_modal")
            .setTitle("Edytuj miejsce spotkania")
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("new_location")
                        .setLabel("Nowa lokalizacja")
                        .setStyle(TextInputStyle.Short)
                        .setValue(currentMeetData.location)
                        .setMaxLength(50)
                )
            )

        await interaction.showModal(modal);
    }
);

ModalSubmitRegistrar.register(
    "edit_meet_location_modal",
    async (client, interaction) => {
        const location = interaction.fields.getTextInputValue("new_location");

        await interaction.deferReply({ ephemeral: true });

        const currentMeetData = DataStorage.load("meet");
        const previousLocation = currentMeetData.location;

        if (location === previousLocation) {
            await interaction.editReply({ content: "Pozostawiono bez zmian." });
            return;
        }

        DataStorage.modify("meet", {location});
        await notifyUsersAboutChanges(
            interaction.guild, currentMeetData.interested, client,
            `**Lokalizacja** zmieniona z **${previousLocation}** na **${location}**.`
        );
        await updateInfoEmbed(client);

        await interaction.editReply({ content: "✔ **Zapisano nową lokalizację i powiadomiono zainteresowanych.**" });
    }
);

ButtonRegistrar.register(
    "edit_meet_description",
    async (client, interaction) => {
        const currentMeetData = DataStorage.load("meet");

        if (interaction.user.id !== currentMeetData.creator) {
            await interaction.reply({ content: `Tylko organizator spotkania może modyfikować te ustawienia.`, ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId("edit_meet_description_modal")
            .setTitle("Edytuj opis spotkania")
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("new_description")
                        .setLabel("Nowy opis")
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(currentMeetData.description)
                        .setMaxLength(1000)
                )
            )

        await interaction.showModal(modal);
    }
);

ModalSubmitRegistrar.register(
    "edit_meet_description_modal",
    async (client, interaction) => {
        const description = interaction.fields.getTextInputValue("new_description");

        await interaction.deferReply({ ephemeral: true });

        const currentMeetData = DataStorage.load("meet");
        const previousDescription = currentMeetData.description;

        if (description === previousDescription) {
            await interaction.editReply({ content: "Pozostawiono bez zmian." });
            return;
        }

        DataStorage.modify("meet", {description});
        await notifyUsersAboutChanges(
            interaction.guild, currentMeetData.interested, client,
            `**Opis** zmieniony. Nowy opis:\n${description}.`
        );
        await updateInfoEmbed(client);

        await interaction.editReply({ content: "✔ **Zapisano nowy opis i powiadomiono zainteresowanych.**" });
    }
);

ButtonRegistrar.register(
    "cancel_meet",
    async (client, interaction) => {
        const currentMeetData = DataStorage.load("meet");

        if (interaction.user.id !== currentMeetData.creator) {
            await interaction.reply({ content: "Tylko organizator spotkania może je anulować.", ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        MeetService.cancelMeetHappenedJob();

        const infoMessage = await getInfoMessage(client);
        await infoMessage.delete();

        await notifyUsersAboutChanges(
            interaction.guild, currentMeetData.interested, client,
            "Spotkanie zostało **anulowane**."
        );
        await toggleMeetupActiveBanner(client, interaction, false);

        DataStorage.delete("meet");

        await interaction.editReply({ content: "✔ **Spotkanie zostało pomyślnie anulowane.**" });
    }
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("spotkanie")
        .setDescription("Pozwala utworzyć wydarzenie spotkania oraz wysyła powiadomienie do wszystkich zainteresowanych.")
        .addIntegerOption(option => option
            .setName("day")
            .setDescription("Dzień daty spotkania")
            .setMinValue(1)
            .setMaxValue(31)
            .setRequired(true)
        )
        .addIntegerOption(option => option
            .setName("month")
            .setDescription("Miesiąc daty spotkania")
            .setChoices(...Object.entries(months).map(([name, value]) => ({name, value})))
            .setRequired(true)
        ),
    execute
}
