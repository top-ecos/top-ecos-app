import type { Config } from "tailwindcss";

export default {
        // Light theme only - dark mode disabled
        content: [
                "./pages/**/*.{ts,tsx}",
                "./components/**/*.{ts,tsx}",
                "./app/**/*.{ts,tsx}",
                "./src/**/*.{ts,tsx}",
        ],
        prefix: "",
        theme: {
                container: {
                        center: true,
                        padding: '2rem',
                        screens: {
                                '2xl': '1400px'
                        }
                },
                extend: {
                        colors: {
                                // White Light Theme - Strategic Color Palette
                                'surface': 'var(--surface)', // #FFFFFF
                                'surface-alt': 'var(--surface-alt)', // #F7FAFC
                                'text': 'var(--text)', // #2C3E50
                                'subtext': 'var(--subtext)', // #7F8C8D
                                'accent': {
                                        DEFAULT: 'var(--accent)', // #48CFAD
                                        hover: 'var(--accent-hover)', // ~10% darker
                                        active: 'var(--accent-active)', // ~15% darker
                                },
                                'secondary': 'var(--secondary)', // #9B59B6
                                'danger': 'var(--danger)', // #E74C3C
                                'ring': 'var(--ring)', // Focus ring color
                                
                                // Legacy compatibility mappings
                                'fg': {
                                        900: 'var(--text)', 
                                        700: 'var(--text)', 
                                        600: 'var(--subtext)', 
                                        400: 'var(--subtext)',
                                },
                                'bg': {
                                        DEFAULT: 'var(--surface)', 
                                        subtle: 'var(--surface-alt)', 
                                },
                                'card-bg': 'var(--surface)',
                                
                                // shadcn/ui component mappings
                                border: 'hsl(var(--border-hsl))',
                                input: 'hsl(var(--input))',
                                background: 'hsl(var(--background))',
                                foreground: 'hsl(var(--foreground))',
                                primary: {
                                        DEFAULT: 'hsl(var(--primary))',
                                        foreground: 'hsl(var(--primary-foreground))'
                                },
                                destructive: {
                                        DEFAULT: 'hsl(var(--destructive))',
                                        foreground: 'hsl(var(--destructive-foreground))'
                                },
                                success: {
                                        DEFAULT: 'hsl(var(--success))',
                                        foreground: 'hsl(var(--success-foreground))'
                                },
                                muted: {
                                        DEFAULT: 'hsl(var(--muted))',
                                        foreground: 'hsl(var(--muted-foreground))'
                                },
                                popover: {
                                        DEFAULT: 'hsl(var(--popover))',
                                        foreground: 'hsl(var(--popover-foreground))'
                                },
                                card: {
                                        DEFAULT: 'hsl(var(--card-bg))',
                                        foreground: 'hsl(var(--card-foreground))'
                                },
                                sidebar: {
                                        DEFAULT: 'hsl(var(--sidebar-background))',
                                        foreground: 'hsl(var(--sidebar-foreground))',
                                        primary: 'hsl(var(--sidebar-primary))',
                                        'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
                                        accent: 'hsl(var(--sidebar-accent))',
                                        'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
                                        border: 'hsl(var(--sidebar-border))',
                                        ring: 'hsl(var(--sidebar-ring))'
                                }
                        },
                        borderRadius: {
                                DEFAULT: 'var(--radius)', // 12px
                                lg: 'var(--radius-lg)', // 16px  
                                pill: 'var(--radius-pill)', // 999px for prominent CTAs
                                md: 'calc(var(--radius) - 2px)', // 10px
                                sm: 'calc(var(--radius) - 4px)', // 8px
                                // Legacy compatibility
                                premium: 'var(--radius)',
                        },
                        boxShadow: {
                                'sm': 'var(--shadow-1)', // Soft, subtle shadow
                                'md': 'var(--shadow-2)', // Medium shadow for cards
                                // Legacy compatibility
                                'premium': 'var(--shadow-1)',
                        },
                        spacing: {
                                '18': '4.5rem',
                                '22': '5.5rem',
                        },
                        fontFamily: {
                                'sans': ['Reddit Sans', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
                        },
                        keyframes: {
                                'accordion-down': {
                                        from: {
                                                height: '0'
                                        },
                                        to: {
                                                height: 'var(--radix-accordion-content-height)'
                                        }
                                },
                                'accordion-up': {
                                        from: {
                                                height: 'var(--radix-accordion-content-height)'
                                        },
                                        to: {
                                                height: '0'
                                        }
                                },
                                'fade-in-slide-up': {
                                        from: {
                                                opacity: '0',
                                                transform: 'translateY(1rem)'
                                        },
                                        to: {
                                                opacity: '1',
                                                transform: 'translateY(0)'
                                        }
                                }
                        },
                        animation: {
                                'accordion-down': 'accordion-down 0.2s ease-out',
                                'accordion-up': 'accordion-up 0.2s ease-out',
                                'fade-in-slide-up': 'fade-in-slide-up 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
                        }
                }
        },
        plugins: [require("tailwindcss-animate")],
} satisfies Config;
