const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validateProduct(product) {
  const errors = [];
  if (!product.internalKey) errors.push('internalKey is required');
  if (!product.name) errors.push('name is required');
  if (!Number(product.robuxPrice) || Number(product.robuxPrice) < 1) errors.push('robuxPrice must be at least 1');
  return errors;
}

function normalizeProduct(product) {
  return {
    internalKey: String(product.internalKey || '').trim(),
    name: String(product.name || '').trim(),
    description: String(product.description || '').trim(),
    robuxPrice: Number(product.robuxPrice),
    rewardType: String(product.rewardType || '').trim(),
    rewardItem: String(product.rewardItem || '').trim(),
    rewardAmount: Number(product.rewardAmount) || 0
  };
}

async function createOne({ universeId, product }) {
  if (!process.env.ROBLOX_API_KEY) {
    const error = new Error('ROBLOX_API_KEY is not configured on the backend.');
    error.status = 500;
    throw error;
  }

  const endpoint = `https://apis.roblox.com/developer-products/v1/universes/${encodeURIComponent(universeId)}/developer-products`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ROBLOX_API_KEY
    },
    body: JSON.stringify({
      name: product.name,
      description: product.description,
      priceInRobux: product.robuxPrice
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error || `Roblox API returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return body;
}

export async function createDeveloperProducts({ universeId, products, dryRun, delayMs }) {
  const results = [];

  for (const rawProduct of products) {
    const product = normalizeProduct(rawProduct);
    const errors = validateProduct(product);
    if (errors.length) {
      results.push({ ...rawProduct, status: 'failed', error: errors.join('. ') });
      continue;
    }

    if (dryRun) {
      results.push({ ...rawProduct, ...product, productId: rawProduct.productId || 'dry-run', status: 'validated', error: '' });
    } else {
      try {
        const created = await createOne({ universeId, product });
        results.push({
          ...rawProduct,
          ...product,
          productId: created.id || created.productId || created.developerProductId || rawProduct.productId || '',
          status: 'created',
          error: ''
        });
      } catch (error) {
        results.push({ ...rawProduct, ...product, status: 'failed', error: error.message });
      }
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  return results;
}
