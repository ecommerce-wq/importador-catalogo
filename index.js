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

async function testToken() {
  console.log('Token:', SHOPIFY_TOKEN ? SHOPIFY_TOKEN.substring(0, 10) + '...' : 'NO TOKEN');
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/shop.json`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const text = await res.text();
  console.log('Shop response:', text.substring(0, 300));
}

async function createProduct(product, imagePrefix) {
  const variants = (product.available_size || []).map(size => ({
    option1: size.size,
    sku: size.stock_id,
    inventory_quantity: parseInt(size.qty) || 0,
    inventory_management: 'shopify',
    price: product.price || product.default_price || '0.00'
  }));

  if (variants.length === 0) {
    variants.push({ price: product.price || '0.00' });
  }

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/products.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product: {
        title: product.name,
        body_html: product.description || '',
        vendor: product.brand || '',
        product_type: product.category || '',
        options: [{ name: 'Size' }],
        variants
      }
    })
  });

  const result = await res.json();
  if (result.product) {
    console.log('OK:', product.name);
  } else {
    console.log('ERR:', product.name, JSON.stringify(result).substring(0, 100));
  }
}

async function main() {
  console.log('=== INICIANDO ===');
  await testToken();
  const imagePrefix = await getImagePrefix();
  const products = await getProducts();
  console.log('Total productos:', products.length);
  for (let i = 0; i < Math.min(products.length, 5); i++) {
    await createProduct(products[i], imagePrefix);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('=== PRUEBA COMPLETADA ===');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
