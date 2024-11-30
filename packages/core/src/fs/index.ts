// Base interface for file operations
export interface FileMetadata {
    filename: string;
    mimeType: string;
    url?: string;
    id: string;
}

export interface UploadResult extends FileMetadata {
    success: boolean;
    error?: string;
}

export abstract class MastraFS {
    abstract uploadFile(file: Buffer | Blob, filename: string): Promise<UploadResult>;
    abstract getFile(fileId: string): Promise<{ data: Buffer, mimeType: string }>;
    abstract deleteFile(fileId: string): Promise<boolean>;
}  