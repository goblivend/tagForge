/**
 * Generate a hash of image data for deduplication
 * Uses SHA-256 for consistent and reliable comparison of binary image data
 * @param imageData - ArrayBuffer containing the image binary data
 * @returns Hexadecimal hash string
 */
export async function hashImageData(imageData: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", imageData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Convert multiple image hashes to a Map for deduplication
 * @param imageDataArray - Array of ArrayBuffers to hash
 * @returns Promise resolving to Map of hash -> index
 */
export async function hashImageBatch(
  imageDataArray: ArrayBuffer[]
): Promise<Map<string, number[]>> {
  const hashMap = new Map<string, number[]>();

  for (let i = 0; i < imageDataArray.length; i++) {
    const hash = await hashImageData(imageDataArray[i]);
    if (!hashMap.has(hash)) {
      hashMap.set(hash, []);
    }
    hashMap.get(hash)!.push(i);
  }

  return hashMap;
}
