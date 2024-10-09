/*!
  * Version v1.0
  * Author: T Jay
*/

import AWS from 'aws-sdk';
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDbDefault = new AWS.DynamoDB(); // USE DynamoDB DEFAULT

let apiGatewayManagementApi;
const endpoint      = process.env.APIGW_ENDPOINT;
const apiVersion    = process.env.API_VERSION;
const tableName     = process.env.TABLE_NAME;

export const handler = async (event) => {
    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
      } catch (error) {
        console.error("Invalid JSON in request body", error);
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "Invalid JSON in request body" }),
        };
   }

    const { action, channels } = requestBody;
    const connectionId = event.requestContext.connectionId;
    const existingChannelsData  = await dynamoDb.scan({
        TableName: tableName,
        FilterExpression: 'connectionId = :connectionId', // USE Sort key
        ExpressionAttributeValues: {
            ':connectionId': connectionId
        }
    }).promise();

    const deletePromises = existingChannelsData.Items.map((item) =>
        dynamoDb.delete({
            TableName: tableName,
            Key: {
                channel: item.channel,
                connectionId: item.connectionId
            }
          })
          .promise()
    );

     // 3. Wait for tasks to complete
     await Promise.all(deletePromises);
     console.log('=============deletePromises : SUCCESS');

     // 4.Create promises to add new channels
    const insertPromises = channels.map((newChannel) =>
        dynamoDb.put({
            TableName: tableName,
            Item: { connectionId, channel: newChannel },
          })
          .promise()
      );
  
      // 5. Wait for tasks to complete
    await Promise.all(insertPromises);
    console.log('=============insertPromises : SUCCESS');
};

