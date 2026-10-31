
const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled'
];

const PAYMENT_METHODS = ['cash', 'card'];
const DELIVERY_FEE = 100;

const hashTrackingToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// ============================================
// Create Order
// ============================================

exports.createOrder = async (req, res) => {
  const reservedStock = [];
  let orderSaved = false;

  const rollbackReservedStock = async () => {
    await reservedStock
      .slice()
      .reverse()
      .reduce(
        (previousRollback, reservation) =>
          previousRollback.then(() =>
            Product.updateOne(
              { _id: reservation.productId },
              {
                $inc: { stock: reservation.quantity },
                $set: { available: true }
              }
            )
          ),
        Promise.resolve()
      );
  };

  try {
    const {
      items,
      customer,
      orderType = 'pickup',
      deliveryAddress,
      specialInstructions = '',
      paymentMethod = 'cash'
    } = req.body || {};

    const name =
      typeof customer?.name === 'string' ? customer.name.trim() : '';

    const phone =
      typeof customer?.phone === 'string' ? customer.phone.trim() : '';

    const phoneDigits = phone.replace(/\D/g, '');

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        success: false,
        error: 'Name must be between 2 and 80 characters'
      });
    }

    if (!/^[+0-9()\-.\s]{7,20}$/.test(phone) || phoneDigits.length < 7) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid phone number'
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
      return res.status(400).json({
        success: false,
        error: 'Order must contain between 1 and 30 items'
      });
    }

    if (!['pickup', 'delivery'].includes(orderType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order type'
      });
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method'
      });
    }

    if (
      typeof specialInstructions !== 'string' ||
      specialInstructions.length > 500
    ) {
      return res.status(400).json({
        success: false,
        error: 'Special instructions must be 500 characters or fewer'
      });
    }

    const street =
      typeof deliveryAddress?.street === 'string'
        ? deliveryAddress.street.trim()
        : '';

    if (
      orderType === 'delivery' &&
      (street.length < 5 || street.length > 250)
    ) {
      return res.status(400).json({
        success: false,
        error: 'A valid delivery address is required'
      });
    }

    // ============================================
    // Validate Order Items
    // ============================================

    const invalidItem = items.find(
      (item) =>
        !item ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 50
    );

    if (invalidItem) {
      return res.status(400).json({
        success: false,
        error: 'Each item must have a valid product and quantity from 1 to 50'
      });
    }

    const quantitiesByProduct = new Map();

    items.forEach((item) => {
      const productId = String(item.productId);

      quantitiesByProduct.set(
        productId,
        (quantitiesByProduct.get(productId) || 0) + item.quantity
      );
    });

    const productIds = [...quantitiesByProduct.keys()];

    const foundProducts = await Product.find({
      _id: { $in: productIds }
    });

    const productsById = new Map(
      foundProducts.map((product) => [String(product._id), product])
    );

    if (foundProducts.length !== productIds.length) {
      return res.status(404).json({
        success: false,
        error: 'One or more products could not be found'
      });
    }

    // ============================================
    // Check Product Availability
    // ============================================

    const unavailableItem = items.find((item) => {
      const product = productsById.get(String(item.productId));

      return !product || !product.available;
    });

    if (unavailableItem) {
      return res.status(400).json({
        success: false,
        error: 'One or more products are not available'
      });
    }

    const itemWithLongInstructions = items.find(
      (item) =>
        typeof item.specialInstructions === 'string' &&
        item.specialInstructions.length > 250
    );

    if (itemWithLongInstructions) {
      return res.status(400).json({
        success: false,
        error: 'Item instructions are too long'
      });
    }

    const validatedItems = items.map((item) => {
      const product = productsById.get(String(item.productId));

      const itemInstructions =
        typeof item.specialInstructions === 'string'
          ? item.specialInstructions
          : '';

      return {
        product: product._id,
        quantity: item.quantity,
        priceAtTime: product.price,
        specialInstructions: itemInstructions
      };
    });

    let totalAmount = items.reduce((total, item) => {
      const product = productsById.get(String(item.productId));

      return total + product.price * item.quantity;
    }, 0);

    if (orderType === 'delivery') {
      totalAmount += DELIVERY_FEE;
    }

    // ============================================
    // Reserve Dessert Stock Sequentially
    // ============================================

    let reservationError = null;

    await Array.from(quantitiesByProduct.entries()).reduce(
      async (previousReservation, [productId, quantity]) => {
        await previousReservation;

        if (reservationError) {
          return;
        }

        const product = productsById.get(productId);

        if (product.category !== 'dessert' || product.stock === -1) {
          return;
        }

        const reservation = await Product.updateOne(
          {
            _id: product._id,
            category: 'dessert',
            stock: { $gte: quantity, $ne: -1 }
          },
          {
            $inc: { stock: -quantity }
          }
        );

        if (reservation.modifiedCount !== 1) {
          reservationError =
            `Not enough stock for ${product.name?.en || 'a selected dessert'}`;

          return;
        }

        reservedStock.push({
          productId: product._id,
          quantity
        });

        await Product.updateOne(
          {
            _id: product._id,
            stock: 0
          },
          {
            $set: { available: false }
          }
        );
      },
      Promise.resolve()
    );

    if (reservationError) {
      await rollbackReservedStock();

      return res.status(409).json({
        success: false,
        error: reservationError
      });
    }

    // ============================================
    // Create and Save Order
    // ============================================

    const trackingToken = crypto.randomBytes(32).toString('base64url');

    const order = new Order({
      items: validatedItems,
      totalAmount,
      customer: {
        name,
        phone
      },
      orderType,
      deliveryAddress: orderType === 'delivery' ? { street } : {},
      specialInstructions: specialInstructions.trim(),
      paymentMethod,
      trackingTokenHash: hashTrackingToken(trackingToken)
    });

    await order.save();
    orderSaved = true;

    res.set('Cache-Control', 'no-store');

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        trackingToken,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    if (!orderSaved && reservedStock.length) {
      try {
        await rollbackReservedStock();
      } catch (rollbackError) {
        console.error('Stock rollback failed:', rollbackError.message);
      }
    }

    console.error('Create order failed:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Unable to create order at this time'
    });
  }
};

// ============================================
// Public Guest Order Tracking
// ============================================

// The high-entropy token is the only customer credential.

exports.trackOrder = async (req, res) => {
  try {
    const token =
      typeof req.body?.trackingToken === 'string'
        ? req.body.trackingToken.trim()
        : '';

    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      return res.status(404).json({
        success: false,
        error: 'Order not found. Check your tracking code.'
      });
    }

    const order = await Order.findOne({
      trackingTokenHash: hashTrackingToken(token)
    })
      .select('orderNumber status orderType totalAmount items createdAt updatedAt')
      .populate('items.product', 'name.en name.ru');

    res.set('Cache-Control', 'no-store');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found. Check your tracking code.'
      });
    }

    return res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map((item) => ({
          name:
            item.product?.name?.[req.body.lang === 'ru' ? 'ru' : 'en'] ||
            item.product?.name?.en ||
            item.product?.name?.ru ||
            'Product',
          quantity: item.quantity,
          subtotal: item.priceAtTime * item.quantity
        }))
      }
    });
  } catch (error) {
    console.error('Track order failed:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Unable to retrieve order status at this time'
    });
  }
};

// ============================================
// Update Order Status
// ============================================

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order status'
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      },
      {
        new: true,
        runValidators: true
      }
    ).populate('items.product', 'name.en name.ru');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error updating order status'
    });
  }
};

// ============================================
// Get All Orders
// ============================================

exports.getAllOrders = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    const page = Number.parseInt(req.query.page || '1', 10);
    const limit = Number.parseInt(req.query.limit || '20', 10);

    if (
      (status && !ORDER_STATUSES.includes(status)) ||
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order filters or pagination values'
      });
    }

    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) {
        const date = new Date(startDate);

        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid start date'
          });
        }

        query.createdAt.$gte = date;
      }

      if (endDate) {
        const date = new Date(endDate);

        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid end date'
          });
        }

        query.createdAt.$lte = date;
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('items.product', 'name.en name.ru'),

      Order.countDocuments(query)
    ]);

    return res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      data: orders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error fetching orders'
    });
  }
};
