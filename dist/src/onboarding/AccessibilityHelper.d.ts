/**
 * Accessibility Helper
 * Sprint 6 Day 57: Accessibility features for inclusive CLI/TUI experience
 */
/**
 * ARIA role types
 */
export declare enum AriaRole {
    NAVIGATION = "navigation",
    MAIN = "main",
    COMPLEMENTARY = "complementary",
    REGION = "region",
    SEARCH = "search",
    FORM = "form",
    BUTTON = "button",
    TEXTBOX = "textbox",
    LIST = "list",
    LISTITEM = "listitem",
    MENUBAR = "menubar",
    MENU = "menu",
    MENUITEM = "menuitem",
    ALERT = "alert",
    STATUS = "status",
    PROGRESSBAR = "progressbar",
    TABLE = "table"
}
/**
 * Keyboard shortcut
 */
export interface KeyboardShortcut {
    keys: string[];
    description: string;
    action?: string;
    global?: boolean;
}
/**
 * Screen reader announcement
 */
export interface ScreenReaderAnnouncement {
    message: string;
    priority: 'polite' | 'assertive';
    clear?: boolean;
}
/**
 * Accessibility metadata
 */
export interface AccessibilityMetadata {
    role: AriaRole;
    label: string;
    description?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    hidden?: boolean;
}
/**
 * Accessibility Helper
 */
export declare class AccessibilityHelper {
    private static shortcuts;
    private static announcements;
    /**
     * Register keyboard shortcut
     */
    static registerShortcut(id: string, shortcut: KeyboardShortcut): void;
    /**
     * Get keyboard shortcut
     */
    static getShortcut(id: string): KeyboardShortcut | undefined;
    /**
     * Get all keyboard shortcuts
     */
    static getAllShortcuts(): Map<string, KeyboardShortcut>;
    /**
     * Get global shortcuts
     */
    static getGlobalShortcuts(): KeyboardShortcut[];
    /**
     * Format keyboard shortcuts for display
     */
    static formatShortcuts(): string;
    /**
     * Announce message to screen reader
     */
    static announce(message: string, priority?: 'polite' | 'assertive', clear?: boolean): void;
    /**
     * Get pending announcements
     */
    static getAnnouncements(): ScreenReaderAnnouncement[];
    /**
     * Clear announcements
     */
    static clearAnnouncements(): void;
    /**
     * Create ARIA label
     */
    static createAriaLabel(metadata: AccessibilityMetadata): string;
    /**
     * Format for screen reader
     */
    static formatForScreenReader(text: string, metadata?: AccessibilityMetadata): string;
    /**
     * Generate navigation hints
     */
    static generateNavigationHints(context: 'search' | 'results' | 'menu' | 'form'): string;
    /**
     * Check if high contrast mode should be used
     */
    static shouldUseHighContrast(): boolean;
    /**
     * Check if reduced motion should be used
     */
    static shouldUseReducedMotion(): boolean;
    /**
     * Get text size preference
     */
    static getTextSizePreference(): 'small' | 'medium' | 'large';
    /**
     * Format progress for screen reader
     */
    static formatProgress(current: number, total: number, operation: string): string;
    /**
     * Format error for screen reader
     */
    static formatError(code: string, message: string, remediation?: string[]): string;
    /**
     * Format list for screen reader
     */
    static formatList(items: string[], listType?: 'ordered' | 'unordered'): string;
    /**
     * Format table for screen reader
     */
    static formatTable(headers: string[], rows: string[][]): string;
    /**
     * Create accessible command help
     */
    static createAccessibleHelp(command: string, description: string, options: Record<string, string>): string;
    /**
     * Get focus indicator style
     */
    static getFocusIndicatorStyle(): string;
    /**
     * Get animation duration
     */
    static getAnimationDuration(): number;
}
//# sourceMappingURL=AccessibilityHelper.d.ts.map