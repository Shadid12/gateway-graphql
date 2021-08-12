'use strict';

const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { introspectSchema } = require('@graphql-tools/wrap');
const { stitchSchemas } = require('@graphql-tools/stitch');
const { fetch } = require('cross-fetch');
const { print } = require('graphql');
const serverless = require('serverless-http');

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

    const userExecutor = await makeRemoteExecutor('https://graphql.fauna.com/graphql', 'fnAEQZPUejACQ2xuvfi50APAJ397hlGrTjhdXVta');
    const productExecutor = await makeRemoteExecutor('https://graphql.fauna.com/graphql', 'fnAEQbI02HACQwTaUF9iOBbGC3fatQtclCOxZNfp');
    
    return stitchSchemas({
        subschemas: [
          {
            schema: await introspectSchema(productExecutor),
            executor: productExecutor,
          },
          {
            schema: await introspectSchema(userExecutor),
            executor: userExecutor
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

serverless(app);

app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');