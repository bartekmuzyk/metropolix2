const {AttachmentBuilder} = require("discord.js");
const fs = require("fs");

class AssetManager {
    /**
     * @param fileName {string}
     * @returns {AttachmentBuilder}
     */
    static getAsAttachment(fileName) {
        const buffer = fs.readFileSync(`${__dirname}/assets/${fileName}`);

        return new AttachmentBuilder(buffer, {name: fileName});
    }
}

module.exports = AssetManager;
