/**
 * ADALAT360 - OCR Service
 * Tesseract.js integration for document text extraction
 * Supports multi-language OCR (English, Hindi, etc.)
 */
import { OcrResult, OcrOptions, DocumentMetadata } from '../../models/document.js';
export declare class OcrService {
    private worker;
    private initialized;
    private supportedLanguages;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    preprocessImage(inputPath: string, outputPath: string, options?: {
        dpi?: number;
        deskew?: boolean;
        denoise?: boolean;
        enhanceContrast?: boolean;
        binarize?: boolean;
    }): Promise<{
        width: number;
        height: number;
        channels: number;
    }>;
    recognize(imagePath: string, options?: OcrOptions): Promise<OcrResult>;
    recognizeFromBuffer(buffer: Buffer, options?: OcrOptions): Promise<OcrResult>;
    recognizePdf(pdfPath: string, options?: OcrOptions & {
        maxPages?: number;
    }): Promise<OcrResult>;
    extractMetadata(filePath: string): Promise<DocumentMetadata>;
    private convertGps;
    private mockOcrResult;
    detectLanguage(text: string): Promise<string>;
}
export declare function getOcrService(): OcrService;
export declare function initializeOcr(): Promise<OcrService>;
export declare function shutdownOcr(): Promise<void>;
//# sourceMappingURL=ocr-service.d.ts.map