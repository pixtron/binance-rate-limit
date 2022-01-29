/* eslint-disable */
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts'
  ],
  coverageThreshold: {
    global: {
      'branches': 95,
      'functions': 95,
      'lines': 95,
      'statements': -4
    }
  }
};
