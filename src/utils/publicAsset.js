export function getPublicAssetUrl(path) {
  const publicPath = path.replace(/^\/+/, '');
  return encodeURI(`${import.meta.env.BASE_URL}${publicPath}`);
}
