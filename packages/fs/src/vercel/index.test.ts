import { describe, expect, it, beforeAll } from '@jest/globals';
import { VercelBlobFS } from './';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!BLOB_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
}

const createdFiles: string[] = [];

describe('VercelBlobFS Integration Tests', () => {
    let fs: VercelBlobFS;

    beforeAll(() => {
        fs = new VercelBlobFS(BLOB_TOKEN);
    });

    afterAll(async () => {
        // Cleanup all created files
        for (const fileId of createdFiles) {
            try {
                await fs.deleteFile(fileId);
            } catch (error) {
                console.error(`Failed to delete test file ${fileId}:`, error);
            }
        }
    });

    it('should complete full file lifecycle', async () => {
        // Create test file
        const testContent = 'Hello, World! ' + Date.now();
        const testBuffer = Buffer.from(testContent);
        const filename = `test-${Date.now()}.txt`;

        // Test upload
        const uploadResult = await fs.uploadFile(testBuffer, filename);
        createdFiles.push(uploadResult.id); // Track for cleanup
        expect(uploadResult.success).toBe(true);
        expect(uploadResult.filename).toBeDefined();
        expect(uploadResult.url).toBeDefined();
        expect(uploadResult.mimeType).toBe('text/plain');

        // Test retrieval
        const retrievedBuffer = await fs.getFile(uploadResult.id);
        expect(retrievedBuffer.toString()).toBe(testContent);

        // Test deletion
        const deleteResult = await fs.deleteFile(uploadResult.id);
        expect(deleteResult).toBe(true);

        // Verify file is gone
        await expect(fs.getFile(uploadResult.id)).rejects.toThrow();
    }, 10000); // Increase timeout for network requests

    it('should handle non-existent files', async () => {
        await expect(fs.getFile('non-existent-file')).rejects.toThrow();
    });

    it('should handle binary files', async () => {
        // Create a small binary file (e.g., a simple image)
        const binaryData = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A // PNG header
        ]);
        const filename = `test-binary-${Date.now()}.png`;

        const uploadResult = await fs.uploadFile(binaryData, filename);
        createdFiles.push(uploadResult.id); // Track for cleanup

        expect(uploadResult.success).toBe(true);
        expect(uploadResult.mimeType).toBe('image/png');

        const retrievedBuffer = await fs.getFile(uploadResult.id);
        expect(Buffer.compare(retrievedBuffer, binaryData)).toBe(0);

        // Cleanup
        await fs.deleteFile(uploadResult.id);
    });

    it('should handle large files', async () => {
        // Create a 1MB file
        const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB
        largeBuffer.fill('A');
        const filename = `test-large-${Date.now()}.txt`;

        const uploadResult = await fs.uploadFile(largeBuffer, filename);
        createdFiles.push(uploadResult.id); // Track for cleanup
        expect(uploadResult.success).toBe(true);

        const retrievedBuffer = await fs.getFile(uploadResult.id);
        expect(retrievedBuffer.length).toBe(largeBuffer.length);
        expect(Buffer.compare(retrievedBuffer, largeBuffer)).toBe(0);

        // Cleanup
        await fs.deleteFile(uploadResult.id);
    }, 30000); // Increase timeout for large file
});