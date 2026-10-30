const Product = require('../models/Product');

function normalizeDessertPayload(payload = {}) {
  const normalized = { ...payload };
  const category = normalized.category;

  if (category === 'dessert' && normalized.stock === undefined) {
    normalized.stock = 0;
  }

  if (normalized.stock !== undefined) {
    const stockNumber = Number(normalized.stock);
    if (!Number.isNaN(stockNumber)) {
      const enforceFiniteDessertStock = category === 'dessert' || category === undefined;
      normalized.stock = enforceFiniteDessertStock
        ? Math.max(0, stockNumber)
        : Math.max(-1, stockNumber);
      if (enforceFiniteDessertStock) {
        if (normalized.stock === 0) normalized.available = false;
        if (normalized.stock > 0) normalized.available = true;
      }
    }
  }

  return normalized;
}

exports.getAllProducts = async (req, res) => {
  try {
    const { category, featured, available, lang = 'en' } = req.query;
    
    let query = {};
    if (category) query.category = category;
    if (featured !== undefined) query.featured = featured === 'true';
    if (available !== undefined) query.available = available === 'true';
    
    const products = await Product.find(query).sort({ createdAt: -1 });
    
    const formattedProducts = products.map(product => ({
      id: product._id,
      name: product.getLocalizedName(lang),
      description: product.getLocalizedDescription(lang),
      category: product.category,
      price: product.price,
      image: product.image,
      featured: product.featured,
      available: product.available,
      tags: product.tags,
      calories: product.calories,
      preparationTime: product.preparationTime,
      stock: product.stock
    }));
    
    res.json({
      success: true,
      count: formattedProducts.length,
      data: formattedProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching products',
      message: error.message
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const formattedProduct = {
      id: product._id,
      name: product.getLocalizedName(lang),
      description: product.getLocalizedDescription(lang),
      category: product.category,
      price: product.price,
      image: product.image,
      featured: product.featured,
      available: product.available,
      tags: product.tags,
      calories: product.calories,
      preparationTime: product.preparationTime,
      stock: product.stock,
      createdAt: product.createdAt
    };
    
    res.json({
      success: true,
      data: formattedProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching product',
      message: error.message
    });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { lang = 'en' } = req.query;
    
    const products = await Product.findByCategory(category);
    
    const formattedProducts = products.map(product => ({
      id: product._id,
      name: product.getLocalizedName(lang),
      description: product.getLocalizedDescription(lang),
      price: product.price,
      image: product.image,
      tags: product.tags
    }));
    
    res.json({
      success: true,
      category,
      count: formattedProducts.length,
      data: formattedProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching products by category',
      message: error.message
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = new Product(normalizeDessertPayload(req.body));
    await product.save();
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error creating product',
      message: error.message
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      normalizeDessertPayload(req.body),
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error updating product',
      message: error.message
    });
  }
};

exports.updateAllDessertStock = async (req, res) => {
  try {
    const { stock } = req.body;
    const stockNumber = Number(stock);

    if (Number.isNaN(stockNumber) || stockNumber < 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock must be a non-negative number'
      });
    }

    const result = await Product.updateMany(
      { category: 'dessert' },
      {
        $set: {
          stock: stockNumber,
          available: stockNumber > 0
        }
      }
    );

    res.json({
      success: true,
      message: `Updated dessert stock to ${stockNumber}`,
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error updating dessert stock',
      message: error.message
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error deleting product',
      message: error.message
    });
  }
};