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

async function createShopifyProduct(product, imagePrefix) {
  const variants = (product.available_size || []).map(size => ({
    option1: size.size,
    sku: size.stock_id,
    inventory_quantity: parseInt(size.qty) || 0,
    inventory_management: 'shopify',
    price: product.price || product.default_price || '0.00'
  }));

  if (variants.length === 0) {
    variants.push({
      price: product.price || product.default_price || '0.00',
      inventory_management: 'shopify',
      inventory_quantity: 0
    });
  }

  const images = [];
  if (product.pic1) images.push({ src: `${imagePrefix}${product.pic1}` });
  if (product.pic2) images.push({ src: `${imagePrefix}${product.pic2}` });

  const body = {
    product: {
      title: product.name,
      body_html: product.description || '',
      vendor: product.brand || '',
      product_type: product.category || '',
      tags: [product.department, product.season, product.color].filter(Boolean).join(', '),
      options: [{ name: 'Size' }],
      variants,
      images
    }
  };

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/products.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const result = await res.json();
  if (result.product) {
    console.log('Creado:', product.name);
  } else {
    console.log('Error en', product.name, JSON.stringify(result));
  }
}

async function main() {
  console.log('Token disponible:', SHOPIFY_TOKEN ? 'SI' : 'NO');
  console.log('Iniciando importacion...');
  const imagePrefix = await getImagePrefix();
  console.log('Image prefix:', imagePrefix);
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
