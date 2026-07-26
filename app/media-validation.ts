const MAX_MEDIA_BYTES = 8_000_000;

const supportedTypes = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Uint8Array) => [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index) => bytes[index] === value) },
  "image/webp": { extension: "webp", signature: (bytes: Uint8Array) => text(bytes,0,4) === "RIFF" && text(bytes,8,12) === "WEBP" },
} as const;

function text(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start,end));
}

export type ValidatedMedia = { bytes: ArrayBuffer; contentType: keyof typeof supportedTypes; extension: string };

export async function validateUploadedMedia(file: File): Promise<ValidatedMedia> {
  if (!file.size) throw new Error("Boş dosya yüklenemez.");
  if (file.size > MAX_MEDIA_BYTES) throw new Error("Görsel en fazla 8 MB olabilir.");
  if (!(file.type in supportedTypes)) throw new Error("Yalnızca gerçek PNG, JPG veya WebP dosyaları yüklenebilir.");

  const bytes = await file.arrayBuffer();
  const contentType = file.type as keyof typeof supportedTypes;
  const format = supportedTypes[contentType];
  if (!format.signature(new Uint8Array(bytes))) {
    throw new Error("Dosya içeriği seçilen görsel formatıyla eşleşmiyor.");
  }
  return { bytes, contentType, extension: format.extension };
}
