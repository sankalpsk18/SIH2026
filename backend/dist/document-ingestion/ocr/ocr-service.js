"use strict";
/**
 * ADALAT360 - OCR Service
 * Tesseract.js integration for document text extraction
 * Supports multi-language OCR (English, Hindi, etc.)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = void 0;
exports.getOcrService = getOcrService;
exports.initializeOcr = initializeOcr;
exports.shutdownOcr = shutdownOcr;
const tesseract_js_1 = require("tesseract.js");
const sharp = __importStar(require("sharp"));
const index_js_1 = require("../../config/index.js");
const logger_js_1 = require("../../utils/logger.js");
// ============================================================================
// OCR SERVICE CLASS
// ============================================================================
class OcrService {
    worker = null;
    initialized = false;
    supportedLanguages = [];
    async initialize() {
        if (this.initialized && this.worker) {
            return;
        }
        if (!index_js_1.config.ingestion.ocr.enabled) {
            logger_js_1.logger.warn('OCR is disabled in config');
            this.initialized = true;
            return;
        }
        try {
            this.supportedLanguages = index_js_1.config.ingestion.ocr.languages;
            logger_js_1.logger.info(`Initializing OCR with languages: ${this.supportedLanguages.join(', ')}`);
            // Create worker with specified languages
            this.worker = await (0, tesseract_js_1.createWorker)(this.supportedLanguages, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        logger_js_1.logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });
            // Set OCR parameters
            await this.worker.setParameters({
                tessedit_pageseg_mode: index_js_1.config.ingestion.ocr.dpi > 300 ? '6' : '3', // Assume single block for high DPI
                preserve_interword_spaces: '1',
                tessedit_ocr_engine_mode: '1', // LSTM only
            });
            this.initialized = true;
            logger_js_1.logger.info('OCR service initialized successfully');
        }
        catch (error) {
            logger_js_1.logger.error('Failed to initialize OCR service:', error);
            throw error;
        }
    }
    async shutdown() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.initialized = false;
            logger_js_1.logger.info('OCR service shut down');
        }
    }
    // ========================================================================
    // IMAGE PREPROCESSING
    // ========================================================================
    async preprocessImage(inputPath, outputPath, options = {}) {
        const { dpi = index_js_1.config.ingestion.ocr.dpi, deskew = true, denoise = true, enhanceContrast = true, binarize = true, } = options;
        let image = sharp(inputPath);
        // Get metadata
        const metadata = await image.metadata();
        // Resize to target DPI if needed
        if (metadata.density && metadata.density !== dpi) {
            const scaleFactor = dpi / metadata.density;
            const width = Math.round((metadata.width || 0) * scaleFactor);
            const height = Math.round((metadata.height || 0) * scaleFactor);
            image = image.resize(width, height, { kernel: sharp.kernel.lanczos3 });
        }
        // Apply preprocessing pipeline
        if (denoise) {
            image = image.median(3); // Noise reduction
        }
        if (enhanceContrast) {
            image = image.normalize(); // Auto contrast enhancement
            image = image.modulate({ brightness: 1.1, saturation: 0 }); // Slight brightness boost
        }
        if (binarize) {
            image = image.threshold(128); // Simple binarization
            // For better results, could use adaptive thresholding:
            // image = image.threshold({ adaptive: true, blockSize: 15, constant: 10 });
        }
        // Deskew (requires sharp 0.32+ with libvips 8.12+)
        if (deskew) {
            try {
                image = image.rotate({ angle: 0 }); // Placeholder - actual deskew needs more complex logic
            }
            catch {
                logger_js_1.logger.warn('Deskew not available, skipping');
            }
        }
        // Save as TIFF (best for Tesseract)
        await image.tiff({
            compression: 'lzw',
            predictor: 'horizontal',
            tile: true,
            pyramid: false,
        }).toFile(outputPath);
        const outMetadata = await sharp(outputPath).metadata();
        return {
            width: outMetadata.width || 0,
            height: outMetadata.height || 0,
            channels: outMetadata.channels || 0,
        };
    }
    // ========================================================================
    // OCR RECOGNITION
    // ========================================================================
    async recognize(imagePath, options = {}) {
        const startTime = Date.now();
        if (!this.initialized || !this.worker) {
            await this.initialize();
        }
        if (!index_js_1.config.ingestion.ocr.enabled) {
            return this.mockOcrResult(imagePath);
        }
        try {
            const language = options.language || this.supportedLanguages[0];
            const dpi = options.dpi || index_js_1.config.ingestion.ocr.dpi;
            // Set page segmentation mode
            const psm = options.psm ?? 3; // Default: fully automatic
            await this.worker.setParameters({
                tessedit_pageseg_mode: psm.toString(),
            });
            // Recognize
            const result = await this.worker.recognize(imagePath);
            // Parse pages
            const pages = result.data.pages.map((page, index) => ({
                page_number: index + 1,
                text: page.text,
                confidence: page.confidence,
                bbox: page.bbox ? [page.bbox.x0, page.bbox.y0, page.bbox.x1, page.bbox.y1] : undefined,
                words: page.words?.map(w => ({
                    text: w.text,
                    confidence: w.confidence,
                    bbox: [w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1],
                })),
            }));
            const fullText = pages.map(p => p.text).join('\n\n');
            const avgConfidence = pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;
            return {
                text: fullText,
                confidence: avgConfidence,
                language,
                pages,
                processing_time_ms: Date.now() - startTime,
            };
        }
        catch (error) {
            logger_js_1.logger.error('OCR recognition failed:', error);
            throw new Error(`OCR failed: ${error.message}`);
        }
    }
    async recognizeFromBuffer(buffer, options = {}) {
        if (!this.initialized || !this.worker) {
            await this.initialize();
        }
        try {
            const result = await this.worker.recognize(buffer);
            const pages = result.data.pages.map((page, index) => ({
                page_number: index + 1,
                text: page.text,
                confidence: page.confidence,
                bbox: page.bbox ? [page.bbox.x0, page.bbox.y0, page.bbox.x1, page.bbox.y1] : undefined,
            }));
            const fullText = pages.map(p => p.text).join('\n\n');
            const avgConfidence = pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;
            return {
                text: fullText,
                confidence: avgConfidence,
                language: options.language || this.supportedLanguages[0],
                pages,
                processing_time_ms: 0, // Not tracked for buffer
            };
        }
        catch (error) {
            logger_js_1.logger.error('OCR from buffer failed:', error);
            throw new Error(`OCR failed: ${error.message}`);
        }
    }
    // ========================================================================
    // PDF OCR (convert pages to images first)
    // ========================================================================
    async recognizePdf(pdfPath, options = {}) {
        const { maxPages = 50, ...ocrOptions } = options;
        const startTime = Date.now();
        try {
            // Convert PDF pages to images
            const pdfBuffer = await sharp(pdfPath).toBuffer();
            // Note: sharp doesn't support PDF natively without libvips PDF support
            // In production, use pdf2pic or pdf.js to convert pages to images
            // For now, mock - in production:
            // 1. Use pdf2pic to convert each page to PNG
            // 2. Run OCR on each page
            // 3. Combine results
            logger_js_1.logger.warn('PDF OCR not fully implemented - using mock');
            return this.mockOcrResult(pdfPath);
        }
        catch (error) {
            logger_js_1.logger.error('PDF OCR failed:', error);
            throw new Error(`PDF OCR failed: ${error.message}`);
        }
    }
    // ========================================================================
    // METADATA EXTRACTION
    // ========================================================================
    async extractMetadata(filePath) {
        try {
            const metadata = await sharp(filePath).metadata();
            const stats = await import('fs').then(fs => fs.promises.stat(filePath));
            return {
                author: metadata.exif?.Artist || metadata.iptc?.byLine,
                creator_tool: metadata.exif?.Software,
                creation_date: metadata.exif?.DateTimeOriginal ? new Date(metadata.exif.DateTimeOriginal) : undefined,
                modification_date: metadata.exif?.DateTime ? new Date(metadata.exif.DateTime) : undefined,
                page_count: metadata.pages,
                word_count: undefined, // Would need OCR first
                character_count: undefined,
                language: undefined, // Would need language detection
                device_info: {
                    make: metadata.exif?.Make,
                    model: metadata.exif?.Model,
                    lens: metadata.exif?.LensModel,
                },
                location: metadata.exif?.GPSLatitude && metadata.exif?.GPSLongitude ? {
                    latitude: this.convertGps(metadata.exif.GPSLatitude, metadata.exif.GPSLatitudeRef),
                    longitude: this.convertGps(metadata.exif.GPSLongitude, metadata.exif.GPSLongitudeRef),
                } : undefined,
                camera_info: {
                    iso: metadata.exif?.ISOSpeedRatings,
                    aperture: metadata.exif?.FNumber,
                    shutter_speed: metadata.exif?.ExposureTime,
                    focal_length: metadata.exif?.FocalLength,
                },
                gps_coordinates: metadata.exif?.GPSLatitude && metadata.exif?.GPSLongitude ? {
                    latitude: this.convertGps(metadata.exif.GPSLatitude, metadata.exif.GPSLatitudeRef),
                    longitude: this.convertGps(metadata.exif.GPSLongitude, metadata.exif.GPSLongitudeRef),
                    altitude: metadata.exif?.GPSAltitude,
                } : undefined,
            };
        }
        catch (error) {
            logger_js_1.logger.error('Metadata extraction failed:', error);
            return {};
        }
    }
    convertGps(gps, ref) {
        if (!gps || !Array.isArray(gps))
            return 0;
        const [degrees, minutes, seconds] = gps;
        let decimal = degrees + minutes / 60 + seconds / 3600;
        if (ref === 'S' || ref === 'W')
            decimal = -decimal;
        return decimal;
    }
    // ========================================================================
    // MOCK FOR DEVELOPMENT
    // ========================================================================
    mockOcrResult(filePath) {
        return {
            text: `[OCR Disabled/Mock] Extracted text from ${filePath}\n\nThis is a mock OCR result for development.\nActual OCR would extract text from the document.`,
            confidence: 95.0,
            language: 'eng',
            pages: [{
                    page_number: 1,
                    text: `[OCR Disabled/Mock] Extracted text from ${filePath}`,
                    confidence: 95.0,
                }],
            processing_time_ms: 100,
        };
    }
    // ========================================================================
    // LANGUAGE DETECTION (simple)
    // ========================================================================
    async detectLanguage(text) {
        // Simple script-based detection
        const devanagari = (text.match(/[ऀ-ॿ]/g) || []).length;
        const latin = (text.match(/[a-zA-Z]/g) || []).length;
        if (devanagari > latin * 0.3)
            return 'hin';
        return 'eng';
    }
}
exports.OcrService = OcrService;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let ocrServiceInstance = null;
function getOcrService() {
    if (!ocrServiceInstance) {
        ocrServiceInstance = new OcrService();
    }
    return ocrServiceInstance;
}
async function initializeOcr() {
    const service = getOcrService();
    await service.initialize();
    return service;
}
async function shutdownOcr() {
    if (ocrServiceInstance) {
        await ocrServiceInstance.shutdown();
        ocrServiceInstance = null;
    }
}
//# sourceMappingURL=ocr-service.js.map