const fs = require("fs");

class DataStorage {
    /** @type {{key: ?string, value: any}} */
    static #cache = {key: null, value: null};

    static #resetCache() {
        this.#cache = {key: null, value: null};
    }

    /**
     * @param key {string}
     */
    static create(key) {
        fs.writeFileSync(`data/${key}.json`, "{}");

        if (this.#cache.key === key) {
            this.#resetCache();
        }
    }

    /**
     * @param key {string}
     * @param value {any}
     */
    static save(key, value) {
        fs.writeFileSync(`data/${key}.json`, JSON.stringify(value));
        this.#cache = {key, value};
    }

    /**
     * @param key {string}
     * @returns {any}
     */
    static load(key) {
        if (this.#cache.key === key) {
            return this.#cache.value;
        }

        const readValue = JSON.parse(fs.readFileSync(`data/${key}.json`).toString());

        this.#cache = {key, value: readValue};

        return readValue;
    }

    /**
     * @param key {string}
     * @param value {Object}
     */
    static modify(key, value) {
        const currentData = this.load(key);
        this.save(key, {...currentData, ...value});

        if (this.#cache.key === key) {
            this.#resetCache();
        }
    }

    /**
     * @param key {string}
     */
    static delete(key) {
        fs.unlinkSync(`data/${key}.json`);

        if (this.#cache.key === key) {
            this.#resetCache();
        }
    }

    /**
     * @param key {string}
     * @returns {boolean}
     */
    static exists(key) {
        return fs.existsSync(`data/${key}.json`)
    }
}

module.exports = DataStorage;
