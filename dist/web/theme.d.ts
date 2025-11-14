/**
 * Material-UI Theme Configuration
 * Defines light and dark themes for the application
 */
declare module '@mui/material/styles' {
    interface TypographyVariants {
        code: React.CSSProperties;
    }
    interface TypographyVariantsOptions {
        code?: React.CSSProperties;
    }
}
declare module '@mui/material/Typography' {
    interface TypographyPropsVariantOverrides {
        code: true;
    }
}
export declare const lightTheme: import("@mui/material").Theme;
export declare const darkTheme: import("@mui/material").Theme;
export declare const getTheme: (mode: "light" | "dark") => import("@mui/material").Theme;
//# sourceMappingURL=theme.d.ts.map