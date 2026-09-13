/**
 * ADALAT360 - PKI Factory
 * Creates and manages CA instances based on configuration
 */
import { CertificateAuthority, CaFactory, CaFactoryOptions, CaType } from './ca-interface.js';
import { CAConfig } from '../models/pki.js';
export declare class PkiFactory implements CaFactory {
    private caInstances;
    private defaultConfig;
    constructor(config?: CAConfig);
    createCa(options: CaFactoryOptions): Promise<CertificateAuthority>;
    getCa(instanceId?: string): Promise<CertificateAuthority | null>;
    getAllCa(): Promise<CertificateAuthority[]>;
    removeCa(instanceId: string): Promise<boolean>;
    getSupportedTypes(): CaType[];
    getDefaultConfig(): CAConfig;
    updateDefaultConfig(config: Partial<CAConfig>): void;
    healthCheck(): Promise<Record<string, boolean>>;
    shutdownAll(): Promise<void>;
}
export declare function getPkiFactory(config?: CAConfig): PkiFactory;
export declare function setPkiFactory(factory: PkiFactory): void;
//# sourceMappingURL=pki.factory.d.ts.map