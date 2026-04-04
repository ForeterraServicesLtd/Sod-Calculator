// Fetches products from WooCommerce Store API for supported vendors

const VENDORS = {
  kakwastone: {
    name: 'Kakwa Stone',
    url: 'https://www.kakwastone.com/wp-json/wc/store/v1/products?per_page=100',
    transform: (item) => ({
      id: item.id,
      name: item.name,
      price: item.prices?.price ? (parseInt(item.prices.price) / 100).toFixed(2) : null,
      regular_price: item.prices?.regular_price ? (parseInt(item.prices.regular_price) / 100).toFixed(2) : null,
      sale_price: item.prices?.sale_price && item.prices.sale_price !== '0' ? (parseInt(item.prices.sale_price) / 100).toFixed(2) : null,
      currency: item.prices?.currency_code || 'CAD',
      category: item.categories?.[0]?.name || 'Uncategorized',
      in_stock: item.is_in_stock,
      permalink: item.permalink,
      image: item.images?.[0]?.thumbnail || null,
      description: item.short_description?.replace(/<[^>]*>/g, '').trim() || '',
    })
  }
};

module.exports = async (req, res) => {
  const vendor = req.query.vendor || 'kakwastone';
  const config = VENDORS[vendor];

  if (!config) {
    return res.status(400).json({ error: 'Unknown vendor. Available: ' + Object.keys(VENDORS).join(', ') });
  }

  try {
    // Fetch all pages
    let allProducts = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) {
      const url = config.url + (config.url.includes('?') ? '&' : '?') + 'page=' + page;
      const response = await fetch(url);

      if (!response.ok) {
        return res.status(502).json({ error: 'Vendor API returned ' + response.status });
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(data.map(config.transform));
        page++;
        if (data.length < 100) hasMore = false;
      }
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json({
      vendor: config.name,
      updated: new Date().toISOString(),
      count: allProducts.length,
      products: allProducts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
