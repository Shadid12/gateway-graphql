'use strict';

const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { introspectSchema } = require('@graphql-tools/wrap');
const { stitchSchemas } = require('@graphql-tools/stitch');
const { fetch } = require('cross-fetch');
const { print } = require('graphql');
const serverless = require('serverless-http');
const bodyParser = require('body-parser')


function makeRemoteExecutor(url, token) {
    return async ({ document, variables }) => {
      const query = print(document);
      const fetchResult = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ query, variables }),
      });
      return fetchResult.json();
    }
}

async function makeGatewaySchema() {

    const reviewExecutor = await makeRemoteExecutor('https://graphql.fauna.com/graphql', 'fnAEQdRZVpACRMEEM1GKKYQxH2Qa4TzLKusTW2gN');
    const productExecutor = await makeRemoteExecutor('https://graphql.fauna.com/graphql', 'fnAEQdSdXiACRGmgJgAEgmF_ZfO7iobiXGVP2NzT');
    const inventoryExecutor = await makeRemoteExecutor('https://graphql.fauna.com/graphql', 'fnAEQdR0kYACRWKJJUUwWIYoZuD6cJDTvXI0_Y70');

    const spacexExecutor = await makeRemoteExecutor('https://api.spacex.land/graphql/')

    return stitchSchemas({
        subschemas: [
          {
            schema: await introspectSchema(reviewExecutor),
            executor: reviewExecutor,
          },
          {
            schema: await introspectSchema(productExecutor),
            executor: productExecutor
          },
          {
            schema: await introspectSchema(inventoryExecutor),
            executor: inventoryExecutor
          },
          {
            schema: await introspectSchema(spacexExecutor),
            executor: spacexExecutor
          }
        ],
        
        typeDefs: 'type Query { heartbeat: String! }',
        resolvers: {
          Query: {
            heartbeat: () => 'OK'
          }
        }
    });
}

const app = express();

app.use(bodyParser.json());
app.use(
  '/graphql',
  graphqlHTTP(async (req) => {
    const schema = await makeGatewaySchema();
    return {
      schema,
      context: { authHeader: req.headers.authorization },
      graphiql: true,
    }
  }),
);

app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');


module.exports.handler = serverless(app);