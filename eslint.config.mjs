// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            '.next/**',
            'node_modules/**',
            'legacy/**',
            'next-env.d.ts',
            'tsconfig.tsbuildinfo',
        ],
    },
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx,js,jsx,mjs}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                AbortController: 'readonly',
                AbortSignal: 'readonly',
                fetch: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                AudioContext: 'readonly',
                localStorage: 'readonly',
                HTMLDivElement: 'readonly',
                HTMLInputElement: 'readonly',
                Event: 'readonly',
                KeyboardEvent: 'readonly',
                MouseEvent: 'readonly',
                HTMLElement: 'readonly',
                Node: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'no-undef': 'off',
        },
    },
);
