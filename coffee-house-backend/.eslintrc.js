module.exports = {
  env: {
    node: true,
    jest: true,
    es2021: true,
  },
  extends: ['airbnb-base', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'consistent-return': 'off',
    'no-underscore-dangle': ['error', { allow: ['_id'] }],
    'class-methods-use-this': 'off',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
};