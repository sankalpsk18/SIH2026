/**
 * ADALAT360 - File Hashing Utilities
 * SHA-256 and other hash algorithms for file integrity
 */
export type HashAlgorithm = 'sha256' | 'sha512' | 'md5' | 'sha1';
export interface HashResult {
    algorithm: HashAlgorithm;
    hash: string;
    fileSize: number;
    computedAt: Date;
}
export interface MultiHashResult {
    sha256: string;
    sha512: string;
    md5: string;
    fileSize: number;
    computedAt: Date;
}
/**
 * Compute hash of a file using streams (memory efficient)
 */
export declare function computeFileHash(filePath: string, algorithm?: HashAlgorithm): Promise<HashResult>;
/**
 * Compute hash from a buffer
 */
export declare function computeBufferHash(buffer: Buffer, algorithm?: HashAlgorithm): HashResult;
/**
 * Compute hash from a stream
 */
export declare function computeStreamHash(stream: NodeJS.ReadableStream, algorithm?: HashAlgorithm): Promise<HashResult>;
/**
 * Compute multiple hashes in a single pass (efficient)
 */
export declare function computeMultiHash(filePath: string): Promise<MultiHashResult>;
/**
 * Compute multiple hashes from buffer
 */
export declare function computeMultiHashFromBuffer(buffer: Buffer): MultiHashResult;
/**
 * Compute multiple hashes from stream
 */
export declare function computeMultiHashFromStream(stream: NodeJS.ReadableStream): Promise<MultiHashResult>;
/**
 * Compute SSDEEP hash (context triggered piecewise hash)
 * Note: Requires ssdeep library or native binding
 * This is a placeholder - in production use 'ssdeep' npm package
 */
export declare function computeSsdeepHash(_filePath: string): Promise<string>;
/**
 * Compute TLSH hash (Trend Micro Locality Sensitive Hash)
 * Note: Requires tlsh library
 */
export declare function computeTlshHash(_filePath: string): Promise<string>;
/**
 * Verify file hash matches expected value
 */
export declare function verifyFileHash(filePath: string, expectedHash: string, algorithm?: HashAlgorithm): Promise<{
    verified: boolean;
    computedHash: string;
    algorithm: HashAlgorithm;
}>;
/**
 * Verify buffer hash
 */
export declare function verifyBufferHash(buffer: Buffer, expectedHash: string, algorithm?: HashAlgorithm): {
    verified: boolean;
    computedHash: string;
    algorithm: HashAlgorithm;
};
/**
 * Compute hash chain for document versions
 * Each version's hash includes previous version's hash
 */
export declare function computeVersionChainHash(currentFileHash: string, previousVersionHash?: string): string;
/**
 * Verify version chain integrity
 */
export declare function verifyVersionChain(versionHashes: string[]): {
    valid: boolean;
    brokenAt?: number;
};
export interface MerkleProof {
    leafHash: string;
    leafIndex: number;
    siblings: Array<{
        hash: string;
        position: 'left' | 'right';
    }>;
    rootHash: string;
}
export declare class MerkleTree {
    private leaves;
    private layers;
    constructor(hashes: string[]);
    private buildTree;
    getRoot(): string;
    getProof(index: number): MerkleProof;
    static verifyProof(proof: MerkleProof): boolean;
}
/**
 * Create Merkle tree from file hashes
 */
export declare function createMerkleTree(hashes: string[]): {
    tree: MerkleTree;
    root: string;
};
/**
 * Constant-time hash comparison
 */
export declare function constantTimeHashCompare(hash1: string, hash2: string): boolean;
//# sourceMappingURL=file-hasher.d.ts.map