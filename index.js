const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const SUPPLIER_BASE_URL = 'https://srv2.best-fashion.net';
const SUPPLIER_TOKEN = '38712c15e4976ba5f4647e891f559271';
const SHOPIFY_STORE = 'houseofsartorial.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;

async function getImagePrefix() {
  const res = await fetch(`${SUPPLIER_BASE_URL}/ApiV3/token/${SUPPLIER_TOKEN}`);
  const data = await res.json();
  return data.image_url || '';
}

async function getProducts() {
  const res = await fetch(`${SUPPLIER_BASE_URL}/ApiV3/token/${SUPPLIER_TOKEN}/callType/allStockGroup`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data.products) return data.products;
  if (data.data) return data.data;
  const values = Object.values(data);
  if (values.length > 0 && typeof values[0] === 'object') return values;
  return [];
}

async function testShopifyConnection() {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/shop.json`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await res.json();
  console.log('Shop test:', JSON.stringify(data).substring(0, 200));
  return data.shop ? true : false;
}

async function createShopifyProduct(product, imagePrefix) {
  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product { id title }
        userErrors { field message }
      }
    }
  `;

  const variants = (product.available_size || []).map(size => ({
    optionValues: [{ name: size.size, optionName: 'Size' }],
    sku: size.stock_id,
    inventoryQuantities: [{ availableQuantity: parseInt(size.qty) || 0, locationId: 'gid://shopify/Location/1' }],
    price: product.price || product.default_price || '0.00'
  }));

  const input = {
    title: product.name,
    descriptionHtml: product.description || '',
    vendor: product.brand || '',
    productType: product.category || '',
    tags: [product.department, product.season, product.color].filter(Boolean),
  };

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: mutation, variables: { input } })
  });

  const result = await res.json();
  if (result.data && result.data.productCreate && result.data.productCreate.product) {
    console.log('Creado:', product.name);
  } else {
    console.log('Error en', product.name, JSON.stringify(result));
  }
}

async function main() {
  console.log('Probando conexion con Shopify...');
  const connected = await testShopifyConnection();
  if (!connected) {
    console.log('ERROR: No se pudo conectar con Shopify. Verifica el token.');
    return;
  }
  console.log('Conexion exitosa!');
  const imagePrefix = await getImagePrefix();
  const products = await getProducts();
  console.log('Productos encontrados:', products.length);

  for (let i = 0; i < products.length; i++) {
    await createShopifyProduct(products[i], imagePrefix);
    await new Promise(r => setTimeout(r, 500));
    if ((i + 1) % 10 === 0) console.log('Progreso:', (i + 1) + '/' + products.length);
  }
  console.log('Importacion completada!');
}

main().catch(console.error);
