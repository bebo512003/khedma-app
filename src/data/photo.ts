import { cropSquare } from '../ui/Cropper';

/**
 * Lets the person crop the photo to a square, then shrinks it to a 256px JPEG (~15KB) so it can live
 * inside the member record. Rejects with an AbortError if they cancel.
 */
export const shrinkPhoto = (file: File): Promise<string> => cropSquare(file);

/** Cancelling the crop isn't an error worth showing. */
export const cancelled = (e: unknown) => (e as Error)?.name === 'AbortError';
