/** @type {import('@rtk-query/codegen-openapi').ConfigFile} */
module.exports = {
  schemaFile: 'http://localhost:3001/api/docs-json',
  apiFile: './src/managers/baseApi.ts',
  apiImport: 'baseApi',
  outputFile: './src/managers/generated-api.ts',
  exportName: 'generatedApi',
  hooks: { queries: true, lazyQueries: true, mutations: true },
  tag: true,
};
