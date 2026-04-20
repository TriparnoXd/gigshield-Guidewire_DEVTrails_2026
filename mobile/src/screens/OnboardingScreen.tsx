import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Input, Button } from '../components';
import { useUserStore } from '../store';
import { api } from '../api/client';

interface HubOption {
  id: string;
  name: string;
  selected: boolean;
}

export const OnboardingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [riderId, setRiderId] = useState('');
  const [selectedHub, setSelectedHub] = useState<string>('south-delhi');
  const [isLoading, setIsLoading] = useState(false);

  const setUser = useUserStore((state) => state.setUser);

  const hubs: HubOption[] = [
    { id: 'south-delhi', name: 'South Delhi', selected: selectedHub === 'south-delhi' },
    { id: 'north-mumbai', name: 'North Mumbai', selected: selectedHub === 'north-mumbai' },
    { id: 'east-bangalore', name: 'East Bangalore', selected: selectedHub === 'east-bangalore' },
    { id: 'other', name: 'Other Hubs', selected: selectedHub === 'other' },
  ];

  const handleHubSelect = (hubId: string) => {
    setSelectedHub(hubId);
  };

  const handleSecureIncome = async () => {
    if (!mobileNumber || !riderId) {
      alert('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const fullPhone = `+91${mobileNumber}`;

    try {
      console.log(`[Onboarding] Sending OTP to ${fullPhone}`);
      await api.auth.sendOtp(fullPhone);

      setUser({
        phoneNumber: fullPhone,
        riderId,
        hub: selectedHub,
        isVerified: false,
      });

      navigation.navigate('OTPVerification', { phoneNumber: fullPhone });
    } catch (error: any) {
      console.error('[Onboarding] Error sending OTP:', error);
      alert(error.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroGradient} />

          {/* Brand Shield */}
          <View style={styles.brandShield}>
            <View style={styles.shieldContent}>
              <Text style={styles.shieldIcon}>🛡️</Text>
              <Text style={styles.brandText}>GigShield</Text>
            </View>
          </View>

          {/* Hero Text */}
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>
              Fuel Your{'\n'}
              <Text style={[styles.heroTitle, { fontStyle: 'italic', color: colors.primary }]}>
                Momentum.
              </Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Premium insurance coverage tailored for the velocity of Zepto's delivery network.
            </Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.form}>
          {/* Mobile Number Input */}
          <Input
            label="Mobile Number"
            placeholder="98765 43210"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            prefix="+91"
            maxLength={10}
          />

          {/* Rider ID Input */}
          <Input
            label="Zepto Rider ID"
            placeholder="ZPT-XXXXX"
            value={riderId}
            onChangeText={setRiderId}
            icon={<Text style={styles.inputIcon}>🪪</Text>}
          />

          {/* Hub Selection */}
          <Text style={styles.sectionLabel}>Operating Hub</Text>
          <View style={styles.hubGrid}>
            {hubs.map((hub) => (
              <TouchableOpacity
                key={hub.id}
                style={[
                  styles.hubButton,
                  hub.selected && styles.hubButtonSelected,
                ]}
                onPress={() => handleHubSelect(hub.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.hubIcon, hub.selected && styles.hubIconSelected]}>
                  📍
                </Text>
                <Text
                  style={[
                    styles.hubName,
                    hub.selected && styles.hubNameSelected,
                  ]}
                >
                  {hub.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* CTA Button */}
          <View style={styles.ctaContainer}>
            <Button
              title="Secure My Income"
              onPress={() => handleSecureIncome()}
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={isLoading}
              icon={<Text style={styles.buttonIcon}>🛡️</Text>}
            />
            <Text style={styles.legalText}>
              By tapping, you agree to our{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text> and{' '}
              <Text style={styles.legalLink}>Insurance Terms</Text>.{'\n'}
              GigShield is a registered partner of Zepto Logistics.
            </Text>
          </View>
        </View>

        {/* Footer Gradient */}
        <View style={styles.footerGradient} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    height: 397,
    position: 'relative',
  },
  heroImageContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors['surface-container'],
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  brandShield: {
    position: 'absolute',
    top: 48,
    left: spacing[6],
    zIndex: 10,
  },
  shieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(104, 29, 247, 0.1)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors['outline-variant'],
    opacity: 0.15,
  },
  shieldIcon: {
    fontSize: 18,
  },
  brandText: {
    fontFamily: typography.fonts.headline,
    fontWeight: typography.weights.bold,
    color: colors['on-primary'],
    letterSpacing: typography.letterSpacing.tight,
  },
  heroText: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[6],
    zIndex: 10,
  },
  heroTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 56,
    fontWeight: typography.weights.extrabold,
    lineHeight: 62,
    color: colors['on-surface'],
    letterSpacing: typography.letterSpacing.tight,
  },
  heroSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes['body-lg'],
    color: colors['on-surface-variant'],
    marginTop: spacing[4],
    lineHeight: 24,
    maxWidth: '80%',
  },
  form: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    flex: 1,
  },
  sectionLabel: {
    fontFamily: typography.fonts.label,
    fontSize: typography.sizes['label-sm'],
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    color: colors.outline,
    marginLeft: spacing[2],
    marginBottom: spacing[3],
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  hubButton: {
    width: '47%',
    height: 96,
    backgroundColor: colors['surface-container-low'],
    borderRadius: borderRadius.md,
    padding: spacing[4],
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  hubButtonSelected: {
    backgroundColor: colors['surface-container-highest'],
    borderColor: colors.primary,
    opacity: 0.2,
  },
  hubIcon: {
    fontSize: 24,
    opacity: 0.6,
  },
  hubIconSelected: {
    opacity: 1,
  },
  hubName: {
    fontFamily: typography.fonts.headline,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes['title-sm'],
    color: colors['on-surface-variant'],
  },
  hubNameSelected: {
    color: colors['on-surface'],
  },
  ctaContainer: {
    marginTop: spacing[8],
    marginBottom: spacing[12],
  },
  buttonIcon: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  legalText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes['body-sm'],
    color: colors.outline,
    textAlign: 'center',
    marginTop: spacing[6],
    lineHeight: 20,
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  footerGradient: {
    height: 4,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  inputIcon: {
    fontSize: 20,
  },
});
