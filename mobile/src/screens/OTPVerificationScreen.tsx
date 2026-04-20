import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Button, OTPInput } from '../components';
import { useUserStore } from '../store';
import { api } from '../api/client';

interface OTPVerificationScreenProps {
  navigation: any;
  route: any;
}

export const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const phoneNumber = route?.params?.phoneNumber || '+91 98765 43210';
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const setUser = useUserStore((state) => state.setUser);
  const setToken = useUserStore((state) => state.setToken);
  const setVerified = useUserStore((state) => state.setVerified);
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleOTPComplete = (code: string) => {
    setOtp(code);
  };

  const handleVerify = async () => {
    if (otp.length < 6) return;

    setIsVerifying(true);
    console.log(`[OTP] Verifying code ${otp} for ${phoneNumber}`);

    try {
      const response = await api.auth.verifyOtp(phoneNumber, otp);
      const { access_token, worker } = response.data;

      console.log('[OTP] Verification successful', { workerId: worker.id });

      // Update store with token and worker info
      setToken(access_token);
      if (user) {
        setUser({
          ...user,
          id: worker.id,
          isVerified: true
        });
      }

      setVerified(true);
      navigation.navigate('ProtectionPlans');
    } catch (error: any) {
      console.error('[OTP] Verification failed:', error);
      alert(error.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = () => {
    setTimer(30);
    setCanResend(false);
    setOtp('');
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📱</Text>
          </View>
          <Text style={styles.title}>Verify Your Number</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{'\n'}
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
          </Text>
        </View>

        <View style={styles.otpSection}>
          <Text style={styles.sectionLabel}>ENTER CODE</Text>
          <OTPInput length={6} onComplete={handleOTPComplete} />
        </View>

        <View style={styles.resendSection}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendText}>Resend Code</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>
              Resend code in <Text style={styles.timerBold}>{formatTimer(timer)}</Text>
            </Text>
          )}
        </View>

        <View style={styles.bottomSection}>
          <Button
            title="Verify & Continue"
            onPress={handleVerify}
            variant="primary"
            size="lg"
            disabled={otp.length < 6}
            loading={isVerifying}
            style={styles.verifyButton}
          />
          <Text style={styles.legalText}>
            By continuing, you confirm that you agree to our{'\n'}
            <Text style={styles.legalLink}>Terms of Service</Text> and{' '}
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Text>
        </View>

        <View style={styles.helpCard}>
          <Text style={styles.helpIcon}>💬</Text>
          <View style={styles.helpContent}>
            <Text style={styles.helpTitle}>Didn't receive the code?</Text>
            <Text style={styles.helpSubtitle}>
              Check your network or contact support
            </Text>
          </View>
          <TouchableOpacity style={styles.helpButton}>
            <Text style={styles.helpButtonText}>Get Help</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors['primary-container'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontFamily: typography.fonts.headline,
    fontSize: typography.sizes['headline-lg'],
    fontWeight: typography.weights.extrabold,
    color: colors['on-surface'],
    textAlign: 'center',
    marginBottom: spacing[2],
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes['body-md'],
    color: colors['on-surface-variant'],
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneNumber: {
    fontFamily: typography.fonts.headline,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  otpSection: {
    marginBottom: spacing[8],
  },
  sectionLabel: {
    fontFamily: typography.fonts.label,
    fontSize: typography.sizes['label-sm'],
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  resendText: {
    fontFamily: typography.fonts.headline,
    fontSize: typography.sizes['body-md'],
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  timerText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes['body-md'],
    color: colors['on-surface-variant'],
  },
  timerBold: {
    fontFamily: typography.fonts.headline,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  bottomSection: {
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  verifyButton: {
    width: '100%',
    marginBottom: spacing[6],
  },
  legalText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes['body-sm'],
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 20,
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors['surface-container'],
    padding: spacing[4],
    borderRadius: borderRadius.default,
    gap: spacing[4],
  },
  helpIcon: {
    fontSize: 24,
  },
  helpContent: {
    flex: 1,
  },
  helpTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: typography.sizes['title-sm'],
    fontWeight: typography.weights.bold,
    color: colors['on-surface'],
    marginBottom: spacing[1],
  },
  helpSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes['body-sm'],
    color: colors['on-surface-variant'],
  },
  helpButton: {
    backgroundColor: colors['surface-container-highest'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.default,
  },
  helpButtonText: {
    fontFamily: typography.fonts.headline,
    fontSize: typography.sizes['body-sm'],
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
});