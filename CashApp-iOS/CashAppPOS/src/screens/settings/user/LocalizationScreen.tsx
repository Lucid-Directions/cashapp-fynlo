import React, { useState } from 'react';

import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  supported: boolean;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
  supported: boolean;
}

interface TimeZone {
  id: string;
  name: string;
  offset: string;
  region: string;
}

const LocalizationScreen: React.FC = () => {
  const navigation = useNavigation();

  const [languages] = useState<Language[]>([
    { code: 'en-GB', name: 'English (UK)', nativeName: 'English', flag: '🇬🇧', supported: true },
    { code: 'en-US', name: 'English (US)', nativeName: 'English', flag: '🇺🇸', supported: true },
    { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷', supported: true },
    { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', supported: true },
    { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', supported: true },
    { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', supported: true },
    { code: 'pt-PT', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', supported: true },
    { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', supported: true },
    { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', supported: false },
    { code: 'da-DK', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', supported: false },
    { code: 'no-NO', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', supported: false },
    { code: 'pl-PL', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', supported: false },
  ]);

  const [currencies] = useState<Currency[]>([
    { code: 'GBP', name: 'British Pound', symbol: '£', supported: true },
    { code: 'EUR', name: 'Euro', symbol: '€', supported: true },
    { code: 'USD', name: 'US Dollar', symbol: '$', supported: true },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', supported: true },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', supported: true },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', supported: true },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', supported: false },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr', supported: false },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', supported: false },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', supported: false },
  ]);

  const [timeZones] = useState<TimeZone[]>([
    { id: 'Europe/London', name: 'London', offset: 'GMT+0', region: 'United Kingdom' },
    { id: 'Europe/Paris', name: 'Paris', offset: 'GMT+1', region: 'France' },
    { id: 'Europe/Berlin', name: 'Berlin', offset: 'GMT+1', region: 'Germany' },
    { id: 'Europe/Madrid', name: 'Madrid', offset: 'GMT+1', region: 'Spain' },
    { id: 'Europe/Rome', name: 'Rome', offset: 'GMT+1', region: 'Italy' },
    { id: 'Europe/Amsterdam', name: 'Amsterdam', offset: 'GMT+1', region: 'Netherlands' },
    { id: 'Europe/Stockholm', name: 'Stockholm', offset: 'GMT+1', region: 'Sweden' },
    { id: 'Europe/Copenhagen', name: 'Copenhagen', offset: 'GMT+1', region: 'Denmark' },
    { id: 'Europe/Oslo', name: 'Oslo', offset: 'GMT+1', region: 'Norway' },
    { id: 'America/New_York', name: 'New York', offset: 'GMT-5', region: 'United States' },
    { id: 'America/Los_Angeles', name: 'Los Angeles', offset: 'GMT-8', region: 'United States' },
    { id: 'America/Toronto', name: 'Toronto', offset: 'GMT-5', region: 'Canada' },
  ]);

  const [selectedLanguage, setSelectedLanguage] = useState('en-GB');
  const [selectedCurrency, setSelectedCurrency] = useState('GBP');
  const [selectedTimeZone, setSelectedTimeZone] = useState('Europe/London');

  // Regional settings
  const [regionalSettings, setRegionalSettings] = useState({
    use24HourFormat: true,
    showLeadingZero: true,
    useDDMMYYYYFormat: true,
    useMetricSystem: true,
    showCurrencySymbolFirst: true,
    useThousandsSeparator: true,
    decimalPlaces: 2,
  });

  // Localization features
  const [localizationFeatures, setLocalizationFeatures] = useState({
    autoDetectLocation: true,
    syncWithDevice: false,
    rightToLeftSupport: false,
    localizedNumbers: true,
    localizedCurrency: true,
    localizedDates: true,
  });

  const handleLanguageSelect = (languageCode: string) => {
    const language = languages.find((l) => l.code === languageCode);

    if (!language?.supported) {
      Alert.alert(
        'Language Not Available',
        `${language?.name} is not currently supported. We're working to add more languages in future updates.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedLanguage(languageCode);
    Alert.alert(
      'Language Changed',
      `Language changed to ${language.name}. The app will restart to apply changes.`,
      [{ text: 'OK' }]
    );
  };

  const handleCurrencySelect = (currencyCode: string) => {
    const currency = currencies.find((c) => c.code === currencyCode);

    if (!currency?.supported) {
      Alert.alert(
        'Currency Not Available',
        `${currency?.name} is not currently supported. We're working to add more currencies.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedCurrency(currencyCode);
    Alert.alert('Success', `Currency changed to ${currency.name} (${currency.symbol})`);
  };

  const handleTimeZoneSelect = (timeZoneId: string) => {
    const timeZone = timeZones.find((tz) => tz.id === timeZoneId);
    setSelectedTimeZone(timeZoneId);
    Alert.alert('Success', `Time zone changed to ${timeZone?.name} (${timeZone?.offset})`);
  };

  const toggleRegionalSetting = (setting: keyof typeof regionalSettings) => {
    setRegionalSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const toggleLocalizationFeature = (feature: keyof typeof localizationFeatures) => {
    setLocalizationFeatures((prev) => ({
      ...prev,
      [feature]: !prev[feature],
    }));
  };

  const handleImportLocale = () => {
    Alert.alert('Import Locale Settings', 'Import settings from another device or backup?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'From File',
        onPress: () => {
          Alert.alert('Info', 'File browser would open here');
        },
      },
      {
        text: 'From Device',
        onPress: () => {
          Alert.alert('Info', 'Device locale detection would run here');
        },
      },
    ]);
  };

  const handleExportLocale = () => {
    Alert.alert('Export Locale Settings', 'Export current settings for backup or transfer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Export',
        onPress: () => {
          Alert.alert('Success', 'Locale settings exported successfully!');
        },
      },
    ]);
  };

  const getSelectedLanguage = () => {
    return languages.find((l) => l.code === selectedLanguage);
  };

  const getSelectedCurrency = () => {
    return currencies.find((c) => c.code === selectedCurrency);
  };

  const getSelectedTimeZone = () => {
    return timeZones.find((tz) => tz.id === selectedTimeZone);
  };

  const LanguageItem = ({ language }: { language: Language }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        selectedLanguage === language.code && styles.selectedItem,
        !language.supported && styles.disabledItem,
      ]}
      onPress={() => handleLanguageSelect(language.code)}
      disabled={!language.supported}
    >
      <Text style={styles.flagText}>{language.flag}</Text>
      <View style={styles.languageInfo}>
        <Text style={[styles.languageName, !language.supported && styles.disabledText]}>
          {language.name}
        </Text>
        <Text style={[styles.languageNative, !language.supported && styles.disabledText]}>
          {language.nativeName}
        </Text>
      </View>
      {!language.supported && <Text style={styles.comingSoonText}>Coming Soon</Text>}
      {selectedLanguage === language.code && (
        <Icon name="check-circle" size={24} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );

  const CurrencyItem = ({ currency }: { currency: Currency }) => (
    <TouchableOpacity
      style={[
        styles.currencyItem,
        selectedCurrency === currency.code && styles.selectedItem,
        !currency.supported && styles.disabledItem,
      ]}
      onPress={() => handleCurrencySelect(currency.code)}
      disabled={!currency.supported}
    >
      <View style={styles.currencySymbol}>
        <Text style={[styles.currencySymbolText, !currency.supported && styles.disabledText]}>
          {currency.symbol}
        </Text>
      </View>
      <View style={styles.currencyInfo}>
        <Text style={[styles.currencyName, !currency.supported && styles.disabledText]}>
          {currency.name}
        </Text>
        <Text style={[styles.currencyCode, !currency.supported && styles.disabledText]}>
          {currency.code}
        </Text>
      </View>
      {!currency.supported && <Text style={styles.comingSoonText}>Coming Soon</Text>}
      {selectedCurrency === currency.code && (
        <Icon name="check-circle" size={24} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );

  const TimeZoneItem = ({ timeZone }: { timeZone: TimeZone }) => (
    <TouchableOpacity
      style={[styles.timeZoneItem, selectedTimeZone === timeZone.id && styles.selectedItem]}
      onPress={() => handleTimeZoneSelect(timeZone.id)}
    >
      <View style={styles.timeZoneInfo}>
        <Text style={styles.timeZoneName}>{timeZone.name}</Text>
        <Text style={styles.timeZoneDetails}>
          {timeZone.region} • {timeZone.offset}
        </Text>
      </View>
      {selectedTimeZone === timeZone.id && (
        <Icon name="check-circle" size={24} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Language & Region</Text>
        <TouchableOpacity style={styles.exportButton} onPress={handleExportLocale}>
          <Icon name="file-download" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Settings Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Settings</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Icon name="language" size={24} color={Colors.primary} />
                <Text style={styles.summaryLabel}>Language</Text>
                <Text style={styles.summaryValue}>{getSelectedLanguage()?.name}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Icon name="attach-money" size={24} color={Colors.primary} />
                <Text style={styles.summaryLabel}>Currency</Text>
                <Text style={styles.summaryValue}>{getSelectedCurrency()?.code}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Icon name="schedule" size={24} color={Colors.primary} />
                <Text style={styles.summaryLabel}>Time Zone</Text>
                <Text style={styles.summaryValue}>{getSelectedTimeZone()?.name}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Language Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>
          <View style={styles.languageList}>
            {languages.map((language) => (
              <LanguageItem key={language.code} language={language} />
            ))}
          </View>
        </View>

        {/* Currency Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <View style={styles.currencyList}>
            {currencies.map((currency) => (
              <CurrencyItem key={currency.code} currency={currency} />
            ))}
          </View>
        </View>

        {/* Time Zone Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time Zone</Text>
          <View style={styles.timeZoneList}>
            {timeZones.map((timeZone) => (
              <TimeZoneItem key={timeZone.id} timeZone={timeZone} />
            ))}
          </View>
        </View>

        {/* Regional Formats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regional Formats</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>24-hour time format</Text>
                <Text style={styles.settingDescription}>
                  Display time as 15:30 instead of 3:30 PM
                </Text>
              </View>
              <Switch
                value={regionalSettings.use24HourFormat}
                onValueChange={() => toggleRegionalSetting('use24HourFormat')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>DD/MM/YYYY date format</Text>
                <Text style={styles.settingDescription}>
                  Display dates as 31/12/2024 instead of 12/31/2024
                </Text>
              </View>
              <Switch
                value={regionalSettings.useDDMMYYYYFormat}
                onValueChange={() => toggleRegionalSetting('useDDMMYYYYFormat')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Metric system</Text>
                <Text style={styles.settingDescription}>
                  Use metric units (cm, kg) instead of imperial
                </Text>
              </View>
              <Switch
                value={regionalSettings.useMetricSystem}
                onValueChange={() => toggleRegionalSetting('useMetricSystem')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Currency symbol first</Text>
                <Text style={styles.settingDescription}>Display as £10.50 instead of 10.50£</Text>
              </View>
              <Switch
                value={regionalSettings.showCurrencySymbolFirst}
                onValueChange={() => toggleRegionalSetting('showCurrencySymbolFirst')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Thousands separator</Text>
                <Text style={styles.settingDescription}>
                  Display as 1,000.50 instead of 1000.50
                </Text>
              </View>
              <Switch
                value={regionalSettings.useThousandsSeparator}
                onValueChange={() => toggleRegionalSetting('useThousandsSeparator')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Advanced Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Features</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-detect location</Text>
                <Text style={styles.settingDescription}>
                  Automatically set region based on device location
                </Text>
              </View>
              <Switch
                value={localizationFeatures.autoDetectLocation}
                onValueChange={() => toggleLocalizationFeature('autoDetectLocation')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Sync with device</Text>
                <Text style={styles.settingDescription}>
                  Use device language and region settings
                </Text>
              </View>
              <Switch
                value={localizationFeatures.syncWithDevice}
                onValueChange={() => toggleLocalizationFeature('syncWithDevice')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Localized numbers</Text>
                <Text style={styles.settingDescription}>Format numbers according to region</Text>
              </View>
              <Switch
                value={localizationFeatures.localizedNumbers}
                onValueChange={() => toggleLocalizationFeature('localizedNumbers')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Locale Management</Text>
          <View style={styles.actionCard}>
            <TouchableOpacity style={styles.actionButton} onPress={handleImportLocale}>
              <Icon name="file-upload" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Import Settings</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleExportLocale}>
              <Icon name="file-download" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Export Settings</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Info', 'Device locale sync would be implemented here')}
            >
              <Icon name="sync" size={24} color={Colors.success} />
              <Text style={styles.actionButtonText}>Sync with Device</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  exportButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    paddingHorizontal: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
  },
  languageList: {
    paddingHorizontal: 16,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedItem: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  disabledItem: {
    opacity: 0.5,
  },
  flagText: {
    fontSize: 24,
    marginRight: 12,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  languageNative: {
    fontSize: 14,
    color: Colors.lightText,
  },
  comingSoonText: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500',
    marginRight: 8,
  },
  disabledText: {
    color: Colors.mediumGray,
  },
  currencyList: {
    paddingHorizontal: 16,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencySymbol: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currencySymbolText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  currencyCode: {
    fontSize: 14,
    color: Colors.lightText,
  },
  timeZoneList: {
    paddingHorizontal: 16,
  },
  timeZoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeZoneInfo: {
    flex: 1,
  },
  timeZoneName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  timeZoneDetails: {
    fontSize: 14,
    color: Colors.lightText,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  actionCard: {
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
});

export default LocalizationScreen;
