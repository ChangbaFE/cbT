export default {
  testEnvironment: 'node',
  transform: {
    '\\.[jt]sx?$': 'babel-jest'
  },
  collectCoverageFrom: [
    'index.js',
    'lib/**/*.js',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  testMatch: [
    '<rootDir>/test/**/*.test.js'
  ],
  verbose: true
};
