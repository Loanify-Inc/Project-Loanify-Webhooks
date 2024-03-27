const https = require('https');

// Pre-defined mapping of IDs to Slack webhook paths and user IDs
const slackConfigMap = {
    '8735070': { //Kevin Kulins
        userId: '<@U065V4AE5KJ>',
        webhookPath: '/services/T0607C1F0GP/B06PQ8AELMR/26hCLEbwAM2Kn9ZK4ajx9clI',
    },
    '8886206': { //Alex Olson
        userId: '<@U06PCRVCAJC>',
        webhookPath: '/services/T0607C1F0GP/B06QZ2X58BX/FjcDfHlWOYDpZqQPTiuPuslU',
    }
};

// Function to perform HTTP POST requests
function performHttpPostRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject({ statusCode: res.statusCode, message: data });
                }
            });
        });

        req.on('error', (error) => {
            reject({ statusCode: 500, message: error.message });
        });

        // Write the JSON body and end the request
        req.write(JSON.stringify(body));
        req.end();
    });
}

exports.handler = async (event, context) => {
    try {
        // Parsing the incoming request to get the ID and message
        const { id, message } = JSON.parse(event.body);

        // Validate the input
        if (!id || !message) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Both ID and message are required.' })
            };
        }

        const slackConfig = slackConfigMap[id];
        if (!slackConfig) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Slack configuration not found for provided ID.' })
            };
        }

        // Prepare the Slack message
        const slackMessage = {
            text: `${slackConfig.userId} ${message}`
        };

        const slackWebhookOptions = {
            hostname: 'hooks.slack.com',
            path: slackConfig.webhookPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        // Sending the Slack notification
        await performHttpPostRequest(slackWebhookOptions, slackMessage);

        // If no error, assume success
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Slack message sent successfully.' })
        };
    } catch (error) {
        console.error('Error:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error', detail: error.message })
        };
    }
};
