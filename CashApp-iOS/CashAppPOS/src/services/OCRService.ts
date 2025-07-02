/**
 * OCRService - Optical Character Recognition service for receipt processing
 * Supports multiple OCR providers with fallback mechanisms
 */

import { Platform } from 'react-native';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { scanReceipt, ScannedItemAPIResponse } from './InventoryApiService';

export interface OCRResult {
  confidence: number;
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ProcessedReceipt {
  items: ScannedItemAPIResponse[];
  totalAmount?: number;
  receiptDate?: string;
  vendor?: string;
  confidence: number;
}

export interface OCRConfig {
  provider: 'tesseract' | 'aws_textract' | 'google_vision' | 'mock';
  apiKey?: string;
  region?: string;
  language?: string;
}

class OCRService {
  private config: OCRConfig;

  constructor(config: OCRConfig = { provider: 'mock' }) {
    this.config = config;
  }

  /**
   * Launch camera to capture receipt image
   */
  async captureReceiptImage(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const options = {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        includeBase64: true,
        maxWidth: 1024,
        maxHeight: 1024,
      };

      launchCamera(options, (response: ImagePickerResponse) => {
        if (response.didCancel) {
          resolve(null);
          return;
        }

        if (response.errorMessage) {
          reject(new Error(response.errorMessage));
          return;
        }

        const asset = response.assets?.[0];
        if (asset?.base64) {
          resolve(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          reject(new Error('Failed to capture image with base64 data'));
        }
      });
    });
  }

  /**
   * Select receipt image from gallery
   */
  async selectReceiptImage(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const options = {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        includeBase64: true,
        maxWidth: 1024,
        maxHeight: 1024,
      };

      launchImageLibrary(options, (response: ImagePickerResponse) => {
        if (response.didCancel) {
          resolve(null);
          return;
        }

        if (response.errorMessage) {
          reject(new Error(response.errorMessage));
          return;
        }

        const asset = response.assets?.[0];
        if (asset?.base64) {
          resolve(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          reject(new Error('Failed to select image with base64 data'));
        }
      });
    });
  }

  /**
   * Process receipt image using the configured OCR provider
   */
  async processReceiptImage(imageBase64: string): Promise<ProcessedReceipt> {
    try {
      switch (this.config.provider) {
        case 'tesseract':
          return await this.processTesseract(imageBase64);
        case 'aws_textract':
          return await this.processAWSTextract(imageBase64);
        case 'google_vision':
          return await this.processGoogleVision(imageBase64);
        case 'mock':
        default:
          return await this.processMockOCR(imageBase64);
      }
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mock OCR processing using the backend API
   */
  private async processMockOCR(imageBase64: string): Promise<ProcessedReceipt> {
    try {
      // Use the backend scan-receipt endpoint
      const items = await scanReceipt(imageBase64);
      
      // Calculate overall confidence
      const avgConfidence = items.reduce((sum, item) => sum + (item.confidence || 0.8), 0) / items.length;
      
      // Calculate total amount from items
      const totalAmount = items.reduce((sum, item) => sum + item.price, 0);

      return {
        items,
        totalAmount,
        confidence: avgConfidence,
        receiptDate: new Date().toISOString(),
        vendor: 'Mock Supplier Ltd'
      };
    } catch (error) {
      throw new Error(`Mock OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Tesseract OCR processing (React Native)
   */
  private async processTesseract(imageBase64: string): Promise<ProcessedReceipt> {
    try {
      // TODO: Implement Tesseract.js or react-native-tesseract-ocr integration
      console.warn('Tesseract OCR not yet implemented, falling back to mock');
      return await this.processMockOCR(imageBase64);
    } catch (error) {
      throw new Error(`Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * AWS Textract processing
   */
  private async processAWSTextract(imageBase64: string): Promise<ProcessedReceipt> {
    try {
      // TODO: Implement AWS Textract integration
      console.warn('AWS Textract not yet implemented, falling back to mock');
      return await this.processMockOCR(imageBase64);
    } catch (error) {
      throw new Error(`AWS Textract failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Google Vision API processing
   */
  private async processGoogleVision(imageBase64: string): Promise<ProcessedReceipt> {
    try {
      // TODO: Implement Google Vision API integration
      console.warn('Google Vision API not yet implemented, falling back to mock');
      return await this.processMockOCR(imageBase64);
    } catch (error) {
      throw new Error(`Google Vision API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from image using configured OCR provider
   */
  async extractText(imageBase64: string): Promise<OCRResult[]> {
    const processedReceipt = await this.processReceiptImage(imageBase64);
    
    // Convert processed receipt items to OCR results
    return processedReceipt.items.map((item, index) => ({
      confidence: item.confidence || 0.8,
      text: `${item.name} - ${item.quantity} x $${item.price.toFixed(2)}`,
      boundingBox: {
        x: 0,
        y: index * 50,
        width: 300,
        height: 40
      }
    }));
  }

  /**
   * Validate OCR results for quality
   */
  validateOCRResults(results: OCRResult[]): boolean {
    if (results.length === 0) {
      return false;
    }

    const avgConfidence = results.reduce((sum, result) => sum + result.confidence, 0) / results.length;
    return avgConfidence > 0.6; // Minimum 60% confidence threshold
  }

  /**
   * Update OCR configuration
   */
  updateConfig(newConfig: Partial<OCRConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current OCR configuration
   */
  getConfig(): OCRConfig {
    return { ...this.config };
  }
}

// Create default OCR service instance
export const ocrService = new OCRService({
  provider: 'mock', // Start with mock for development
  language: 'en'
});

export default OCRService;