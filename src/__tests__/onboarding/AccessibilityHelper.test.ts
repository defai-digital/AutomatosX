/**
 * Accessibility Helper Tests
 * Sprint 6 Day 57: Accessibility features tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AccessibilityHelper, AriaRole } from '../../onboarding/AccessibilityHelper.js'

describe('AccessibilityHelper', () => {
  beforeEach(() => {
    AccessibilityHelper.clearAnnouncements()
  })

  describe('Keyboard Shortcuts', () => {
    it('should have default shortcuts registered', () => {
      const shortcuts = AccessibilityHelper.getAllShortcuts()

      expect(shortcuts.size).toBeGreaterThan(0)
    })

    it('should get shortcut by ID', () => {
      const helpShortcut = AccessibilityHelper.getShortcut('help')

      expect(helpShortcut).toBeDefined()
      expect(helpShortcut?.description).toContain('help')
    })

    it('should have global shortcuts', () => {
      const globalShortcuts = AccessibilityHelper.getGlobalShortcuts()

      expect(globalShortcuts.length).toBeGreaterThan(0)
      expect(globalShortcuts.every((s) => s.global)).toBe(true)
    })

    it('should register custom shortcut', () => {
      AccessibilityHelper.registerShortcut('custom', {
        keys: ['c'],
        description: 'Custom action',
      })

      const shortcut = AccessibilityHelper.getShortcut('custom')

      expect(shortcut).toBeDefined()
      expect(shortcut?.keys).toContain('c')
    })

    it('should format shortcuts for display', () => {
      const formatted = AccessibilityHelper.formatShortcuts()

      expect(formatted).toContain('Keyboard Shortcuts')
      expect(formatted).toContain('Global:')
    })
  })

  describe('Screen Reader Announcements', () => {
    it('should announce message', () => {
      AccessibilityHelper.announce('Test message')

      const announcements = AccessibilityHelper.getAnnouncements()

      expect(announcements.length).toBe(1)
      expect(announcements[0].message).toBe('Test message')
      expect(announcements[0].priority).toBe('polite')
    })

    it('should announce with assertive priority', () => {
      AccessibilityHelper.announce('Critical message', 'assertive')

      const announcements = AccessibilityHelper.getAnnouncements()

      expect(announcements[0].priority).toBe('assertive')
    })

    it('should clear previous announcements when requested', () => {
      AccessibilityHelper.announce('Message 1')
      AccessibilityHelper.announce('Message 2', 'polite', true) // Clear previous

      const announcements = AccessibilityHelper.getAnnouncements()

      expect(announcements.length).toBe(1)
      expect(announcements[0].message).toBe('Message 2')
    })

    it('should clear all announcements', () => {
      AccessibilityHelper.announce('Message 1')
      AccessibilityHelper.announce('Message 2')

      AccessibilityHelper.clearAnnouncements()

      const announcements = AccessibilityHelper.getAnnouncements()

      expect(announcements.length).toBe(0)
    })
  })

  describe('ARIA Labels', () => {
    it('should create basic ARIA label', () => {
      const label = AccessibilityHelper.createAriaLabel({
        role: AriaRole.BUTTON,
        label: 'Submit',
      })

      expect(label).toContain('button')
      expect(label).toContain('Submit')
    })

    it('should include description', () => {
      const label = AccessibilityHelper.createAriaLabel({
        role: AriaRole.TEXTBOX,
        label: 'Search',
        description: 'Enter search terms',
      })

      expect(label).toContain('Search')
      expect(label).toContain('Enter search terms')
    })

    it('should include state attributes', () => {
      const label = AccessibilityHelper.createAriaLabel({
        role: AriaRole.TEXTBOX,
        label: 'Email',
        required: true,
        disabled: false,
      })

      expect(label).toContain('required')
      expect(label).not.toContain('disabled')
    })

    it('should include hint', () => {
      const label = AccessibilityHelper.createAriaLabel({
        role: AriaRole.FORM,
        label: 'Login',
        hint: 'Press Enter to submit',
      })

      expect(label).toContain('Hint: Press Enter to submit')
    })
  })

  describe('Screen Reader Formatting', () => {
    it('should format text without metadata', () => {
      const formatted = AccessibilityHelper.formatForScreenReader('Hello world')

      expect(formatted).toBe('Hello world')
    })

    it('should format text with metadata', () => {
      const formatted = AccessibilityHelper.formatForScreenReader('Click here', {
        role: AriaRole.BUTTON,
        label: 'Submit',
        description: 'Submit form',
      })

      expect(formatted).toContain('button')
      expect(formatted).toContain('Submit')
      expect(formatted).toContain('Click here')
    })
  })

  describe('Navigation Hints', () => {
    it('should generate search context hints', () => {
      const hints = AccessibilityHelper.generateNavigationHints('search')

      expect(hints).toContain('search')
      expect(hints).toContain('filter')
    })

    it('should generate results context hints', () => {
      const hints = AccessibilityHelper.generateNavigationHints('results')

      expect(hints).toContain('navigate')
      expect(hints).toContain('arrow keys')
    })

    it('should generate menu context hints', () => {
      const hints = AccessibilityHelper.generateNavigationHints('menu')

      expect(hints).toContain('arrow keys')
      expect(hints).toContain('select')
    })

    it('should generate form context hints', () => {
      const hints = AccessibilityHelper.generateNavigationHints('form')

      expect(hints).toContain('Tab')
      expect(hints).toContain('submit')
    })

    it('should include help shortcut hint', () => {
      const hints = AccessibilityHelper.generateNavigationHints('search')

      expect(hints).toContain('h or ?')
    })
  })

  describe('Accessibility Preferences', () => {
    let originalHighContrast: string | undefined
    let originalReducedMotion: string | undefined
    let originalTextSize: string | undefined

    beforeEach(() => {
      originalHighContrast = process.env.AUTOMATOSX_HIGH_CONTRAST
      originalReducedMotion = process.env.AUTOMATOSX_REDUCED_MOTION
      originalTextSize = process.env.AUTOMATOSX_TEXT_SIZE
    })

    afterEach(() => {
      process.env.AUTOMATOSX_HIGH_CONTRAST = originalHighContrast
      process.env.AUTOMATOSX_REDUCED_MOTION = originalReducedMotion
      process.env.AUTOMATOSX_TEXT_SIZE = originalTextSize
    })

    it('should check high contrast mode', () => {
      process.env.AUTOMATOSX_HIGH_CONTRAST = 'true'

      expect(AccessibilityHelper.shouldUseHighContrast()).toBe(true)
    })

    it('should default to normal contrast', () => {
      delete process.env.AUTOMATOSX_HIGH_CONTRAST

      expect(AccessibilityHelper.shouldUseHighContrast()).toBe(false)
    })

    it('should check reduced motion', () => {
      process.env.AUTOMATOSX_REDUCED_MOTION = 'true'

      expect(AccessibilityHelper.shouldUseReducedMotion()).toBe(true)
    })

    it('should default to normal motion', () => {
      delete process.env.AUTOMATOSX_REDUCED_MOTION

      expect(AccessibilityHelper.shouldUseReducedMotion()).toBe(false)
    })

    it('should get text size preference', () => {
      process.env.AUTOMATOSX_TEXT_SIZE = 'large'

      expect(AccessibilityHelper.getTextSizePreference()).toBe('large')
    })

    it('should default to medium text size', () => {
      delete process.env.AUTOMATOSX_TEXT_SIZE

      expect(AccessibilityHelper.getTextSizePreference()).toBe('medium')
    })
  })

  describe('Progress Formatting', () => {
    it('should format progress for screen reader', () => {
      const formatted = AccessibilityHelper.formatProgress(50, 100, 'Indexing files')

      expect(formatted).toContain('50%')
      expect(formatted).toContain('Indexing files')
      expect(formatted).toContain('50 of 100')
    })

    it('should calculate percentage', () => {
      const formatted = AccessibilityHelper.formatProgress(25, 100, 'Processing')

      expect(formatted).toContain('25%')
    })
  })

  describe('Error Formatting', () => {
    it('should format error without remediation', () => {
      const formatted = AccessibilityHelper.formatError('DB-001', 'Database connection failed')

      expect(formatted).toContain('Error DB-001')
      expect(formatted).toContain('Database connection failed')
    })

    it('should format error with remediation', () => {
      const formatted = AccessibilityHelper.formatError('FS-001', 'File not found', [
        'Check file path',
        'Verify file exists',
      ])

      expect(formatted).toContain('Error FS-001')
      expect(formatted).toContain('To fix this')
      expect(formatted).toContain('1. Check file path')
      expect(formatted).toContain('2. Verify file exists')
    })
  })

  describe('List Formatting', () => {
    it('should format unordered list', () => {
      const formatted = AccessibilityHelper.formatList(['Item 1', 'Item 2', 'Item 3'])

      expect(formatted).toContain('unordered list')
      expect(formatted).toContain('3 items')
      expect(formatted).toContain('• Item 1')
    })

    it('should format ordered list', () => {
      const formatted = AccessibilityHelper.formatList(['First', 'Second', 'Third'], 'ordered')

      expect(formatted).toContain('ordered list')
      expect(formatted).toContain('1. First')
      expect(formatted).toContain('2. Second')
    })
  })

  describe('Table Formatting', () => {
    it('should format table for screen reader', () => {
      const headers = ['Name', 'Age', 'City']
      const rows = [
        ['Alice', '30', 'SF'],
        ['Bob', '25', 'NYC'],
      ]

      const formatted = AccessibilityHelper.formatTable(headers, rows)

      expect(formatted).toContain('Table with 3 columns and 2 rows')
      expect(formatted).toContain('Column headers: Name, Age, City')
      expect(formatted).toContain('Row 1: Name: Alice, Age: 30, City: SF')
    })
  })

  describe('Accessible Help', () => {
    it('should create accessible command help', () => {
      const help = AccessibilityHelper.createAccessibleHelp(
        'ax find',
        'Search for code',
        {
          '--lang': 'Filter by language',
          '--kind': 'Filter by symbol kind',
        }
      )

      expect(help).toContain('Command: ax find')
      expect(help).toContain('Search for code')
      expect(help).toContain('Options:')
      expect(help).toContain('--lang: Filter by language')
    })

    it('should handle commands without options', () => {
      const help = AccessibilityHelper.createAccessibleHelp('ax status', 'Show index status', {})

      expect(help).toContain('Command: ax status')
      expect(help).not.toContain('Options:')
    })
  })

  describe('Focus Indicator', () => {
    let originalHighContrast: string | undefined

    beforeEach(() => {
      originalHighContrast = process.env.AUTOMATOSX_HIGH_CONTRAST
    })

    afterEach(() => {
      process.env.AUTOMATOSX_HIGH_CONTRAST = originalHighContrast
    })

    it('should use bold outline for high contrast', () => {
      process.env.AUTOMATOSX_HIGH_CONTRAST = 'true'

      const style = AccessibilityHelper.getFocusIndicatorStyle()

      expect(style).toBe('bold-outline')
    })

    it('should use subtle outline for normal contrast', () => {
      delete process.env.AUTOMATOSX_HIGH_CONTRAST

      const style = AccessibilityHelper.getFocusIndicatorStyle()

      expect(style).toBe('subtle-outline')
    })
  })

  describe('Animation Duration', () => {
    let originalReducedMotion: string | undefined

    beforeEach(() => {
      originalReducedMotion = process.env.AUTOMATOSX_REDUCED_MOTION
    })

    afterEach(() => {
      process.env.AUTOMATOSX_REDUCED_MOTION = originalReducedMotion
    })

    it('should disable animations for reduced motion', () => {
      process.env.AUTOMATOSX_REDUCED_MOTION = 'true'

      const duration = AccessibilityHelper.getAnimationDuration()

      expect(duration).toBe(0)
    })

    it('should use default duration for normal motion', () => {
      delete process.env.AUTOMATOSX_REDUCED_MOTION

      const duration = AccessibilityHelper.getAnimationDuration()

      expect(duration).toBe(300)
    })
  })
})
