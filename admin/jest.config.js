// export default
module.exports={
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/setupTests.js"],
    transform: {
    // "^.+\\.(ts|tsx)$": "js-jest",
    "^.+\\.(js|jsx)$": "babel-jest",
  },
  roots: ['<rootDir>/src', '<rootDir>/src/__tests__'], 
  testMatch:[ "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)"],
  moduleNameMapper: {
       "^#/(.*)$": "<rootDir>/src/$1",
    "^~/(.*)$": "<rootDir>/src/$1",
    "\\.(css|scss|sass)$": "identity-obj-proxy"
  },
  // If your source uses ESM/TS, uncomment the next line:
  // extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
