const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const http = require('http');
const url = require('url');

const SUPPLIER_BASE_URL = 'https://srv2.best-fashion.net';
const SUPPLIER_TOKEN = '38712c15e4976ba5f4647e891f559271';
const SHOPIFY_STORE = 'houseofsartorial.myshopify.com';
const CLIENT_ID = '524ea8f7e4a654d449a5ab8aa6615528';
const CLIENT_SECRET = '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';
const PORT = process.env.PORT || 3000;

let shopifyToken = null;

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
      'X-Shopify-Access-Token': shopifyToken,
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

async function importProducts() {
  console.log('Iniciando importacion...');
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

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/callback') {
    const code = parsed.query.code;
    if (code) {
      const tokenRes = await fetch(`https://${SHOPIFY_STORE}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code })
      });
      const tokenData = await tokenRes.json();
      shopifyToken = tokenData.access_token;
      console.log('Token obtenido:', shopifyToken);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Token obtenido! La importacion iniciara automaticamente.</h1>');
      importProducts();
    }
  } else {
    const authUrl = `https://${SHOPIFY_STORE}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=write_products,read_products,write_inventory,read_inventory,read_locations&redirect_uri=https://worker-production-1d00.up.railway.app/callback&state=abc123`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1>Importador Catalogo</h1><a href="${authUrl}" style="background:#008060;color:white;padding:15px 30px;text-decoration:none;border-radius:5px;">Autorizar e Importar</a>`);
  }
});

server.listen(PORT, () => console.log('Servidor corriendo en puerto', PORT));
