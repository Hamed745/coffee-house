const crypto = require('crypto');

const mockOrders = [];

jest.mock('../models/Order', () => {
  class MockOrder {
    constructor(data) {
      Object.assign(this, data);
      this._id = 'mock-order-id';
      this.status = 'pending';
      this.createdAt = new Date('2026-10-30T10:00:00.000Z');
      this.updatedAt = this.createdAt;
    }

    async save() {
      this.orderNumber = 'ORD-123456-789';
      mockOrders.push(this);
    }

    static findOne(query) {
      const found = mockOrders.find(order => order.trackingTokenHash === query.trackingTokenHash) || null;
      return {
        select() { return this; },
        async populate() { return found; }
      };
    }
  }
  return MockOrder;
});

jest.mock('../models/Product', () => ({
  find: jest.fn(),
  updateOne: jest.fn()
}));

const Product = require('../models/Product');
const orderController = require('../controllers/order.controller');

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; }
  };
}

beforeEach(() => {
  mockOrders.length = 0;
  Product.find.mockReset();
  Product.updateOne.mockReset();
  Product.updateOne.mockResolvedValue({ modifiedCount: 1 });
  Product.find.mockResolvedValue([{
    _id: '507f1f77bcf86cd799439011',
    name: { en: 'Latte', ru: 'Латте' },
    category: 'coffee',
    price: 120,
    available: true,
    stock: -1
  }]);
});

test('creates an order and stores only a hash of its tracking token', async () => {
  const req = {
    body: {
      items: [{ productId: '507f1f77bcf86cd799439011', quantity: 2 }],
      customer: { name: 'Test Customer', phone: '+1234567890' },
      orderType: 'pickup',
      paymentMethod: 'cash'
    }
  };
  const res = createResponse();

  await orderController.createOrder(req, res);

  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.data.trackingToken).toMatch(/^[A-Za-z0-9_-]{40,50}$/);
  expect(mockOrders).toHaveLength(1);
  expect(mockOrders[0].trackingTokenHash).toBe(
    crypto.createHash('sha256').update(res.body.data.trackingToken).digest('hex')
  );
  expect(mockOrders[0].trackingTokenHash).not.toBe(res.body.data.trackingToken);
  expect(mockOrders[0].customer).not.toHaveProperty('email');
});

test('returns limited order details for a valid tracking token', async () => {
  const token = crypto.randomBytes(32).toString('base64url');
  mockOrders.push({
    trackingTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    orderNumber: 'ORD-123456-789',
    status: 'preparing',
    orderType: 'pickup',
    totalAmount: 240,
    createdAt: new Date('2026-10-30T10:00:00.000Z'),
    updatedAt: new Date('2026-10-30T10:05:00.000Z'),
    customer: { name: 'Private Name', phone: '+1234567890' },
    items: [{ product: { name: { en: 'Latte', ru: 'Латте' } }, quantity: 2, priceAtTime: 120 }]
  });
  const req = { body: { trackingToken: token, lang: 'en' } };
  const res = createResponse();

  await orderController.trackOrder(req, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.data.status).toBe('preparing');
  expect(res.body.data.items[0].name).toBe('Latte');
  expect(res.body.data).not.toHaveProperty('customer');
  expect(res.body.data).not.toHaveProperty('deliveryAddress');
  expect(res.headers['Cache-Control']).toBe('no-store');
});

test('does not find an order when the tracking token is invalid', async () => {
  const res = createResponse();
  await orderController.trackOrder({ body: { trackingToken: 'not-a-valid-token' } }, res);
  expect(res.statusCode).toBe(404);
  expect(res.body.success).toBe(false);
});
