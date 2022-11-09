const {ChatInputCommandInteraction, GuildMember} = require("discord.js");
const config = require("./config.json");

class Auth {
    /**
     * @param interaction {ChatInputCommandInteraction}
     * @returns {boolean}
     */
    static authorize(interaction) {
        /** @type {GuildMember} */
        const member = interaction.member;

        return member.roles.cache.has(config.roles.normalMember) || member.roles.cache.has(config.roles.tech);
    }
}

module.exports = Auth;
