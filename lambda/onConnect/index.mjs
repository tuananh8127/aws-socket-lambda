/*!
  * Version v1.0
  * Author: T Jay
  * console.log('=============origin : '+JSON.stringify(origin));
*/

import AWS from 'aws-sdk';
const dynamoDb        = new AWS.DynamoDB.DocumentClient();
const tableName       = process.env.TABLE_NAME;
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS;

export const handler = async (event) => {
    try {
        const _connectionId  = event.requestContext.connectionId;
        const _channel = event.queryStringParameters.channels ?? event.queryStringParameters.channel ?? '';
        const channelsArray = _channel.split(',').map(channel => channel.trim());

        console.log('=============_channel : '+JSON.stringify(_channel));

        const allowedDomains = ALLOWED_DOMAINS.split(',');  // STRING TO ARRAY

        const headers = event.headers;

        const origin = headers ? headers['origin'] || headers['Origin'] : '';

        if (!origin) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Forbidden: Missing Origin header' }),
            };
        }

        const isDomainAllowed = allowedDomains.some((domain) => origin.includes(domain.trim()));

        if (!isDomainAllowed) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Forbidden: Domain not allowed' }),
            };
        }

        if (!_connectionId) {
            return { statusCode: 401, body: 'Unauthorized: No connectionId provided' };
        }

        if (!_channel) {
            return { statusCode: 401, body: 'Unauthorized: No channel provided' };
        }
        // Thực hiện ghi dữ liệu vào DynamoDB
        const promises = channelsArray.map(async (channel) => {
            const params = {
                TableName: tableName,
                Item: {
                    connectionId: _connectionId,
                    channel: channel
                }
            };
            await dynamoDb.put(params).promise();
        });

        // Chờ cho tất cả các phép ghi hoàn thành
        await Promise.all(promises);
        console.log('Data was successfully written to DynamoDB with connectionId:', _connectionId);
        // Trả về phản hồi có định dạng đúng
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Connected successfully.',
                connectionId: _connectionId,
                channel: _channel
            })
        };
    } catch (error) {
        console.error('Error writing data to DynamoDB:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Internal server error',
                error: error.message
            })
        };
    }
};


