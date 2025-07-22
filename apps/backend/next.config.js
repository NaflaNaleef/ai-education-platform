/** @type {import('next').NextConfig} */
const nextConfig = {
    // experimental options can go here if needed
};

const path = require('path');

module.exports = {
    webpack: (config) => {
        config.resolve.alias['@'] = path.resolve(__dirname, 'app');
        config.resolve.alias['@lib'] = path.resolve(__dirname, 'lib');
        return config;
    },
}; 