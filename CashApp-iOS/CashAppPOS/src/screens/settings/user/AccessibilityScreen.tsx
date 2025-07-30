import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Slider,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

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

interface AccessibilitySettings {
  // Visual
  largeText: boolean;
  boldText: boolean;
  highContrast: boolean;
  reduceTransparency: boolean;
  invertColors: boolean;
  grayscale: boolean;

  // Motor
  reduceMotion: boolean;
  stickyKeys: boolean;
  slowKeys: boolean;
  bounceKeys: boolean;
  tapToClick: boolean;

  // Cognitive
  simplifiedInterface: boolean;
  reducedAnimations: boolean;
  extendedTimeouts: boolean;
  confirmationDialogs: boolean;
  readAloud: boolean;

  // Audio
  visualIndicators: boolean;
  vibrationFeedback: boolean;
  soundAlerts: boolean;
  captionsEnabled: boolean;
}

const AccessibilityScreen: React.FC = () => {
  const navigation = useNavigation();

  const [settings, setSettings] = useState<AccessibilitySettings>({
    // Visual
    largeText: _false,
    boldText: _false,
    highContrast: _false,
    reduceTransparency: _false,
    invertColors: _false,
    grayscale: _false,

    // Motor
    reduceMotion: _false,
    stickyKeys: _false,
    slowKeys: _false,
    bounceKeys: _false,
    tapToClick: _true,

    // Cognitive
    simplifiedInterface: _false,
    reducedAnimations: _false,
    extendedTimeouts: _false,
    confirmationDialogs: _true,
    readAloud: _false,

    // Audio
    visualIndicators: _true,
    vibrationFeedback: _true,
    soundAlerts: _true,
    captionsEnabled: _false,
  });

  // Slider values
  const [textSize, setTextSize] = useState(16);
  const [contrastLevel, setContrastLevel] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [timeoutDuration, setTimeoutDuration] = useState(30);
  const [buttonSize, setButtonSize] = useState(44);

  const toggleSetting = (setting: keyof AccessibilitySettings) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset Accessibility Settings',
      'This will reset all accessibility settings to their default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setSettings({
              largeText: _false,
              boldText: _false,
              highContrast: _false,
              reduceTransparency: _false,
              invertColors: _false,
              grayscale: _false,
              reduceMotion: _false,
              stickyKeys: _false,
              slowKeys: _false,
              bounceKeys: _false,
              tapToClick: _true,
              simplifiedInterface: _false,
              reducedAnimations: _false,
              extendedTimeouts: _false,
              confirmationDialogs: _true,
              readAloud: _false,
              visualIndicators: _true,
              vibrationFeedback: _true,
              soundAlerts: _true,
              captionsEnabled: _false,
            });
            setTextSize(16);
            setContrastLevel(0);
            setAnimationSpeed(1);
            setTimeoutDuration(30);
            setButtonSize(44);
            Alert.alert('Success', 'Accessibility settings reset to defaults.');
          },
        },
      ],
    );
  };

  const handleAccessibilityShortcuts = () => {
    Alert.alert('Accessibility Shortcuts', 'Configure quick access to accessibility features:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Home Button Triple-Click',
        onPress: () => {
          Alert.alert('Info', 'Home button shortcut configured');
        },
      },
      {
        text: 'Volume Button Hold',
        onPress: () => {
          Alert.alert('Info', 'Volume button shortcut configured');
        },
      },
    ]);
  };

  const handleTutorialAccess = () => {
    Alert.alert('Accessibility Tutorial', 'Learn how to use accessibility features effectively.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start Tutorial',
        onPress: () => {
          Alert.alert('Info', 'Accessibility tutorial would start here');
        },
      },
    ]);
  };

  const getTextSizeDescription = (size: _number) => {
    if (size < 14) {
      return 'Small';
    }
    if (size < 18) {
      return 'Medium';
    }
    if (size < 22) {
      return 'Large';
    }
    if (size < 26) {
      return 'Extra Large';
    }
    return 'Accessibility Size';
  };

  const getContrastDescription = (level: _number) => {
    if (level === 0) {
      return 'Normal';
    }
    if (level < 0.5) {
      return 'Moderate';
    }
    return 'High';
  };

  const getSpeedDescription = (speed: _number) => {
    if (speed < 0.5) {
      return 'Very Slow';
    }
    if (speed < 1) {
      return 'Slow';
    }
    if (speed === 1) {
      return 'Normal';
    }
    if (speed < 1.5) {
      return 'Fast';
    }
    return 'Very Fast';
  };

  const AccessibilityRow = ({
    icon,
    title,
    description,
    setting,
    iconColor = Colors.secondary,
    onInfoPress,
  }: {
    icon: string;
    title: string;
    description: string;
    setting: keyof AccessibilitySettings;
    iconColor?: string;
    onInfoPress?: () => void;
  }) => (
    <View style={styles.accessibilityRow}>
      <View style={styles.accessibilityInfo}>
        <Icon name={icon} size={24} color={iconColor} />
        <View style={styles.accessibilityTextInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.accessibilityTitle}>{title}</Text>
            {onInfoPress && (
              <TouchableOpacity onPress={onInfoPress} style={styles.infoButton}>
                <Icon name="info-outline" size={16} color={Colors.lightText} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.accessibilityDescription}>{description}</Text>
        </View>
      </View>
      <Switch
        value={settings[setting]}
        onValueChange={() => toggleSetting(__setting)}
        trackColor={{ false: Colors.lightGray, true: Colors.primary }}
        thumbColor={Colors.white}
      />
    </View>
  );

  const SliderRow = ({
    icon,
    title,
    value,
    onValueChange,
    minimumValue,
    maximumValue,
    description,
    unit = '',
  }: {
    icon: string;
    title: string;
    value: number;
    onValueChange: (value: _number) => void;
    minimumValue: number;
    maximumValue: number;
    description: string;
    unit?: string;
  }) => (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Icon name={icon} size={24} color={Colors.secondary} />
        <View style={styles.sliderTitleInfo}>
          <Text style={styles.sliderTitle}>{title}</Text>
          <Text style={styles.sliderValue}>
            {value.toFixed(0)}
            {unit} - {description}
          </Text>
        </View>
      </View>
      <Slider
        style={styles.slider}
        value={value}
        onValueChange={onValueChange}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        thumbStyle={styles.sliderThumb}
        trackStyle={styles.sliderTrack}
        minimumTrackTintColor={Colors.primary}
        maximumTrackTintColor={Colors.lightGray}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accessibility</Text>
        <TouchableOpacity style={styles.helpButton} onPress={handleTutorialAccess}>
          <Icon name="help-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickAccessCard}>
            <TouchableOpacity
              style={styles.quickAccessButton}
              onPress={handleAccessibilityShortcuts}>
              <Icon name="touch-app" size={32} color={Colors.primary} />
              <Text style={styles.quickAccessText}>Shortcuts</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAccessButton} onPress={handleTutorialAccess}>
              <Icon name="school" size={32} color={Colors.secondary} />
              <Text style={styles.quickAccessText}>Tutorial</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAccessButton} onPress={handleResetToDefaults}>
              <Icon name="restore" size={32} color={Colors.warning} />
              <Text style={styles.quickAccessText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Text & Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Text & Display</Text>
          <View style={styles.settingsCard}>
            <SliderRow
              icon="format-size"
              title="Text Size"
              value={textSize}
              onValueChange={setTextSize}
              minimumValue={12}
              maximumValue={32}
              description={getTextSizeDescription(__textSize)}
              unit="pt"
            />

            <AccessibilityRow
              icon="format-bold"
              title="Bold Text"
              description="Make text easier to read with bold formatting"
              setting="boldText"
              onInfoPress={() =>
                Alert.alert(
                  'Bold Text',
                  'Increases text weight throughout the app to improve readability.',
                )
              }
            />

            <AccessibilityRow
              icon="visibility"
              title="Large Text"
              description="Enable larger text sizes for better readability"
              setting="largeText"
              onInfoPress={() =>
                Alert.alert(
                  'Large Text',
                  'Uses larger text sizes that scale with your text size slider setting.',
                )
              }
            />

            <SliderRow
              icon="contrast"
              title="Contrast Level"
              value={contrastLevel}
              onValueChange={setContrastLevel}
              minimumValue={0}
              maximumValue={1}
              description={getContrastDescription(__contrastLevel)}
            />

            <AccessibilityRow
              icon="invert-colors"
              title="High Contrast"
              description="Increase contrast for better visibility"
              setting="highContrast"
              onInfoPress={() =>
                Alert.alert(
                  'High Contrast',
                  'Uses high contrast colors to make content easier to distinguish.',
                )
              }
            />

            <AccessibilityRow
              icon="opacity"
              title="Reduce Transparency"
              description="Reduce transparent elements for clarity"
              setting="reduceTransparency"
            />

            <AccessibilityRow
              icon="invert-colors-off"
              title="Invert Colors"
              description="Invert display colors for easier viewing"
              setting="invertColors"
            />

            <AccessibilityRow
              icon="filter-b-and-w"
              title="Grayscale"
              description="Display interface in grayscale"
              setting="grayscale"
            />
          </View>
        </View>

        {/* Motion & Interaction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motion & Interaction</Text>
          <View style={styles.settingsCard}>
            <AccessibilityRow
              icon="slow-motion-video"
              title="Reduce Motion"
              description="Minimize animations and motion effects"
              setting="reduceMotion"
              onInfoPress={() =>
                Alert.alert(
                  'Reduce Motion',
                  'Reduces or removes animations that might cause motion sensitivity issues.',
                )
              }
            />

            <SliderRow
              icon="speed"
              title="Animation Speed"
              value={animationSpeed}
              onValueChange={setAnimationSpeed}
              minimumValue={0.25}
              maximumValue={2}
              description={getSpeedDescription(__animationSpeed)}
              unit="x"
            />

            <SliderRow
              icon="touch-app"
              title="Button Size"
              value={buttonSize}
              onValueChange={setButtonSize}
              minimumValue={32}
              maximumValue={64}
              description="Touch target size"
              unit="pt"
            />

            <AccessibilityRow
              icon="pan-tool"
              title="Sticky Keys"
              description="Press modifier keys one at a time"
              setting="stickyKeys"
            />

            <AccessibilityRow
              icon="keyboard"
              title="Slow Keys"
              description="Ignore brief key presses"
              setting="slowKeys"
            />

            <AccessibilityRow
              icon="touch-app"
              title="Tap to Click"
              description="Use tap gesture instead of press"
              setting="tapToClick"
            />
          </View>
        </View>

        {/* Cognitive Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cognitive Support</Text>
          <View style={styles.settingsCard}>
            <AccessibilityRow
              icon="simplified"
              title="Simplified Interface"
              description="Reduce visual complexity and clutter"
              setting="simplifiedInterface"
              onInfoPress={() =>
                Alert.alert(
                  'Simplified Interface',
                  'Reduces visual complexity by hiding advanced features and using simpler layouts.',
                )
              }
            />

            <AccessibilityRow
              icon="animation"
              title="Reduced Animations"
              description="Minimize distracting animations"
              setting="reducedAnimations"
            />

            <SliderRow
              icon="timer"
              title="Timeout Duration"
              value={timeoutDuration}
              onValueChange={setTimeoutDuration}
              minimumValue={10}
              maximumValue={120}
              description="Automatic timeout delay"
              unit="s"
            />

            <AccessibilityRow
              icon="timer-off"
              title="Extended Timeouts"
              description="Give more time for interactions"
              setting="extendedTimeouts"
            />

            <AccessibilityRow
              icon="check-circle"
              title="Confirmation Dialogs"
              description="Ask before important actions"
              setting="confirmationDialogs"
            />

            <AccessibilityRow
              icon="record-voice-over"
              title="Read Aloud"
              description="Audio feedback for interface elements"
              setting="readAloud"
              onInfoPress={() =>
                Alert.alert(
                  'Read Aloud',
                  'Uses text-to-speech to read interface elements and content aloud.',
                )
              }
            />
          </View>
        </View>

        {/* Audio & Feedback */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Audio & Feedback</Text>
          <View style={styles.settingsCard}>
            <AccessibilityRow
              icon="visibility"
              title="Visual Indicators"
              description="Show visual cues for audio alerts"
              setting="visualIndicators"
            />

            <AccessibilityRow
              icon="vibration"
              title="Vibration Feedback"
              description="Use vibration for notifications"
              setting="vibrationFeedback"
            />

            <AccessibilityRow
              icon="volume-up"
              title="Sound Alerts"
              description="Audio notifications and feedback"
              setting="soundAlerts"
            />

            <AccessibilityRow
              icon="closed-caption"
              title="Captions"
              description="Show text captions for audio content"
              setting="captionsEnabled"
            />
          </View>
        </View>

        {/* Accessibility Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Icon name="info-outline" size={20} color={Colors.secondary} />
              <Text style={styles.infoText}>
                This app is designed to meet WCAG 2.1 AA accessibility standards.
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="devices" size={20} color={Colors.secondary} />
              <Text style={styles.infoText}>
                Works with iOS VoiceOver, Switch Control, and other assistive technologies.
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="feedback" size={20} color={Colors.secondary} />
              <Text style={styles.infoText}>
                Found an accessibility issue? Contact support for assistance.
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionCard}>
            <TouchableOpacity style={styles.actionButton} onPress={handleAccessibilityShortcuts}>
              <Icon name="settings" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Configure Shortcuts</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleTutorialAccess}>
              <Icon name="play-circle-outline" size={24} color={Colors.success} />
              <Text style={styles.actionButtonText}>Accessibility Tutorial</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Info', 'Device accessibility settings would open here')}>
              <Icon name="phone-android" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Device Settings</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleResetToDefaults}>
              <Icon name="restore" size={24} color={Colors.warning} />
              <Text style={[styles.actionButtonText, { color: Colors.warning }]}>
                Reset to Defaults
              </Text>
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
  helpButton: {
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
  quickAccessCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  quickAccessButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickAccessText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 8,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  accessibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  accessibilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  accessibilityTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accessibilityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
    flex: 1,
  },
  infoButton: {
    padding: 4,
  },
  accessibilityDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  sliderRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderTitleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  sliderTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  sliderValue: {
    fontSize: 14,
    color: Colors.lightText,
  },
  slider: {
    height: 40,
  },
  sliderThumb: {
    backgroundColor: Colors.primary,
    width: 20,
    height: 20,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  infoCard: {
    paddingHorizontal: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
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

export default AccessibilityScreen;
