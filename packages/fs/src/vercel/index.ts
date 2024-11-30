import { MastraFS, UploadResult } from '@mastra/core';
import { put, del, head } from '@vercel/blob';

// Vercel Blob implementation
export class VercelBlobFS extends MastraFS {
    private clientToken: string;

    constructor(clientToken: string) {
        super();
        this.clientToken = clientToken;
    }

    async uploadFile(file: Buffer | Blob, filename: string): Promise<UploadResult> {
        try {
            const blob = await put(filename, file, {
                access: 'public',
                token: this.clientToken,
            });

            return {
                success: true,
                filename: blob.pathname,
                mimeType: blob.contentType!,
                url: blob.url,
                id: blob.url,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                filename,
                mimeType: '',
                id: '',
            };
        }
    }

    async getFile(fileId: string): Promise<{ data: Buffer, mimeType: string }> {
        try {
            const response = await head(fileId);
            if (!response) {
                throw new Error(`File not found: ${fileId}`);
            }

            const arrayBuffer = await (await fetch(response.url)).arrayBuffer();
            return { data: Buffer.from(arrayBuffer), mimeType: response.contentType! };

        } catch (e) {
            console.error(`Failed to get file: ${fileId}`, e);
            throw e;
        }

    }

    async deleteFile(fileId: string): Promise<boolean> {
        try {
            await del(fileId, { token: this.clientToken });
            return true;
        } catch (error) {
            console.error(`Failed to delete file: ${fileId}`, error);
            return false;
        }
    }
}