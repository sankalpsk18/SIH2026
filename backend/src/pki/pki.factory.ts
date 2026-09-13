/**
 * ADALAT360 - PKI Factory
 * Creates and manages CA instances based on configuration
 */

import { CertificateAuthority, CaFactory, CaFactoryOptions, CaType } from './ca-interface.js';
import { LocalOpenSSLCa, LocalCaFactory } from './local-ca.js';
import { CAConfig, DEFAULT_CA_CONFIG } from '../models/pki.js';

export class PkiFactory implements CaFactory {
  private caInstances: Map<string, CertificateAuthority> = new Map();
  private defaultConfig: CAConfig;

  constructor(config?: CAConfig) {
    this.defaultConfig = { ...DEFAULT_CA_CONFIG, ...config };
  }

  async createCa(options: CaFactoryOptions): Promise<CertificateAuthority> {
    const { type, config, customProvider } = options;

    // Use custom provider if provided
    if (customProvider) {
      const instanceId = `${type}-custom-${Date.now()}`;
      this.caInstances.set(instanceId, customProvider);
      return customProvider;
    }

    // Merge with default config
    const mergedConfig = { ...this.defaultConfig, ...config };

    let ca: CertificateAuthority;

    switch (type) {
      case 'local':
        const localFactory = new LocalCaFactory();
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

  async getCa(instanceId?: string): Promise<CertificateAuthority | null> {
    if (instanceId) {
      return this.caInstances.get(instanceId) || null;
    }
    // Return first instance if no ID specified
    return this.caInstances.values().next().value || null;
  }

  async getAllCa(): Promise<CertificateAuthority[]> {
    return Array.from(this.caInstances.values());
  }

  async removeCa(instanceId: string): Promise<boolean> {
    const ca = this.caInstances.get(instanceId);
    if (ca) {
      await ca.shutdown();
      this.caInstances.delete(instanceId);
      return true;
    }
    return false;
  }

  getSupportedTypes(): CaType[] {
    return ['local', 'vault', 'aws', 'azure', 'gcp'];
  }

  getDefaultConfig(): CAConfig {
    return this.defaultConfig;
  }

  updateDefaultConfig(config: Partial<CAConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  // Health check for all instances
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [id, ca] of this.caInstances.entries()) {
      try {
        results[id] = await ca.isHealthy();
      } catch {
        results[id] = false;
      }
    }
    return results;
  }

  // Shutdown all instances
  async shutdownAll(): Promise<void> {
    for (const [id, ca] of this.caInstances.entries()) {
      try {
        await ca.shutdown();
      } catch (err) {
        console.error(`Error shutting down CA ${id}:`, err);
      }
    }
    this.caInstances.clear();
  }
}

// Singleton instance
let pkiFactoryInstance: PkiFactory | null = null;

export function getPkiFactory(config?: CAConfig): PkiFactory {
  if (!pkiFactoryInstance) {
    pkiFactoryInstance = new PkiFactory(config);
  }
  return pkiFactoryInstance;
}

export function setPkiFactory(factory: PkiFactory): void {
  pkiFactoryInstance = factory;
}