import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			ia: [
  				'geist',
  				'monospace'
  			],
			sportesia: ['sportesia', 'monospace'],
  			verminy: ['vermin1', 'monospace'],
  			verminyv: ['verminV', 'monospace'],
			goatse: ['goatse', 'monospace'],
			courier: ['courier', 'monospace'],
			inter: ['inter', 'monospace'],
			english: ['english', 'monospace'],
			bookish: ['bookish', 'monospace'],
			lumen: ['lumen', 'monospace'],
			inria: ['inria', 'monospace'],
			geist: ['geist', 'monospace'],
  		},
  		colors: {
			darkish: '#11111A',
			greenish: '#00FFA2',
			purp: '#1D1D2C',
			azul: '#0071e3',
			navyy: '#0D0E15',
  			background: 'var(--background)',
  			foreground: 'var(--foreground)'
  		},
		  screens: {
			'md750': '750px',  // Add this custom breakpoint
		  },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;