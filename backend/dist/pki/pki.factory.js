"use strict";
/**
 * ADALAT360 - PKI Factory
 * Creates and manages CA instances based on configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PkiFactory = void 0;
exports.getPkiFactory = getPkiFactory;
exports.setPkiFactory = setPkiFactory;
const local_ca_js_1 = require("./local-ca.js");
const pki_js_1 = require("../models/pki.js");
class PkiFactory {
    caInstances = new Map();
    defaultConfig;
    constructor(config) {
        this.defaultConfig = { ...pki_js_1.DEFAULT_CA_CONFIG, ...config };
    }
    async createCa(options) {
        const { type, config, customProvider } = options;
        // Use custom provider if provided
        if (customProvider) {
            const instanceId = `${type}-custom-${Date.now()}`;
            this.caInstances.set(instanceId, customProvider);
            return customProvider;
        }
        // Merge with default config
        const mergedConfig = { ...this.defaultConfig, ...config };
        let ca;
        switch (type) {
            case 'local':
                const localFactory = new local_ca_js_1.LocalCaFactory();
                ca = await localFactory.createCa({ type: 'local', config: mergedConfig });
                break;
            case 'vault':
                // HashiCorp Vault implementation would go here
                throw new Error('HashiCorp Vault provider not yet implemented');
            case 'aws':
                // AWS Private CA implementation would go here
                throw new Error('AWS Private CA provider not yet implemented');
            case 'azure':
                // Azure Key Vault implementation would go here
                throw new Error('Azure Key Vault provider not yet implemented');
            case 'gcp':
                // GCP Certificate Authority Service implementation would go here
                throw new Error('GCP Certificate Authority provider not yet implemented');
            case 'custom':
                throw new Error('Custom provider requires customProvider option');
            default:
                throw new Error(`Unsupported CA type: ${type}`);
        }
        // Store instance
        const instanceId = `${type}-${Date.now()}`;
        this.caInstances.set(instanceId, ca);
        return ca;
    }
    async getCa(instanceId) {
        if (instanceId) {
            return this.caInstances.get(instanceId) || null;
        }
        // Return first instance if no ID specified
        return this.caInstances.values().next().value || null;
    }
    async getAllCa() {
        return Array.from(this.caInstances.values());
    }
    async removeCa(instanceId) {
        const ca = this.caInstances.get(instanceId);
        if (ca) {
            await ca.shutdown();
            this.caInstances.delete(instanceId);
            return true;
        }
        return false;
    }
    getSupportedTypes() {
        return ['local', 'vault', 'aws', 'azure', 'gcp'];
    }
    getDefaultConfig() {
        return this.defaultConfig;
    }
    updateDefaultConfig(config) {
        this.defaultConfig = { ...this.defaultConfig, ...config };
    }
    // Health check for all instances
    async healthCheck() {
        const results = {};
        for (const [id, ca] of this.caInstances.entries()) {
            try {
                results[id] = await ca.isHealthy();
            }
            catch {
                results[id] = false;
            }
        }
        return results;
    }
    // Shutdown all instances
    async shutdownAll() {
        for (const [id, ca] of this.caInstances.entries()) {
            try {
                await ca.shutdown();
            }
            catch (err) {
                console.error(`Error shutting down CA ${id}:`, err);
            }
        }
        this.caInstances.clear();
    }
}
exports.PkiFactory = PkiFactory;
// Singleton instance
let pkiFactoryInstance = null;
function getPkiFactory(config) {
    if (!pkiFactoryInstance) {
        pkiFactoryInstance = new PkiFactory(config);
    }
    return pkiFactoryInstance;
}
function setPkiFactory(factory) {
    pkiFactoryInstance = factory;
}
//# sourceMappingURL=pki.factory.js.map