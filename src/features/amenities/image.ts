import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { AMENITY_IMAGE_MAX_BYTES } from '@/constants/commonConstants';
import type { AmenityPhotoInput } from '@/features/amenities/api';

const COMPRESSION_STEPS = [
  { maxWidth: 1600, quality: 0.76 },
  { maxWidth: 1280, quality: 0.64 },
  { maxWidth: 1024, quality: 0.52 },
] as const;

function getBase64ByteLength(base64: string) {
  const paddingLength = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.ceil((base64.length * 3) / 4) - paddingLength;
}

export async function prepareAmenityPhoto(
  uri: string,
  sourceWidth: number,
): Promise<AmenityPhotoInput> {
  for (const step of COMPRESSION_STEPS) {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: Math.min(sourceWidth, step.maxWidth), height: null });
    const renderedImage = await context.renderAsync();
    const result = await renderedImage.saveAsync({
      base64: true,
      compress: step.quality,
      format: SaveFormat.JPEG,
    });

    if (!result.base64) throw new Error('The selected photo could not be compressed');

    const fileSize = getBase64ByteLength(result.base64);
    const photo: AmenityPhotoInput = {
      uri: result.uri,
      base64: result.base64,
      fileSize,
      storagePath: null,
    };

    if (fileSize <= AMENITY_IMAGE_MAX_BYTES) return photo;
  }

  throw new Error('This photo is still larger than 4 MB after compression. Choose another photo.');
}
