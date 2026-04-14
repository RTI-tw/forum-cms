function getFileURL(bucket: string, path: string, filename: string): string {
  return `https://${bucket}${path}/${filename}`
}

/** Image 等公開網址：有 GCS_BASE_URL 時為 `${publicBaseUrl}${imagesPath}/${filename}`，否則沿用 getFileURL */
function getImagePublicUrl(
  publicBaseUrl: string,
  bucket: string,
  imagesPath: string,
  filename: string
): string {
  if (publicBaseUrl) {
    const path = imagesPath.startsWith('/') ? imagesPath : `/${imagesPath}`
    return `${publicBaseUrl}${path}/${filename}`
  }
  return getFileURL(bucket, imagesPath, filename)
}

export { getFileURL, getImagePublicUrl }
