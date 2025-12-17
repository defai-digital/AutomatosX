---
abilityId: accessibility
displayName: Web Accessibility
category: frontend
tags: [a11y, accessibility, wcag]
priority: 80
---

# Web Accessibility (a11y)

## WCAG Principles (POUR)

### Perceivable
Content must be presentable to users in ways they can perceive.

### Operable
User interface components must be operable.

### Understandable
Information and UI operation must be understandable.

### Robust
Content must be robust enough for various technologies.

## Semantic HTML

```html
<!-- BAD - divs everywhere -->
<div class="header">
  <div class="nav">
    <div class="nav-item">Home</div>
  </div>
</div>

<!-- GOOD - semantic elements -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>

<!-- Landmark roles -->
<main role="main">
  <article>
    <h1>Article Title</h1>
    <section aria-labelledby="section-heading">
      <h2 id="section-heading">Section</h2>
    </section>
  </article>
</main>

<aside role="complementary">
  Sidebar content
</aside>

<footer role="contentinfo">
  Footer content
</footer>
```

## Keyboard Navigation

```jsx
// Focusable elements
<button onClick={handleClick}>Click me</button>

// Custom focusable element
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Custom button
</div>

// Skip link
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

// Focus management
function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef();

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  return isOpen ? (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      {children}
    </div>
  ) : null;
}
```

## ARIA Attributes

```html
<!-- Labels -->
<input aria-label="Search" type="search" />
<input aria-labelledby="label-id" />

<!-- Descriptions -->
<input aria-describedby="hint-id" />
<span id="hint-id">Password must be 8+ characters</span>

<!-- State -->
<button aria-pressed="true">Toggle</button>
<div aria-expanded="false">Accordion</div>
<input aria-invalid="true" />
<div aria-busy="true">Loading...</div>

<!-- Live regions -->
<div aria-live="polite">Status updates</div>
<div aria-live="assertive">Error messages</div>
<div role="alert">Critical alert</div>
<div role="status">Status message</div>

<!-- Hidden content -->
<span aria-hidden="true">Decorative icon</span>
<div hidden>Completely hidden</div>
```

## Forms

```html
<form>
  <!-- Label association -->
  <label for="email">Email</label>
  <input id="email" type="email" required aria-required="true" />

  <!-- Error handling -->
  <input
    id="password"
    type="password"
    aria-invalid="true"
    aria-describedby="password-error"
  />
  <span id="password-error" role="alert">
    Password is required
  </span>

  <!-- Fieldset for groups -->
  <fieldset>
    <legend>Shipping Address</legend>
    <label for="street">Street</label>
    <input id="street" />
  </fieldset>

  <!-- Autocomplete -->
  <input autocomplete="email" />
  <input autocomplete="current-password" />
  <input autocomplete="street-address" />
</form>
```

## Images and Media

```html
<!-- Informative image -->
<img src="chart.png" alt="Sales increased 25% in Q4 2024" />

<!-- Decorative image -->
<img src="decoration.png" alt="" role="presentation" />

<!-- Complex image -->
<figure>
  <img src="diagram.png" alt="System architecture" aria-describedby="diagram-desc" />
  <figcaption id="diagram-desc">
    Detailed description of the diagram...
  </figcaption>
</figure>

<!-- Video -->
<video controls>
  <source src="video.mp4" type="video/mp4" />
  <track kind="captions" src="captions.vtt" srclang="en" label="English" />
  <track kind="descriptions" src="descriptions.vtt" srclang="en" />
</video>
```

## Color and Contrast

```css
/* Minimum contrast ratios (WCAG AA) */
/* Normal text: 4.5:1 */
/* Large text (18pt+): 3:1 */
/* UI components: 3:1 */

/* Don't rely on color alone */
.error {
  color: #d32f2f;
  border-left: 4px solid #d32f2f; /* Visual indicator */
}

.error::before {
  content: "⚠ "; /* Icon indicator */
}

/* Focus indicators */
:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Prefer system preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #1a1a1a;
    --text: #ffffff;
  }
}
```

## Testing Tools

### Automated Testing
```javascript
// jest-axe
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('page has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Testing Checklist
- [ ] Navigate with keyboard only
- [ ] Test with screen reader (VoiceOver, NVDA)
- [ ] Zoom to 200% - is content still usable?
- [ ] Check color contrast
- [ ] Disable CSS - is content logical?
- [ ] Check focus order

### Browser Tools
- Chrome DevTools Accessibility panel
- Firefox Accessibility Inspector
- axe DevTools extension
- WAVE extension

## Common Issues

| Issue | Fix |
|-------|-----|
| Missing alt text | Add descriptive alt or empty alt for decorative |
| Missing form labels | Use `<label>` with `for` attribute |
| Low contrast | Ensure 4.5:1 for text, 3:1 for UI |
| Missing focus styles | Add visible `:focus` styles |
| Keyboard traps | Ensure focus can escape modals |
| Auto-playing media | Provide pause controls |
| Missing skip links | Add "skip to content" link |
