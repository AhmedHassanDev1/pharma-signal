/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@pharma-signal/contracts',
    '@pharma-signal/validation',
    '@pharma-signal/config'
  ]
};

export default nextConfig;
