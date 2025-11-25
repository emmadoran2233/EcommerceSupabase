// config-overrides.js (ESM)
import rewired from 'react-app-rewired';
const { injectBabelPlugin } = rewired;

const rootImportConfig = ['root-import', {
  rootPathPrefix: '~',
  rootPathSuffix: 'src',
}];

export default (config) => injectBabelPlugin(rootImportConfig, config);
