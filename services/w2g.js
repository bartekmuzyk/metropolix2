const {GuildMember, EmbedBuilder} = require("discord.js");
const config = require("../config.json");
const fetch = require("node-fetch");

const API_URL = "https://api.w2g.tv";

/**
 * @see https://stackoverflow.com/a/55680330/13040404
 * @param response {Response}
 * @return {string}
 */
function parseCookies(response) {
    return response.headers.raw()['set-cookie']
        .map(entry => entry.split(';')[0])
        .join(';');
}

class Watch2GetherService {
    /**
     * @returns {Promise<string>} Room URL
     */
    static async createRoom() {
        /** @type {Response} */
        const createResponse = await fetch(`${API_URL}/rooms/create.json`, {
            method: "POST"
        });

        if (!createResponse.ok) throw new Error();

        const cookies = parseCookies(createResponse);
        /** @type {{streamkey: string}} */
        const roomCreationData = await createResponse.json();

        const joinResponse = await fetch(`${API_URL}/rooms/${roomCreationData.streamkey}/join_room`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                cookie: cookies
            },
            body: JSON.stringify({nname: config.watch2gether.nickname})
        });

        if (!joinResponse.ok) throw new Error();

        return `https://w2g.tv/${roomCreationData.streamkey}`;
    }

    /**
     * @param member {GuildMember}
     * @param url {string}
     * @returns {EmbedBuilder}
     */
    static generateEmbed(member, url) {
        return new EmbedBuilder()
            .setColor(0xEAD025)
            .setAuthor({
                iconURL: member.user.avatarURL(),
                name: member.displayName
            })
            .setTitle("Zaproszenie do pokoju Watch2Gether")
            .setURL(url)
            .setDescription("Kliknij w link powyżej, aby dołączyć.");
    }
}

module.exports = Watch2GetherService;
