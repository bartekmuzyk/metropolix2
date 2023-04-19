const {EmbedBuilder, Embed, ActionRowBuilder, ButtonBuilder} = require("discord.js");
const datefns = require("date-fns");
const {ButtonStyle} = require("discord-api-types/v10");
const schedule = require("node-schedule");

class MeetService {
    /** @type {?schedule.Job} */
    static meetHappenedJob = null;

    /**
     * @param meetData {{date: string, topic: string, description: string, location: string}}
     * @param eventCreator {GuildMember}
     * @returns {EmbedBuilder}
     */
    static generateEmbed(meetData, eventCreator) {
        return new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle(meetData.topic)
            .setDescription(meetData.description.length > 0 ? meetData.description : "*Nie podano opisu*")
            .setAuthor({
                iconURL: eventCreator.user.avatarURL(),
                name: `Organizator: ${eventCreator.displayName}`
            })
            .addFields({
                name: "⌚ Kiedy?",
                value: datefns.format(this.isoToDate(meetData.date), "'**'d MMMM y'**\no godz. **'H:mm'**'"),
                inline: true
            }, {
                name: "🗺 Gdzie?",
                value: meetData.location.length > 0 ? meetData.location : "*Nie podano*",
                inline: true
            })
            .setFooter({
                iconURL: "https://cdn0.iconfinder.com/data/icons/small-n-flat/24/678078-light-bulb-512.png",
                text: "Jeżeli jesteś organizatorem spotkania, możesz użyć przycisków poniżej, aby edytować szczegóły."
            })
            .setThumbnail("attachment://location.gif");
    }

    /**
     * @param meetData {{date: string, topic: string, description: string, location: string}}
     * @param previousEmbed {Embed}
     * @returns {EmbedBuilder}
     */
    static generateEmbedFromPrevious(meetData, previousEmbed) {
        return new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle(meetData.topic)
            .setDescription(meetData.description.length > 0 ? meetData.description : "*Nie podano opisu*")
            .setAuthor(previousEmbed.author)
            .addFields({
                name: "⌚ Kiedy?",
                value: datefns.format(this.isoToDate(meetData.date), "'**'d MMMM y'**' '\no godz.' '**'H:mm'**'"),
                inline: true
            }, {
                name: "🗺 Gdzie?",
                value: meetData.location.length > 0 ? meetData.location : "*Nie podano*",
                inline: true
            })
            .setFooter({
                iconURL: "https://cdn0.iconfinder.com/data/icons/small-n-flat/24/678078-light-bulb-512.png",
                text: "Jeżeli jesteś organizatorem spotkania, możesz użyć przycisków poniżej, aby edytować szczegóły."
            })
            .setThumbnail("attachment://location.gif");
    }

    static generateComponentsForInfoMessage(meetData, chatChannelUrl, disabled = false) {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setDisabled(disabled)
                    .setCustomId("interested_in_meet")
                    .setStyle(ButtonStyle.Success)
                    .setLabel("Jestem zainteresowany/a"),
                new ButtonBuilder()
                    .setDisabled(disabled)
                    .setCustomId("not_interested_in_meet")
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Nie jestem zainteresowany/a")
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setDisabled(disabled)
                    .setCustomId("edit_meet_time")
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Edytuj czas")
                    .setEmoji("⌚"),
                new ButtonBuilder()
                    .setDisabled(disabled)
                    .setCustomId("edit_meet_location")
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Edytuj miejsce spotkania")
                    .setEmoji("🗺"),
                new ButtonBuilder()
                    .setDisabled(disabled)
                    .setCustomId("edit_meet_description")
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Edytuj opis spotkania")
                    .setEmoji("✏"),
                new ButtonBuilder()
                    .setDisabled(disabled)
                    .setCustomId("cancel_meet")
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("Anuluj spotkanie")
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel("Przejdź do czatu")
                    .setEmoji("💬")
                    .setURL(chatChannelUrl),
                new ButtonBuilder()
                    .setDisabled(meetData.location.length === 0)
                    .setStyle(ButtonStyle.Link)
                    .setLabel("Wyszukaj lokalizację w Google Maps")
                    .setEmoji("🔍")
                    .setURL(`https://www.google.com/maps/search/${encodeURIComponent(meetData.location)}`)
            )
        ];
    }

    /**
     * @param time {string}
     * @returns {?{hour: number, minute: number}}
     */
    static parseTime(time) {
        /** @type {?{hour: number, minute: number}} */
        let parsedTime = null;

        if (time.length > 0) {
            const splitTime = time.split(":");

            if (splitTime.length !== 2) {
                return null;
            }

            try {
                parsedTime = {hour: parseInt(splitTime[0]), minute: parseInt(splitTime[1])};
            } catch (e) {
                console.warn(`time parse error: ${e}`);
                return null;
            }
        }

        return parsedTime;
    }

    /**
     * @param isoString {string}
     * @returns {Date}
     */
    static isoToDate(isoString) {
        return new Date(Date.parse(isoString));
    }

    /**
     * @param meetData {{date: string}}
     * @param onHappen {(onHourPassAfterHappenExecutionDate: Date) => Promise<void>}
     * @param onHourPassAfterHappen {() => Promise<void>}
     */
    static scheduleMeetHappenedJob(meetData, onHappen, onHourPassAfterHappen) {
        const meetDate = this.isoToDate(meetData.date);

        this.meetHappenedJob = schedule.scheduleJob(meetDate, () => {
            const oneHourAfterMeetHappenedDate = datefns.addHours(new Date(), 1);

            onHappen(oneHourAfterMeetHappenedDate)
                .then(() => {
                    schedule.scheduleJob(oneHourAfterMeetHappenedDate, () => {
                        onHourPassAfterHappen()
                            .catch(e => {
                                console.warn(`error when executing onHourPassAfterHappen in scheduled meetHappenedJob: ${e}`);
                            });
                    });
                })
                .catch(e => {
                    console.warn(`error when executing onHappen in scheduled meetHappenedJob: ${e}`);
                });
        });
    }

    /**
     * @param newTime {Date}
     */
    static rescheduleMeetHappenedJob(newTime) {
        if (this.meetHappenedJob) {
            this.meetHappenedJob.reschedule(newTime);
        }
    }

    static cancelMeetHappenedJob() {
        if (this.meetHappenedJob) {
            this.meetHappenedJob.cancel();
            this.meetHappenedJob = null;
        }
    }
}

module.exports = MeetService;
