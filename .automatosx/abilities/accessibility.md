# Accessibility (A11y)

Build inclusive web applications following WCAG guidelines.

## Core Principles (WCAG)

1. **Perceivable** - Users must be able to perceive the information
2. **Operable** - Users must be able to operate the interface
3. **Understandable** - Users must understand the information and interface
4. **Robust** - Content must work with current and future technologies

## Essential Practices

### 1. Semantic HTML
- Use proper HTML elements (button, nav, header, main, footer, article)
- Avoid div/span for interactive elements
- Use headings (h1-h6) in logical order
- Use lists (ul, ol) for groups of items
- Use form elements with proper labels

### 2. ARIA Attributes
- Use aria-label for icons and buttons without text
- Use aria-describedby for additional context
- Use aria-live for dynamic content updates
- Use aria-expanded for collapsible sections
- Use aria-hidden="true" for decorative elements
- Don't over-use ARIA (semantic HTML is better)

### 3. Keyboard Navigation
- All interactive elements must be keyboard accessible (Tab, Enter, Space)
- Provide visible focus indicators (:focus-visible)
- Implement skip links for main content
- Use tabindex="0" to add elements to tab order
- Use tabindex="-1" to remove from tab order (programmatically focusable)
- Never use positive tabindex values

### 4. Color and Contrast
- Minimum contrast ratio 4.5:1 for normal text
- Minimum contrast ratio 3:1 for large text (18pt+)
- Don't rely on color alone to convey information
- Provide text alternatives for color-coded information
- Test with color blindness simulators

### 5. Forms
- Use <label> for every form input
- Provide clear error messages
- Use aria-invalid and aria-describedby for errors
- Group related inputs with fieldset/legend
- Mark required fields clearly (aria-required="true")
- Provide autocomplete attributes where appropriate

### 6. Images and Media
- Provide alt text for all images
- Use empty alt="" for decorative images
- Provide captions for videos
- Provide transcripts for audio content
- Don't use images of text (use real text)

### 7. Focus Management
- Manage focus for modals (trap focus, restore on close)
- Focus first interactive element when opening dialogs
- Provide focus indicators for all interactive elements
- Use :focus-visible to show focus only for keyboard users
- Announce route changes for screen readers

### 8. Screen Reader Support
- Use live regions (aria-live) for dynamic updates
- Provide meaningful page titles
- Use aria-label when visual label isn't enough
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Announce loading states and errors

## Common Patterns

### Modal Dialogs
- Trap focus within modal
- Close on Escape key
- Return focus to trigger element on close
- Use role="dialog" and aria-modal="true"
- Provide accessible close button

### Dropdown Menus
- Use aria-expanded to indicate state
- Navigate with arrow keys
- Close on Escape
- Close on click outside
- Focus first item when opened

### Form Validation
- Associate errors with fields (aria-describedby)
- Mark invalid fields (aria-invalid="true")
- Announce errors to screen readers
- Provide clear, specific error messages
- Don't rely on color alone

## Testing Tools

- axe DevTools (Chrome extension)
- Lighthouse accessibility audit
- WAVE (Web Accessibility Evaluation Tool)
- Keyboard navigation testing (Tab, Shift+Tab, Enter, Space, Esc, Arrow keys)
- Screen reader testing (VoiceOver on Mac, NVDA/JAWS on Windows)

## Quick Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Proper semantic HTML used
- [ ] All images have appropriate alt text
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Forms have proper labels and error handling
- [ ] Focus management for modals/dialogs
- [ ] ARIA attributes used correctly (when needed)
- [ ] Tested with keyboard navigation
- [ ] Tested with screen reader
- [ ] No accessibility errors in axe DevTools
