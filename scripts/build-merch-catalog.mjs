import { readdir, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(projectRoot, '..', 'MERCH_SHOP');
const outputRoot = path.join(projectRoot, 'public', 'merch', 'assets', 'products');
const dataPath = path.join(projectRoot, 'public', 'merch', 'data', 'products.json');
const supportedImages = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const slugify = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const productDetails = {
  'CAMISETA BASS TRAFFICKERS - HEADBANG DEALERS': {
    name: 'Camiseta Bass Traffickers',
    brand: 'HEADBANG DEALERS',
    collection: 'Bass Traffickers',
    type: 'Camiseta oversize',
    description: 'Camiseta oversize gris acid-grunge con identidad Bass Traffickers en el frontal y Headbang Dealers en la espalda. Incorpora detalles artesanales en verde neón.',
    features: [
      'Corte oversize',
      'Logos en vinilo flúor UV',
      'Ojales hechos a mano en la manga izquierda',
      'Costuras a mano con hilo verde neón',
      'Cada pieza presenta acabados únicos',
    ],
    requiresSize: true,
    sortOrder: 4,
    stock: 0,
    availability: 'sold-out',
    pending: ['PVP e impuestos', 'Tallas y tabla de medidas', 'Composición y gramaje', 'Cuidados y lavado', 'SKU y condiciones de venta'],
  },
  'ENCENDEDOR DE PLASMA RECARGABLE TIPO C - HEADBANG DEALERS': {
    name: 'Encendedor de plasma Headbang Dealers',
    brand: 'HEADBANG DEALERS',
    collection: 'Bass Traffickers',
    type: 'Encendedor eléctrico recargable',
    description: 'Encendedor de plasma de estética cyberpunk, con luces, indicador de batería, personalización Headbang Dealers y recarga USB-C.',
    features: ['Funcionamiento eléctrico por arco', 'Indicador de batería', 'Recarga USB-C', 'Identidad Headbang Dealers', 'No apto para defensa personal'],
    requiresSize: false,
    sortOrder: 2,
    priceCents: 1000,
    purchasable: true,
    availability: 'available',
    pending: ['Fabricante y modelo', 'Especificaciones eléctricas', 'Elementos incluidos', 'SKU y condiciones de venta'],
  },
  'GORRA UNDER - HEADBANG DEALERS': {
    name: 'Gorra Under Headbang Dealers',
    brand: 'HEADBANG DEALERS',
    collection: 'Bass Traffickers',
    type: 'Gorra bordada',
    description: 'Gorra gris de estética distressed y underground, con el logotipo Headbang Dealers bordado en verde flúor y desplazado del centro.',
    features: ['Acabado gris desgastado', 'Visera curvada con detalles distressed', 'Logotipo bordado en verde flúor', 'Identidad Headbang Dealers'],
    requiresSize: false,
    sortOrder: 1,
    priceCents: 2000,
    purchasable: true,
    preorder: true,
    availability: 'preorder',
    pending: ['Composición', 'Talla y sistema de ajuste', 'Cuidados', 'SKU y condiciones de venta'],
  },
  'LLAVERO NFC 3D - FERAL': {
    name: 'Llavero FERAL Club NFC',
    brand: 'FERAL',
    collection: 'FERAL Club',
    type: 'Llavero con concepto NFC',
    description: 'Llavero FERAL en negro y rojo. El historial recoge un concepto NFC con enlace de destino actualizable; sus prestaciones y ventajas actuales requieren verificación.',
    features: ['Identidad FERAL', 'Diseño negro y rojo', 'Concepto NFC documentado; activación pendiente de confirmar'],
    requiresSize: false,
    sortOrder: 5,
    priceCents: 300,
    purchasable: true,
    availability: 'available',
    pending: ['Material y medidas', 'Chip NFC instalado y probado', 'Ventajas FERAL Club vigentes', 'SKU y condiciones de venta'],
  },
  'LLAVERO NFC 3D - HEADBANG DEALERS': {
    name: 'Llavero Headbang Dealers',
    brand: 'HEADBANG DEALERS',
    collection: 'Headbang Dealers',
    type: 'Llavero con logotipo',
    description: 'Llavero con el logotipo Headbang Dealers en verde sobre una base negra recortada siguiendo la silueta de las letras.',
    features: ['Identidad Headbang Dealers', 'Diseño negro y verde', 'Cadena corta y anilla circular'],
    requiresSize: false,
    sortOrder: 3,
    priceCents: 300,
    purchasable: true,
    availability: 'available',
    pending: ['Material y medidas', 'Confirmación expresa sobre NFC', 'SKU y condiciones de venta'],
  },
};

const clipperProducts = [
  {
    id: 'night-of-wolves-clipper-orange',
    imageSource: 'CLIPPER N.O.W. ERUPTION.png',
    name: 'Clipper Night of Wolves — Naranja',
    brand: 'NIGHT OF WOLVES',
    collection: 'N.O.W.',
    type: 'Encendedor personalizado',
    description: 'Clipper oficial Night of Wolves en versión naranja, con logotipo N.O.W. e identidad LICANCORP.',
    features: ['Versión naranja', 'Identidad Night of Wolves', 'Diseño vertical adaptado al cuerpo'],
    requiresSize: false,
    sortOrder: 6,
    priceCents: 300,
    purchasable: true,
    availability: 'available',
    pending: ['Modelo exacto y ficha técnica', 'SKU y condiciones de venta'],
  },
  {
    id: 'night-of-wolves-clipper-blue',
    imageSource: 'CLIPPER_NOW.png',
    name: 'Clipper Night of Wolves — Azul',
    brand: 'NIGHT OF WOLVES',
    collection: 'N.O.W.',
    type: 'Encendedor personalizado',
    description: 'Clipper oficial Night of Wolves en versión azul, con logotipo N.O.W. e identidad LICANCORP.',
    features: ['Versión azul', 'Identidad Night of Wolves', 'Diseño vertical adaptado al cuerpo'],
    requiresSize: false,
    sortOrder: 7,
    priceCents: 300,
    purchasable: true,
    availability: 'available',
    pending: ['Modelo exacto y ficha técnica', 'SKU y condiciones de venta'],
  },
];

const sourceEntries = await readdir(sourceRoot, { withFileTypes: true });
const folders = sourceEntries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const products = [];
let totalSourceBytes = 0;
let totalOutputBytes = 0;

for (const folder of folders) {
  const sourceFolder = path.join(sourceRoot, folder.name);
  const slug = slugify(folder.name);
  const targetFolder = path.join(outputRoot, slug);
  await mkdir(targetFolder, { recursive: true });

  const entries = await readdir(sourceFolder, { withFileTypes: true });
  const imageFiles = entries
    .filter((entry) => entry.isFile() && supportedImages.has(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));

  const images = [];
  for (const [index, imageFile] of imageFiles.entries()) {
    const sourcePath = path.join(sourceFolder, imageFile.name);
    const outputName = `${slug}-${String(index + 1).padStart(2, '0')}.webp`;
    const outputPath = path.join(targetFolder, outputName);
    const sourceStats = await stat(sourcePath);

    const pipeline = sharp(sourcePath, { failOn: 'none' }).rotate();
    const metadata = await pipeline.metadata();
    await pipeline
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 76, effort: 6, smartSubsample: true, alphaQuality: 82 })
      .toFile(outputPath);
    const outputStats = await stat(outputPath);
    const outputMetadata = await sharp(outputPath).metadata();

    totalSourceBytes += sourceStats.size;
    totalOutputBytes += outputStats.size;
    images.push({
      src: `./assets/products/${slug}/${outputName}`,
      alt: `${productDetails[folder.name]?.name ?? folder.name} — vista ${index + 1}`,
      width: outputMetadata.width,
      height: outputMetadata.height,
      bytes: outputStats.size,
      source: imageFile.name,
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      sourceBytes: sourceStats.size,
    });
  }

  const details = productDetails[folder.name] ?? {
    name: folder.name,
    brand: 'LICAN EVENTS',
    collection: 'LICAN MERCH',
    type: 'Producto',
    description: 'Información comercial pendiente de validación.',
    features: [],
    requiresSize: false,
    pending: ['Ficha comercial completa', 'PVP', 'Stock'],
  };

  const catalogEntries = folder.name === 'ENCENDEDOR CLIPPER - NIGHT OF WOLVES'
    ? clipperProducts.map((clipper) => ({
      slug: clipper.id,
      details: clipper,
      images: images
        .filter((image) => image.source === clipper.imageSource)
        .map((image, index) => ({ ...image, alt: `${clipper.name} — vista ${index + 1}` })),
    }))
    : [{ slug, details, images }];

  for (const catalogEntry of catalogEntries) {
    products.push({
      id: catalogEntry.slug,
      slug: catalogEntry.slug,
      active: true,
      featured: ['camiseta-bass-traffickers-headbang-dealers', 'gorra-under-headbang-dealers', 'llavero-nfc-3d-feral'].includes(catalogEntry.slug),
      purchasable: false,
      availability: 'coming-soon',
      priceCents: null,
      currency: 'EUR',
      stock: null,
      variants: [],
      ...catalogEntry.details,
      images: catalogEntry.images,
      sourceFolder: folder.name,
      sourceProductFile: entries.some((entry) => entry.name.toLowerCase() === 'product.txt') ? 'PRODUCT.txt' : null,
    });
  }
}

products.sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  currency: 'EUR',
  products,
};

await mkdir(path.dirname(dataPath), { recursive: true });
await writeFile(dataPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

const reduction = totalSourceBytes ? (1 - totalOutputBytes / totalSourceBytes) * 100 : 0;
console.log(`Generated ${products.length} products and ${products.reduce((sum, product) => sum + product.images.length, 0)} WebP images.`);
console.log(`Images: ${(totalSourceBytes / 1048576).toFixed(1)} MB -> ${(totalOutputBytes / 1048576).toFixed(1)} MB (${reduction.toFixed(1)}% reduction).`);
