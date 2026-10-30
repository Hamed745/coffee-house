require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Review = require('./models/Review');
const Settings = require('./models/Settings');

const coffeeProducts = [
  {
    name: { en: 'Espresso', ru: 'Эспрессо' },
    description: { 
      en: 'Rich and bold concentrated coffee.', 
      ru: 'Насыщенный и крепкий концентрированный кофе.' 
    },
    category: 'coffee',
    price: 150,
    image: '/pic/istockphoto-1126871442-612x612.jpg 10.jpg',
    featured: true,
    available: true,
    tags: ['strong', 'classic', 'espresso'],
    preparationTime: 3,
  },
  {
    name: { en: 'Cappuccino', ru: 'Капучино' },
    description: { 
      en: 'Espresso with steamed milk foam.', 
      ru: 'Эспрессо со вспененным молоком.' 
    },
    category: 'coffee',
    price: 220,
    image: '/pic/8624835-how-to-make-a-cappuccino-beauty-4x3-0301-13d55eaad60b42058f24369c292d4ccb.jpg 2.jpg',
    featured: true,
    available: true,
    tags: ['creamy', 'foamy', 'milk'],
    preparationTime: 5,
  },
  {
    name: { en: 'Americano', ru: 'Американо' },
    description: { 
      en: 'Espresso diluted with hot water.', 
      ru: 'Эспрессо, разбавленный горячей водой.' 
    },
    category: 'coffee',
    price: 160,
    image: '/pic/americano.jpg 11.jpg',
    featured: false,
    available: true,
    tags: ['classic', 'smooth'],
    preparationTime: 3,
  },
  {
    name: { en: 'Latte', ru: 'Латте' },
    description: { 
      en: 'Creamy milk with a shot of espresso.', 
      ru: 'Сливочное молоко с порцией эспрессо.' 
    },
    category: 'coffee',
    price: 240,
    image: '/pic/how-to-make-a-latte-at-home.jpg 4.jpg',
    featured: true,
    available: true,
    tags: ['creamy', 'smooth', 'milk'],
    preparationTime: 5,
  },
  {
    name: { en: 'Ice Coffee', ru: 'Айс Кофе' },
    description: { 
      en: 'Chilled coffee served over ice.', 
      ru: 'Охлаждённый кофе со льдом.' 
    },
    category: 'coffee',
    price: 270,
    image: '/pic/Iced_Latte.jpg 5.jpg',
    featured: true,
    available: true,
    tags: ['cold', 'refreshing', 'summer'],
    preparationTime: 4,
  },
  {
    name: { en: 'Mocha', ru: 'Мокка' },
    description: { 
      en: 'Chocolate flavored warm coffee.', 
      ru: 'Тёплый кофе с шоколадным вкусом.' 
    },
    category: 'coffee',
    price: 290,
    image: '/pic/mocha-latte-recipe.jpg 6.jpg',
    featured: true,
    available: true,
    tags: ['chocolate', 'sweet', 'creamy'],
    preparationTime: 6,
  },
  {
    name: { en: 'Flat White', ru: 'Флэт Уайт' },
    description: { 
      en: 'Smooth texture with thin foam.', 
      ru: 'Гладкая текстура с тонкой пенкой.' 
    },
    category: 'coffee',
    price: 210,
    image: '/pic/Flat+White-Leaf+Latte+1080x1440_1080x1440.jpg 7.jpg',
    featured: false,
    available: true,
    tags: ['velvety', 'strong', 'smooth'],
    preparationTime: 5,
  },
  {
    name: { en: 'Macchiato', ru: 'Макиато' },
    description: { 
      en: "Espresso 'stained' with a little milk.", 
      ru: 'Эспрессо с капелькой молока.' 
    },
    category: 'coffee',
    price: 200,
    image: '/pic/latte-macchiato-recette-facile-lilie-bakery-500x500.webp 8.webp',
    featured: false,
    available: true,
    tags: ['layered', 'milk', 'elegant'],
    preparationTime: 4,
  },
  {
    name: { en: 'Irish Coffee', ru: 'Ирландский Кофе' },
    description: { 
      en: 'Coffee with a special cream twist.', 
      ru: 'Кофе с особым сливочным вкусом.' 
    },
    category: 'coffee',
    price: 300,
    image: '/pic/2132757-lg.webp 9.webp',
    featured: true,
    available: true,
    tags: ['cream', 'special', 'premium'],
    preparationTime: 6,
  },
];

const dessertProducts = [
  {
    name: { en: 'Croissant', ru: 'Круассан' },
    description: { 
      en: 'Buttery, flaky, and fresh.', 
      ru: 'Маслянистый, слоистый и свежий.' 
    },
    category: 'dessert',
    price: 120,
    image: '/pic/Croissants-article.webp 1.webp',
    featured: true,
    available: true,
    tags: ['pastry', 'buttery', 'french'],
    calories: 272,
    stock: 20,
  },
  {
    name: { en: 'Choco Croissant', ru: 'Шоколадный Круассан' },
    description: { 
      en: 'Filled with rich chocolate.', 
      ru: 'С начинкой из насыщенного шоколада.' 
    },
    category: 'dessert',
    price: 150,
    image: '/pic/v1608585894_13_vjwdhl.webp 2.webp',
    featured: true,
    available: true,
    tags: ['chocolate', 'pastry', 'sweet'],
    calories: 320,
    stock: 20,
  },
  {
    name: { en: 'Muffin', ru: 'Маффин' },
    description: { 
      en: 'Soft blueberry or chocolate muffin.', 
      ru: 'Мягкий маффин с черникой или шоколадом.' 
    },
    category: 'dessert',
    price: 140,
    image: '/pic/Template-Size-for-Blog-Photos-85.jpg 3.jpg',
    featured: false,
    available: true,
    tags: ['soft', 'blueberry', 'chocolate'],
    calories: 280,
    stock: 20,
  },
  {
    name: { en: 'Cheesecake', ru: 'Чизкейк' },
    description: { 
      en: 'Classic NY style cheesecake.', 
      ru: 'Классический чизкейк в нью-йоркском стиле.' 
    },
    category: 'dessert',
    price: 250,
    image: '/pic/cheesecake-1-22.jpg 4.jpg',
    featured: true,
    available: true,
    tags: ['creamy', 'sweet', 'classic'],
    calories: 350,
    stock: 20,
  },
  {
    name: { en: 'Brownie', ru: 'Брауни' },
    description: { 
      en: 'Fudgy chocolate brownie.', 
      ru: 'Шоколадный брауни.' 
    },
    category: 'dessert',
    price: 100,
    image: '/pic/fudgy-brownies-thumbnail-1-of-1.jpg 5.jpg',
    featured: true,
    available: true,
    tags: ['chocolate', 'fudgy', 'sweet'],
    calories: 320,
    stock: 20,
  },
  {
    name: { en: 'Tiramisu', ru: 'Тирамису' },
    description: { 
      en: 'Italian coffee-flavored dessert.', 
      ru: 'Итальянский десерт с кофейным вкусом.' 
    },
    category: 'dessert',
    price: 220,
    image: '/pic/tiramisu-featured.webp 6.webp',
    featured: true,
    available: true,
    tags: ['italian', 'coffee', 'creamy'],
    calories: 380,
    stock: 20,
  },
];

const sampleReviews = [
  {
    customerName: 'Ahmed S.',
    rating: 5,
    comment: "The best flat white I've had in years! Highly recommended.",
    status: 'approved',
  },
  {
    customerName: 'Sarah M.',
    rating: 5,
    comment: 'Cozy atmosphere and delicious cheesecake. Will come again!',
    status: 'approved',
  },
  {
    customerName: 'Khalid A.',
    rating: 4,
    comment: 'Great place for working or studying. Fast Wi-Fi.',
    status: 'approved',
  },
];

async function seedDatabase(options = {}) {
  try {
    const { useExistingConnection = false, skipClear = false } = options;
    if (!useExistingConnection) {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coffee-house';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB');
    }

    // Clear old data
    if (!skipClear) {
      await Product.deleteMany({});
      await Review.deleteMany({});
      await Settings.deleteMany({});
      console.log('Old data cleared');
    }

    // Add products
    const createdProducts = await Product.insertMany([...coffeeProducts, ...dessertProducts]);
    console.log(`${createdProducts.length} products added`);

    // Add reviews
    const createdReviews = await Review.insertMany(sampleReviews);
    console.log(`${createdReviews.length} reviews added`);

    // Create settings
    await Settings.create({
      storeName: 'Coffee House',
      storeDescription: 'We serve the best coffee made with love and passion. Visit us to experience the aroma and taste of freshly brewed coffee.',
      workingHours: [
        { day: 'sunday', open: '07:00', close: '23:00', closed: false },
        { day: 'monday', open: '07:00', close: '23:00', closed: false },
        { day: 'tuesday', open: '07:00', close: '23:00', closed: false },
        { day: 'wednesday', open: '07:00', close: '23:00', closed: false },
        { day: 'thursday', open: '07:00', close: '23:00', closed: false },
        { day: 'friday', open: '08:00', close: '00:00', closed: false },
        { day: 'saturday', open: '08:00', close: '00:00', closed: false },
      ],
      address: {
        street: 'мира 96, 2 этаж',
        city: 'Красноярск, центр',
        country: 'Russia',
      },
      socialMedia: {
        vk: 'https://vk.com/coffeehouse',
        telegram: 'https://t.me/coffeehouse',
      },
    });
    console.log('Settings created');

    console.log('✅ Database seeded successfully!');
    console.log(`   - ${coffeeProducts.length} coffee items`);
    console.log(`   - ${dessertProducts.length} dessert items`);
    console.log(`   - ${sampleReviews.length} reviews`);
    if (!useExistingConnection) process.exit(0);
    return { success: true };
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    if (!options.useExistingConnection) process.exit(1);
    return { success: false, error };
  }
}

module.exports = { seedDatabase };

if (require.main === module) {
  seedDatabase();
}
