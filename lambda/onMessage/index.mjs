/*!
  * Version v1.0
  * Author: T Jay
  * console.log('=============connectionId : '+JSON.stringify(connectionId));
*/

import AWS from 'aws-sdk';
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDbDefault = new AWS.DynamoDB(); // Sử dụng DynamoDB gốc thay vì DocumentClient
let apiGatewayManagementApi;
const endpoint      = process.env.APIGW_ENDPOINT;
const apiVersion    = process.env.API_VERSION;
const tableName     = process.env.TABLE_NAME;

export const handler = async (event) => {
    console.log('=============event : '+JSON.stringify(event));
    initApiGatewayManagementApi(event);
    let message = event.message;
    try {
        const getConnects  = await  dynamoDbDefault.scan({ TableName: tableName }).promise();
        if(getConnects) {
            const Items = getConnects.Items;
            const postCalls = Items.map(async ({ connectionId, channel }) => {
                const _connectionId  = connectionId['S'];
                const _channel       = channel['S'];
                try {
                    await apiGatewayManagementApi.postToConnection({
                        ConnectionId: _connectionId,
                        Data: JSON.stringify({
                            message: message
                        })
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

        return response = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Send message successfully.',
                connectionId: ''
            })
        };
    } catch (error) {
        console.error('Lỗi ghi dữ liệu vào DynamoDB:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Internal server error',
                error: error.message,
                connectionId: ''
            })
        };
    }
};




function initApiGatewayManagementApi(event) {
    apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion,
        endpoint: endpoint
    });
}
