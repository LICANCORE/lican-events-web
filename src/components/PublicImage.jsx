import { getPublicAssetUrl } from '../utils/publicAsset';

export default function PublicImage({ src, onError, ...props }) {
  const resolvedSrc = getPublicAssetUrl(src);

  const handleError = (event) => {
    console.warn('Imagen no encontrada:', resolvedSrc);
    onError?.(event);
  };

  return <img src={resolvedSrc} onError={handleError} {...props} />;
}
