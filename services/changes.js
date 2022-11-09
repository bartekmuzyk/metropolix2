const {EmbedBuilder} = require("discord.js");
const changes = require("../changes.json");

class ChangesService {
    /**
     * @returns {EmbedBuilder}
     */
    static generateChangesEmbed() {
        const embed = new EmbedBuilder()
            .setColor(0x541eea)
            .setTitle(changes.title)
            .setDescription(changes.description);

        for (const [name, value] of Object.entries(changes.features)) {
            embed.addFields({name, value});
        }

        return embed;
    }
}

module.exports = ChangesService;
