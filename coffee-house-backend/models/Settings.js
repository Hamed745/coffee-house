const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  storeName: {
    en: { type: String, default: 'Arabic Coffee' },
    ru: { type: String, default: 'Арабский кофе' }
  },
  storeDescription: {
    en: { type: String, default: 'Your perfect cup of coffee, every time' },
    ru: { type: String, default: 'Ваша идеальная чашка кофе, каждый раз' }
  },
  address: {
    en: {
      street: { type: String, default: 'Mira 96, 2nd floor' },
      city: { type: String, default: 'Krasnoyarsk, Center' }
    },
    ru: {
      street: { type: String, default: 'Мира 96, 2 этаж' },
      city: { type: String, default: 'Красноярск, Центр' }
    }
  },
  phone: { type: String, default: '+7 (391) 123-45-67' },
  email: { type: String, default: 'info@coffeehouse.com' },
  workingHours: [
    {
      day: { 
        type: String, 
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      open: { type: String, default: '07:00' },
      close: { type: String, default: '23:00' },
      closed: { type: Boolean, default: false }
    }
  ],
  socialMedia: {
    vk: { type: String, default: 'https://vk.com/coffeehouse' },
    telegram: { type: String, default: 'https://t.me/coffeehouse' },
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' }
  },
  currency: { type: String, default: 'RUB' },
  taxRate: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 100 },
  freeDeliveryThreshold: { type: Number, default: 1000 },
  updatedAt: { type: Date, default: Date.now }
});

settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;