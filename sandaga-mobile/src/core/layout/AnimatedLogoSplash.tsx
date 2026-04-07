import { useEffect, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { colors, shadows, spacing, typography } from '@/core/theme/tokens'

export function AnimatedLogoSplash({ children }: PropsWithChildren) {
  const [isVisible, setIsVisible] = useState(true)

  const pulse = useRef(new Animated.Value(1)).current
  const glow = useRef(new Animated.Value(0.2)).current
  const fade = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    )

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.38,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(glow, {
          toValue: 0.2,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    )

    pulseLoop.start()
    glowLoop.start()

    return () => {
      pulseLoop.stop()
      glowLoop.stop()
    }
  }, [glow, pulse])

  useEffect(() => {
    if (!isVisible) {
      return
    }

    const timeout = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start(() => setIsVisible(false))
    }, 1200)

    return () => clearTimeout(timeout)
  }, [fade, isVisible])

  return (
    <View style={styles.root}>
      {children}

      {isVisible ? (
        <Animated.View style={[styles.overlay, { opacity: fade }]}>
          <View style={styles.logoStack}>
            <Animated.View
              style={[
                styles.logoHalo,
                {
                  opacity: glow,
                  transform: [{ scale: pulse }]
                }
              ]}
            />
            <Animated.View
              style={[
                styles.logoOrb,
                {
                  transform: [{ scale: pulse }]
                }
              ]}
            >
              <Text style={styles.logoLetter}>L</Text>
            </Animated.View>
          </View>

          <Text style={styles.brand}>LEMAKET</Text>
          <Text style={styles.subtitle}>Marketplace Cameroun</Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md
  },
  logoStack: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoHalo: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.primarySoftStrong
  },
  logoOrb: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.elevated
  },
  logoLetter: {
    color: colors.white,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: typography.weightBlack
  },
  brand: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: typography.display,
    letterSpacing: 1,
    fontWeight: typography.weightBlack
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold
  }
})
