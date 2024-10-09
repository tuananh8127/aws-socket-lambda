/*!
  * Version v1.0
  * Author: T Jay
*/

import AWS from 'aws-sdk';
import pako from 'pako';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDbDefault = new AWS.DynamoDB(); // Sử dụng DynamoDB gốc thay vì DocumentClient

let apiGatewayManagementApi;
const tableName  = process.env.TABLE_NAME;
const apiVersion = process.env.API_VERSION;
const endpoint   = process.env.APIGW_ENDPOINT;

function initApiGatewayManagementApi() {
    apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion,
        endpoint: endpoint
    });
}

export const handler = async (event) => {
    const Data = event.Data;
    const socketChannel = event.socketChannel;
    initApiGatewayManagementApi();

    const getConnects = await dynamoDb.query({
        TableName: tableName,
        KeyConditionExpression: 'channel = :channel',// Dùng cho khóa chính
        ExpressionAttributeValues: {
            ':channel': socketChannel
        }
    }).promise();

    const Items = getConnects.Items;


    if (getConnects.Count > 0) {
        const postCalls = Items.map(async ({ connectionId, channel }) => {
            const _connectionId  = connectionId;
            const _channel       = channel;
            // let originalData = { ch_goal31_xml: '2672939,14924203,0,0.79,0.97,138698305,2.45,2.72,2…25,0.99,0.83,1,0,0,0,2,2,2,3537363,0.46,0.30,0.33' };
            let jsonString = JSON.stringify(Data);
            let compressedData = pako.deflate(jsonString);
            try {
                await apiGatewayManagementApi.postToConnection({
                    ConnectionId: _connectionId,
                    Data: JSON.stringify(compressedData)
                }).promise();
            } catch (e) {
                if (e.statusCode === 410) {
                    await dynamoDb.delete({
                        TableName: tableName,
                        Key: { connectionId: _connectionId, channel: _channel }
                    }).promise();
                } else {
                    console.error('Error posting message:', e);
                    throw e;
                }
            }
        });

        try {
            await Promise.all(postCalls);
        } catch (e) {
            console.error('Failed to send messages:', e);
            return { statusCode: 500, body: 'Failed to send messages.' };
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Connected successfully.',
            channel: socketChannel
        })
    };

};

