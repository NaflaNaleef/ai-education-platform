export const validateFile = (file: File) => {
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain'
    ];

    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid file type' };
    }

    if (file.size > maxSize) {
        return { valid: false, error: 'File too large' };
    }

    return { valid: true };
};

export const getFileExtension = (fileName: string) => {
    return fileName.split('.').pop()?.toLowerCase();
}; 