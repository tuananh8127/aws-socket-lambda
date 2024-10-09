/*!
  * Version v1.0
  * Author: T Jay
*/

import AWS from 'aws-sdk';
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDbDefault = new AWS.DynamoDB();
const tableName  = process.env.TABLE_NAME;

export const handler = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        // const results = await dynamoDbDefault.describeTable({ TableName: tableName }).promise(); // GET ATRIBUTE TABLE
        const result = await dynamoDb.scan({
            TableName: tableName,
            FilterExpression: 'connectionId = :connectionId', // USE Sort key
            ExpressionAttributeValues: {
                ':connectionId': connectionId
            }
        }).promise();

        const items = result.Items;

        if (items.length > 0) {
            const deletePromises = items.map(item => 
                dynamoDb.delete({
                    TableName: tableName,
                    Key: {
                        channel: item.channel,
                        connectionId: item.connectionId
                    }
                }).promise()
            );
            await Promise.all(deletePromises);
            console.log('Delete Disconnect success: '+connectionId);
        }
        return  {
            statusCode: 200,
            body: 'Delete Disconnect success: '+connectionId,
        };

    } catch (error) {
        console.error('Error writing data to DynamoDB:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Internal server error',
                error: error.message,
                connectionId: event.connectionId
            })
        };
    }
};


