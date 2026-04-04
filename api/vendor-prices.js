// Fetches products from vendor APIs (WooCommerce + Shopify)

const VENDORS = {
  kakwastone: {
    name: 'Kakwa Stone',
    type: 'woocommerce',
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
      description: item.short_description?.replace(/<[^>]*>/g, '').trim() || '',
    })
  },
  raintech: {
    name: 'Raintech Irrigation',
    type: 'woocommerce',
    url: 'https://raintech.ca/wp-json/wc/store/v1/products?per_page=100',
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
      description: item.short_description?.replace(/<[^>]*>/g, '').trim() || '',
    })
  },
  klonservices: {
    name: 'KLon Services — Tree Farm & Nursery',
    type: 'woocommerce',
    url: 'https://klonservices.ca/wp-json/wc/store/v1/products?per_page=100',
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
      description: item.short_description?.replace(/<[^>]*>/g, '').trim() || '',
    })
  },
  bulkdirect: {
    name: 'Bulk Direct Landscape Supply',
    type: 'shopify',
    url: 'https://www.bulkdirect.ca/products.json?limit=250',
    transform: (item) => {
      const variant = item.variants?.[0];
      const variants = (item.variants || []).filter(v => v.available);
      const priceRange = variants.length > 1
        ? variants.map(v => parseFloat(v.price)).filter(p => p > 0)
        : [];
      return {
        id: item.id,
        name: item.title,
        price: variant?.price || null,
        regular_price: variant?.compare_at_price || variant?.price || null,
        sale_price: variant?.compare_at_price && parseFloat(variant.price) < parseFloat(variant.compare_at_price) ? variant.price : null,
        currency: 'CAD',
        category: item.product_type || 'Uncategorized',
        in_stock: variant?.available !== false,
        permalink: 'https://www.bulkdirect.ca/products/' + item.handle,
        description: item.body_html?.replace(/<[^>]*>/g, '').trim().substring(0, 200) || '',
        variants: variants.map(v => ({ name: v.title, price: v.price, available: v.available })),
      };
    }
  }
};

module.exports = async (req, res) => {
  const vendor = req.query.vendor;

  // If no vendor specified, return list of available vendors
  if (!vendor) {
    return res.status(200).json({
      vendors: Object.entries(VENDORS).map(([key, v]) => ({ id: key, name: v.name, type: v.type }))
    });
  }

  const config = VENDORS[vendor];
  if (!config) {
    return res.status(400).json({ error: 'Unknown vendor. Available: ' + Object.keys(VENDORS).join(', ') });
  }

  // Supabase for caching
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  try {
    let allProducts = [];
    let fetchSuccess = false;

    // Try live fetch
    try {
      if (config.type === 'shopify') {
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 5) {
          const url = config.url + (config.url.includes('?') ? '&' : '?') + 'page=' + page;
          const response = await fetch(url);
          if (!response.ok) throw new Error('Vendor API returned ' + response.status);
          const data = await response.json();
          const products = data.products || [];
          if (products.length === 0) { hasMore = false; } else {
            allProducts = allProducts.concat(products.map(config.transform));
            page++;
            if (products.length < 250) hasMore = false;
          }
        }
      } else {
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 5) {
          const url = config.url + (config.url.includes('?') ? '&' : '?') + 'page=' + page;
          const response = await fetch(url);
          if (!response.ok) throw new Error('Vendor API returned ' + response.status);
          const data = await response.json();
          if (!Array.isArray(data) || data.length === 0) { hasMore = false; } else {
            allProducts = allProducts.concat(data.map(config.transform));
            page++;
            if (data.length < 100) hasMore = false;
          }
        }
      }
      fetchSuccess = true;

      // Save to cache
      const { data: existing } = await sb.from('vendor_cache').select('id').eq('vendor', vendor).single();
      if (existing) {
        await sb.from('vendor_cache').update({ products: allProducts, count: allProducts.length, fetched_at: new Date().toISOString() }).eq('vendor', vendor);
      } else {
        await sb.from('vendor_cache').insert({ vendor, products: allProducts, count: allProducts.length });
      }
    } catch (fetchErr) {
      // Live fetch failed — try cache
      const { data: cached } = await sb.from('vendor_cache').select('*').eq('vendor', vendor).single();
      if (cached) {
        res.setHeader('Cache-Control', 's-maxage=60');
        return res.status(200).json({
          vendor: config.name,
          updated: cached.fetched_at,
          count: cached.count,
          products: cached.products,
          cached: true,
          cache_note: 'Live fetch failed. Showing cached prices from ' + new Date(cached.fetched_at).toLocaleString('en-CA')
        });
      }
      return res.status(502).json({ error: 'Vendor API unavailable and no cached data: ' + fetchErr.message });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json({
      vendor: config.name,
      updated: new Date().toISOString(),
      count: allProducts.length,
      products: allProducts,
      cached: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
