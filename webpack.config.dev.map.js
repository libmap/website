const path = require('path');
const { merge } = require('webpack-merge');
const baseConfig = require('./webpack.config.base.js');

module.exports = merge(baseConfig, {
  mode: 'development',
  devServer: {
    static: {
      directory: path.join(__dirname),
    },
    host: '0.0.0.0',
    historyApiFallback: {
      rewrites: [
        { from: /^\/map.*/, to: '/map.html' },
        { from: /.*/, to: '/index.html' },
      ],
    },
    allowedHosts: 'all',
    open: true,
    liveReload: true,
  },
  optimization: {
    runtimeChunk: 'single',
  },
  devtool: 'source-map',
});
