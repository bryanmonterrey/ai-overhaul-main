/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: [
        '@solana/wallet-adapter-base',
        '@solana/wallet-adapter-react',
        '@solana/wallet-adapter-react-ui',
        '@solana/wallet-adapter-wallets',
        '@cks-systems',
        'solana-agent-kit'
    ],
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve = {
                ...config.resolve,
                fallback: {
                    ...config.resolve?.fallback,
                    fs: false,
                    net: false,
                    tls: false,
                    crypto: false,
                    stream: false,
                    buffer: false
                }
            }
        }
  
        config.resolve.alias = {
            ...config.resolve.alias,
            'twitter-api-v2': isServer 
                ? 'twitter-api-v2/dist/esm/index.js'
                : 'twitter-api-v2/dist/esm/index.browser.js'
        }
  
        config.module.rules.push({
            test: /\.m?js$/,
            resolve: {
                fullySpecified: false,
            }
        });
  
        // Add TypeScript enum support for @cks-systems and solana-agent-kit
        config.module.rules.push({
            test: /\.ts$/,
            include: [
                /node_modules\/@cks-systems/,
                /node_modules\/solana-agent-kit/
            ],
            use: [
                {
                    loader: 'next/dist/build/webpack/loaders/next-swc-loader.js',
                    options: {
                        isServer,
                        jsc: {
                            parser: {
                                syntax: 'typescript',
                                tsx: true
                            }
                        }
                    }
                }
            ]
        });
  
        return config
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb'
        },
    },
    serverExternalPackages: ['twitter-api-v2'],
    typescript: {
        ignoreBuildErrors: true
    },
    eslint: {
        ignoreDuringBuilds: true
    },
    headers() {
        return [
            {
                source: '/api/twitter/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'no-store, must-revalidate' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
                ]
            }
        ]
    },
    async rewrites() {
        if (process.env.NODE_ENV === 'development') {
          return [
            {
              source: '/api/memory/:path*',
              destination: 'http://localhost:3001/:path*'
            }
          ];
        } else {
          if (!process.env.NEXT_PUBLIC_PYTHON_API_URL) {
            console.warn('NEXT_PUBLIC_PYTHON_API_URL not set in production!');
          }
          return [
            {
              source: '/api/memory/:path*',
              destination: `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/:path*`
            }
          ];
        }
    }
  }
  
  export default nextConfig