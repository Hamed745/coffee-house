const Order = require('../models/Order');
const Product = require('../models/Product');

exports.createOrder = async (req, res) => {
  try {
    const { items, customer, orderType, deliveryAddress, specialInstructions } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order must contain at least one item'
      });
    }
    
    let totalAmount = 0;
    const validatedItems = [];
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product not found: ${item.productId}`
        });
      }
      
      if (!product.available) {
        return res.status(400).json({
          success: false,
          error: `Product not available: ${product.name.en || product.name}`
        });
      }

      // Check dessert stock
      if (product.category === 'dessert' && product.stock !== -1) {
        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            error: `Not enough stock for: ${product.name.en || product.name}. Available: ${product.stock}`
          });
        }
      }
      
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;
      
      validatedItems.push({
        product: product._id,
        quantity: item.quantity,
        priceAtTime: product.price,
        specialInstructions: item.specialInstructions || ''
      });
    }
    
    if (orderType === 'delivery') {
      totalAmount += 100;
    }
    
    const orderData = {
      items: validatedItems,
      totalAmount,
      customer: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email || ''
      },
      orderType: orderType || 'pickup',
      deliveryAddress: deliveryAddress || {},
      specialInstructions: specialInstructions || ''
    };
    
    const order = new Order(orderData);
    await order.save();

    // Decrement stock for dessert items
    for (const item of validatedItems) {
      const product = await Product.findById(item.product);
      if (product && product.category === 'dessert' && product.stock !== -1) {
        product.stock = Math.max(0, product.stock - item.quantity);
        if (product.stock === 0) product.available = false;
        await product.save();
      }
    }
    
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'name.en name.ru price image');
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: populatedOrder._id,
        orderNumber: populatedOrder.orderNumber,
        status: populatedOrder.status,
        totalAmount: populatedOrder.totalAmount,
        items: populatedOrder.items.map(item => ({
          product: {
            id: item.product._id,
            name: item.product.name,
            price: item.product.price
          },
          quantity: item.quantity,
          subtotal: item.priceAtTime * item.quantity
        })),
        customer: populatedOrder.customer,
        createdAt: populatedOrder.createdAt
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error creating order',
      message: error.message
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name.en name.ru price image category');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching order',
      message: error.message
    });
  }
};

exports.getOrderByNumber = async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('items.product', 'name.en name.ru price image');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching order',
      message: error.message
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('items.product', 'name.en name.ru');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error updating order status',
      message: error.message
    });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items.product', 'name.en name.ru');
    
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching orders',
      message: error.message
    });
  }
};