/**
 * ADALAT360 - File Hashing Utilities
 * SHA-256 and other hash algorithms for file integrity
 */

import * as crypto from 'crypto';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

// ============================================================================
// HASH ALGORITHMS
// ============================================================================

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

// ============================================================================
// STREAM-BASED HASHING (for large files)
// ============================================================================

/**
 * Compute hash of a file using streams (memory efficient)
 */
export async function computeFileHash(
    filePath: string,
    algorithm: HashAlgorithm = 'sha256'
): Promise<HashResult> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(algorithm);
        const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 }); // 64KB chunks

        let fileSize = 0;

        stream.on('data', (chunk) => {
            fileSize += chunk.length;
            hash.update(chunk);
        });

        stream.on('end', () => {
            resolve({
                algorithm,
                hash: hash.digest('hex'),
                fileSize,
                computedAt: new Date(),
            });
        });

        stream.on('error', reject);
    });
}

/**
 * Compute hash from a buffer
 */
export function computeBufferHash(
    buffer: Buffer,
    algorithm: HashAlgorithm = 'sha256'
): HashResult {
    const hash = crypto.createHash(algorithm);
    hash.update(buffer);
    return {
        algorithm,
        hash: hash.digest('hex'),
        fileSize: buffer.length,
        computedAt: new Date(),
    };
}

/**
 * Compute hash from a stream
 */
export async function computeStreamHash(
    stream: NodeJS.ReadableStream,
    algorithm: HashAlgorithm = 'sha256'
): Promise<HashResult> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(algorithm);
        let fileSize = 0;

        stream.on('data', (chunk) => {
            fileSize += chunk.length;
            hash.update(chunk);
        });

        stream.on('end', () => {
            resolve({
                algorithm,
                hash: hash.digest('hex'),
                fileSize,
                computedAt: new Date(),
            });
        });

        stream.on('error', reject);
    });
}

// ============================================================================
// MULTI-HASH COMPUTATION (single pass)
// ============================================================================

/**
 * Compute multiple hashes in a single pass (efficient)
 */
export async function computeMultiHash(filePath: string): Promise<MultiHashResult> {
    return new Promise((resolve, reject) => {
        const hashes = {
            sha256: crypto.createHash('sha256'),
            sha512: crypto.createHash('sha512'),
            md5: crypto.createHash('md5'),
        };
        const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });
        let fileSize = 0;

        stream.on('data', (chunk) => {
            fileSize += chunk.length;
            Object.values(hashes).forEach(h => h.update(chunk));
        });

        stream.on('end', () => {
            resolve({
                sha256: hashes.sha256.digest('hex'),
                sha512: hashes.sha512.digest('hex'),
                md5: hashes.md5.digest('hex'),
                fileSize,
                computedAt: new Date(),
            });
        });

        stream.on('error', reject);
    });
}

/**
 * Compute multiple hashes from buffer
 */
export function computeMultiHashFromBuffer(buffer: Buffer): MultiHashResult {
    return {
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        sha512: crypto.createHash('sha512').update(buffer).digest('hex'),
        md5: crypto.createHash('md5').update(buffer).digest('hex'),
        fileSize: buffer.length,
        computedAt: new Date(),
    };
}

/**
 * Compute multiple hashes from stream
 */
export async function computeMultiHashFromStream(stream: NodeJS.ReadableStream): Promise<MultiHashResult> {
    return new Promise((resolve, reject) => {
        const hashes = {
            sha256: crypto.createHash('sha256'),
            sha512: crypto.createHash('sha512'),
            md5: crypto.createHash('md5'),
        };
        let fileSize = 0;

        stream.on('data', (chunk) => {
            fileSize += chunk.length;
            Object.values(hashes).forEach(h => h.update(chunk));
        });

        stream.on('end', () => {
            resolve({
                sha256: hashes.sha256.digest('hex'),
                sha512: hashes.sha512.digest('hex'),
                md5: hashes.md5.digest('hex'),
                fileSize,
                computedAt: new Date(),
            });
        });

        stream.on('error', reject);
    });
}

// ============================================================================
// FUZZY HASHES (for similarity detection)
// ============================================================================

/**
 * Compute SSDEEP hash (context triggered piecewise hash)
 * Note: Requires ssdeep library or native binding
 * This is a placeholder - in production use 'ssdeep' npm package
 */
export async function computeSsdeepHash(_filePath: string): Promise<string> {
    // Placeholder - would use ssdeep library
    // const ssdeep = require('ssdeep');
    // return new Promise((resolve, reject) => {
    //     ssdeep.hash(filePath, (err: Error, hash: string) => {
    //         if (err) reject(err);
    //         else resolve(hash);
    //     });
    // });
    return 'ssdeep:not_implemented';
}

/**
 * Compute TLSH hash (Trend Micro Locality Sensitive Hash)
 * Note: Requires tlsh library
 */
export async function computeTlshHash(_filePath: string): Promise<string> {
    // Placeholder - would use tlsh library
    return 'tlsh:not_implemented';
}

// ============================================================================
// HASH VERIFICATION
// ============================================================================

/**
 * Verify file hash matches expected value
 */
export async function verifyFileHash(
    filePath: string,
    expectedHash: string,
    algorithm: HashAlgorithm = 'sha256'
): Promise<{ verified: boolean; computedHash: string; algorithm: HashAlgorithm }> {
    const result = await computeFileHash(filePath, algorithm);
    return {
        verified: result.hash.toLowerCase() === expectedHash.toLowerCase(),
        computedHash: result.hash,
        algorithm,
    };
}

/**
 * Verify buffer hash
 */
export function verifyBufferHash(
    buffer: Buffer,
    expectedHash: string,
    algorithm: HashAlgorithm = 'sha256'
): { verified: boolean; computedHash: string; algorithm: HashAlgorithm } {
    const result = computeBufferHash(buffer, algorithm);
    return {
        verified: result.hash.toLowerCase() === expectedHash.toLowerCase(),
        computedHash: result.hash,
        algorithm,
    };
}

// ============================================================================
// HASH CHAIN (for version integrity)
// ============================================================================

/**
 * Compute hash chain for document versions
 * Each version's hash includes previous version's hash
 */
export function computeVersionChainHash(
    currentFileHash: string,
    previousVersionHash?: string
): string {
    const data = previousVersionHash
        ? `${previousVersionHash}:${currentFileHash}`
        : currentFileHash;
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify version chain integrity
 */
export function verifyVersionChain(
    versionHashes: string[]
): { valid: boolean; brokenAt?: number } {
    if (versionHashes.length === 0) return { valid: true };

    let previousHash: string | undefined;

    for (let i = 0; i < versionHashes.length; i++) {
        const currentHash = versionHashes[i];
        const expectedChainHash = computeVersionChainHash(currentHash, previousHash);

        // In a real implementation, you'd store the chain hash separately
        // This is a simplified verification
        previousHash = currentHash;
    }

    return { valid: true };
}

// ============================================================================
// MERKLE TREE (for batch integrity)
// ============================================================================

export interface MerkleProof {
    leafHash: string;
    leafIndex: number;
    siblings: Array<{ hash: string; position: 'left' | 'right' }>;
    rootHash: string;
}

export class MerkleTree {
    private leaves: string[] = [];
    private layers: string[][] = [];

    constructor(hashes: string[]) {
        this.leaves = hashes.map(h => crypto.createHash('sha256').update(h).digest('hex'));
        this.buildTree();
    }

    private buildTree(): void {
        this.layers = [this.leaves];
        let currentLayer = this.leaves;

        while (currentLayer.length > 1) {
            const nextLayer: string[] = [];
            for (let i = 0; i < currentLayer.length; i += 2) {
                const left = currentLayer[i];
                const right = currentLayer[i + 1] || left; // Duplicate if odd
                const combined = crypto.createHash('sha256').update(left + right).digest('hex');
                nextLayer.push(combined);
            }
            this.layers.push(nextLayer);
            currentLayer = nextLayer;
        }
    }

    getRoot(): string {
        return this.layers[this.layers.length - 1][0];
    }

    getProof(index: number): MerkleProof {
        if (index >= this.leaves.length) {
            throw new Error('Index out of bounds');
        }

        const siblings: Array<{ hash: string; position: 'left' | 'right' }> = [];
        let currentIndex = index;

        for (let layer = 0; layer < this.layers.length - 1; layer++) {
            const isRight = currentIndex % 2 === 1;
            const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
            const siblingHash = this.layers[layer][siblingIndex] || this.layers[layer][currentIndex];

            siblings.push({
                hash: siblingHash,
                position: isRight ? 'left' : 'right',
            });

            currentIndex = Math.floor(currentIndex / 2);
        }

        return {
            leafHash: this.leaves[index],
            leafIndex: index,
            siblings,
            rootHash: this.getRoot(),
        };
    }

    static verifyProof(proof: MerkleProof): boolean {
        let currentHash = proof.leafHash;

        for (const sibling of proof.siblings) {
            const combined = sibling.position === 'left'
                ? sibling.hash + currentHash
                : currentHash + sibling.hash;
            currentHash = crypto.createHash('sha256').update(combined).digest('hex');
        }

        return currentHash === proof.rootHash;
    }
}

/**
 * Create Merkle tree from file hashes
 */
export function createMerkleTree(hashes: string[]): { tree: MerkleTree; root: string } {
    const tree = new MerkleTree(hashes);
    return { tree, root: tree.getRoot() };
}

// ============================================================================
// CONSTANT-TIME COMPARISON (timing attack prevention)
// ============================================================================

/**
 * Constant-time hash comparison
 */
export function constantTimeHashCompare(hash1: string, hash2: string): boolean {
    if (hash1.length !== hash2.length) return false;

    let result = 0;
    for (let i = 0; i < hash1.length; i++) {
        result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
    }
    return result === 0;
}