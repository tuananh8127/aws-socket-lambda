/*!
  * Version v1.0
  * Author: T Jay
*/

import AWS from 'aws-sdk';
import pako from 'pako';
import zlib from 'zlib';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDbDefault = new AWS.DynamoDB();

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
    initApiGatewayManagementApi();
    const base64Data = event.Data;
    const compressedData = Buffer.from(base64Data, 'base64');
    const decompressedData = zlib.gunzipSync(compressedData).toString();
    const Data = JSON.parse(decompressedData);
    const promises = Object.keys(Data).map(async (key_channel) => {
        const dev_key_channel      =  key_channel;
        const replace_key_channel  =  key_channel.replace('dev_', '');
        try {
            const getConnects = await dynamoDb.query({
                TableName: tableName,
                KeyConditionExpression: 'channel = :channel',
                ExpressionAttributeValues: {
                    ':channel': dev_key_channel
                }
            }).promise();
            const Items = getConnects.Items;
            if (getConnects.Count > 0) {
                const originalData = {
                    [replace_key_channel]: Data[dev_key_channel]
                };
                const postCalls = Items.map(async ({ connectionId, channel }) => {
                    const _connectionId  = connectionId;
                    const _channel       = channel;
                    let jsonString = JSON.stringify(originalData);
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

        } catch (error) {
            console.error('Error while querying DynamoDB:', error);
        }
    });

    // Chờ tất cả các promise hoàn thành
    await Promise.all(promises);
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Connected successfully.',
            channel: ''
        })
    };

};

