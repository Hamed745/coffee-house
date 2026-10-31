
const Settings = require('../models/Settings');

// ============================================
// Get Store Settings
// ============================================

exports.getSettings = async (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const selectedLang = lang === 'ru' ? 'ru' : 'en';

    const settings = await Settings.getSettings();

    const storeName = settings.storeName || {};
    const storeDescription = settings.storeDescription || {};
    const address = settings.address || {};

    const localizedAddress = address[selectedLang] || {};
    const englishAddress = address.en || {};

    const formattedSettings = {
      storeName: storeName[selectedLang] || storeName.en || '',
      storeDescription:
        storeDescription[selectedLang] || storeDescription.en || '',
      address: {
        street: localizedAddress.street || englishAddress.street || '',
        city: localizedAddress.city || englishAddress.city || ''
      },
      phone: settings.phone,
      email: settings.email,
      workingHours: settings.workingHours,
      socialMedia: settings.socialMedia,
      currency: settings.currency,
      deliveryFee: settings.deliveryFee,
      freeDeliveryThreshold: settings.freeDeliveryThreshold
    };

    res.json({
      success: true,
      data: formattedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching settings',
      message: error.message
    });
  }
};

// ============================================
// Update Store Settings
// ============================================

exports.updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
      settings.updatedAt = Date.now();
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error updating settings',
      message: error.message
    });
  }
};

// ============================================
// Get Working Hours
// ============================================

exports.getWorkingHours = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    const { lang = 'en' } = req.query;
    const selectedLang = lang === 'ru' ? 'ru' : 'en';

    const dayNames = {
      en: {
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday'
      },
      ru: {
        monday: 'Понедельник',
        tuesday: 'Вторник',
        wednesday: 'Среда',
        thursday: 'Четверг',
        friday: 'Пятница',
        saturday: 'Суббота',
        sunday: 'Воскресенье'
      }
    };

    const workingHours = Array.isArray(settings.workingHours)
      ? settings.workingHours
      : [];

    const formattedHours = workingHours.map((hour) => {
      let display;

      if (hour.closed) {
        if (selectedLang === 'en') {
          display = 'Closed';
        } else {
          display = 'Закрыто';
        }
      } else {
        display = `${hour.open} - ${hour.close}`;
      }

      return {
        day: dayNames[selectedLang][hour.day] || hour.day,
        open: hour.open,
        close: hour.close,
        closed: hour.closed,
        display
      };
    });

    res.json({
      success: true,
      data: formattedHours
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching working hours',
      message: error.message
    });
  }
};
