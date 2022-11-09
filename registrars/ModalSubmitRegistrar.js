const {ModalSubmitInteraction, Client} = require("discord.js");

class ModalSubmitRegistrar {
    static callbacks = {};

    /**
     * @param modalId {string}
     * @param callback {(client: Client, interaction: ModalSubmitInteraction) => Promise<void>}
     */
    static register(modalId, callback) {
        this.callbacks[modalId] = callback;
    }
}

module.exports = ModalSubmitRegistrar;
