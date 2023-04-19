const {ButtonInteraction, Client} = require("discord.js");

class ButtonRegistrar {
    static callbacks = {};

    /**
     * @param buttonId {string}
     * @param callback {(client: Client, interaction: ButtonInteraction) => Promise<void>}
     */
    static register(buttonId, callback) {
        this.callbacks[buttonId] = callback;
    }
}

module.exports = ButtonRegistrar;
