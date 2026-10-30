const Settings = require('../models/Settings');

exports.getSettings = async (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const settings = await Settings.getSettings();
    
    const formattedSettings = {
      storeName: settings.storeName[lang] || settings.storeName.en,
      storeDescription: settings.storeDescription[lang] || settings.storeDescription.en,
      address: {
        street: settings.address[lang].street || settings.address.en.street,
        city: settings.address[lang].city || settings.address.en.city
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

exports.getWorkingHours = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const { lang = 'en' } = req.query;
    
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
    
    const formattedHours = settings.workingHours.map(hour => ({
      day: dayNames[lang][hour.day] || hour.day,
      open: hour.open,
      close: hour.close,
      closed: hour.closed,
      display: hour.closed 
        ? (lang === 'en' ? 'Closed' : 'Закрыто')
        : `${hour.open} - ${hour.close}`
    }));
    
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