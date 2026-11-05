const MAX_FILE_BYTES = 15 * 1024 * 1024;
export async function readBannerFile(
  file: File,
): Promise<{ url: string; width: number; height: number }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error("Choose an image smaller than 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (image.naturalWidth * image.naturalHeight > 40_000_000)
      throw new Error("Choose an image smaller than 40 megapixels.");
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "This image could not be opened. Try another JPG, PNG, or WebP.",
        ),
      );
    image.src = url;
  });
}
export async function cropBanner(url: string, focus: number): Promise<Blob> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 600;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the image.");
  const ratio = 8 / 3;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const width =
    sourceRatio > ratio ? image.naturalHeight * ratio : image.naturalWidth;
  const height = width / ratio;
  const x = (image.naturalWidth - width) / 2;
  const y =
    (image.naturalHeight - height) * Math.max(0, Math.min(focus / 100, 1));
  context.fillStyle = "#f8f5ef";
  context.fillRect(0, 0, 1600, 600);
  context.drawImage(image, x, y, width, height, 0, 0, 1600, 600);
  for (const quality of [0.86, 0.76, 0.65, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= 750_000) return blob;
  }
  throw new Error(
    "This image is too detailed to upload. Try a simpler or smaller picture.",
  );
}
