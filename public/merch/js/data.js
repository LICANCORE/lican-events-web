const CATALOG_URL = './data/products.json';
let catalogPromise;

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL, { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar el catálogo (${response.status})`);
        return response.json();
      });
  }
  return catalogPromise;
}

export function findProduct(catalog, productId) {
  return catalog.products.find((product) => product.id === productId || product.slug === productId);
}
